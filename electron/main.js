const { app, BrowserWindow, ipcMain, screen, globalShortcut, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, fork } = require('child_process');
const http = require('http');

// ─── Per-install secrets ──────────────────────────────────────────────────────
// JWT/refresh secrets are NOT shipped in the app bundle. Each installation
// generates its own on first run and stores them in userData (outside the asar).
function getOrCreateDesktopSecrets() {
    const p = path.join(app.getPath('userData'), 'secrets.json');
    try {
        if (fs.existsSync(p)) {
            const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
            if (s.JWT_SECRET && s.REFRESH_TOKEN_SECRET) return s;
        }
    } catch (_) {}
    const secrets = {
        JWT_SECRET:           crypto.randomBytes(48).toString('base64'),
        REFRESH_TOKEN_SECRET: crypto.randomBytes(48).toString('base64'),
    };
    try { fs.writeFileSync(p, JSON.stringify(secrets, null, 2), 'utf-8'); } catch (_) {}
    return secrets;
}

// Prevent app crash on EPIPE or other uncaught exceptions
process.on('uncaughtException', (err) => {
    if (err.code === 'EPIPE') return;
    console.error('Uncaught exception:', err);
    debugLog(`[uncaughtException] ${err.message}\n${err.stack}`);
});

// ─── File-based diagnostic logging ────────────────────────────────────────────
// Writes to userData/debug.log so we can trace activation/sync flow without
// access to DevTools or console output.
function debugLog(msg) {
    try {
        const logPath = path.join(app.getPath('userData'), 'debug.log');
        const stamp = new Date().toISOString();
        fs.appendFileSync(logPath, `${stamp}  ${msg}\n`, 'utf-8');
    } catch (_) {}
}

let serverProcess;
let syncWorkerProcess;
let mainWin;

// ─── Branch Activation Config ────────────────────────────────────────────────
// Stored in userData/branch-config.json (writable, not inside asar)
function getConfigPath() {
    return path.join(app.getPath('userData'), 'branch-config.json');
}

function loadBranchConfig() {
    try {
        const p = getConfigPath();
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (_) {}
    return null;
}

function saveBranchConfig(config) {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Read .env file from the server directory and return key-value pairs.
 */
function loadEnvFile(serverDir) {
    const envVars = {};
    const envPath = path.join(serverDir, '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.substring(0, eqIdx).trim();
            let value = trimmed.substring(eqIdx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            envVars[key] = value;
        }
        console.log('Loaded .env variables:', Object.keys(envVars).join(', '));
    } else {
        console.warn('.env file not found at:', envPath);
    }
    return envVars;
}

function startServer(cloudUrl = '') {
    if (!app.isPackaged) {
        // In dev, server is already running via "npm run dev"
        return Promise.resolve('http://localhost:3000');
    }

    return new Promise((resolve, reject) => {
        const serverDir = path.join(process.resourcesPath, 'server');
        const serverPath = path.join(serverDir, 'server.js');
        console.log(`Starting server from: ${serverPath}`);

        const envFromFile = loadEnvFile(serverDir);
        const dbPath = path.join(serverDir, 'dev.db');
        const databaseUrl = `file:${dbPath}`;
        const secrets = getOrCreateDesktopSecrets();

        serverProcess = spawn(process.execPath, [serverPath], {
            env: {
                ...process.env,
                ...envFromFile,
                DATABASE_URL:         databaseUrl,
                LOCAL_DATABASE_URL:   databaseUrl,  // used by sync-enqueue in Next.js routes
                IS_ELECTRON:          '1',          // gates enqueue calls in API routes
                CLOUD_URL:            cloudUrl || envFromFile.CLOUD_URL || '',  // branch config → .env fallback
                // Per-install JWT secrets (never shipped in the bundle)
                JWT_SECRET:           secrets.JWT_SECRET,
                REFRESH_TOKEN_SECRET: secrets.REFRESH_TOKEN_SECRET,
                ELECTRON_RUN_AS_NODE: '1',
                ELECTRON_NO_ASAR:     '1',
                PORT:     '3000',
                HOSTNAME: 'localhost',
                NODE_ENV: 'production'
            },
            cwd: serverDir,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        serverProcess.stdout.on('data', (data) => {
            try { console.log(`Server: ${data}`); } catch (_) {}
        });
        serverProcess.stderr.on('data', (data) => {
            try { console.error(`Server Error: ${data}`); } catch (_) {}
        });
        serverProcess.on('error', (err) => {
            console.error('Failed to start server process:', err);
            reject(err);
        });
        serverProcess.on('exit', (code) => {
            console.log(`Server process exited with code: ${code}`);
        });

        // Poll server until ready (max 60s)
        let attempts = 0;
        const checkServer = () => {
            attempts++;
            http.get('http://localhost:3000', () => {
                console.log('Server is ready!');
                resolve('http://localhost:3000');
            }).on('error', () => {
                if (attempts >= 60) {
                    console.error('Server failed to start after 60 seconds');
                    resolve('http://localhost:3000');
                } else {
                    setTimeout(checkServer, 1000);
                }
            });
        };
        checkServer();
    });
}

// ─── Sync Worker ─────────────────────────────────────────────────────────────
function startSyncWorker(branchConfig) {
    if (!branchConfig?.branchToken) {
        console.log('[main] startSyncWorker: no branchToken — skipping');
        return;
    }

    // Kill any running sync worker before starting a new one (e.g. account switch)
    if (syncWorkerProcess) {
        debugLog('[startSyncWorker] Killing existing sync worker before restart');
        try { syncWorkerProcess.kill(); } catch (_) {}
        syncWorkerProcess = null;
    }

    const workerPath = app.isPackaged
        ? path.join(process.resourcesPath, 'server', 'electron', 'sync-worker.js')
        : path.join(__dirname, 'sync-worker.js');

    if (!fs.existsSync(workerPath)) {
        console.warn('Sync worker not found at:', workerPath);
        return;
    }

    // Resolve local DB path for the worker's OfflineQueue
    const localDbPath = app.isPackaged
        ? path.join(process.resourcesPath, 'server', 'dev.db')
        : path.join(process.cwd(), 'prisma', 'dev.db');
    const localDbUrl = `file:${localDbPath}`;

    syncWorkerProcess = fork(workerPath, [], {
        env: {
            ...process.env,
            BRANCH_TOKEN:       branchConfig.branchToken,
            BRANCH_ID:          branchConfig.branchId,
            TENANT_ID:          branchConfig.tenantId,
            CLOUD_URL:          branchConfig.cloudUrl ?? 'http://localhost:3000',
            LOCAL_DATABASE_URL: localDbUrl,
            NODE_ENV:           app.isPackaged ? 'production' : 'development',
        },
        silent: true,
    });

    debugLog(`[startSyncWorker] fork ${workerPath} CLOUD_URL=${branchConfig.cloudUrl} DB=${localDbUrl}`);

    syncWorkerProcess.stdout.on('data', (d) => debugLog(`[SyncWorker OUT] ${d.toString().trim()}`));
    syncWorkerProcess.stderr.on('data', (d) => debugLog(`[SyncWorker ERR] ${d.toString().trim()}`));

    syncWorkerProcess.on('message', (msg) => {
        if (!msg || !mainWin || mainWin.isDestroyed()) return;
        debugLog(`[SyncWorker MSG] ${JSON.stringify(msg)}`);
        if (msg.type === 'sync:status') {
            mainWin.webContents.send('sync:status', msg.status);
        } else if (msg.type === 'sync:pulled') {
            mainWin.webContents.send('sync:pulled', { applied: msg.applied });
        }
    });

    syncWorkerProcess.on('error', (err) => debugLog(`[SyncWorker ERROR] ${err.message}`));
    syncWorkerProcess.on('exit', (code, signal) => {
        debugLog(`[SyncWorker EXIT] code=${code} signal=${signal}`);
        if (code !== 0 && code !== null) {
            debugLog('[SyncWorker] Restarting in 10s…');
            setTimeout(() => startSyncWorker(branchConfig), 10_000);
        }
    });

    debugLog('[startSyncWorker] fork called — worker PID will appear in OUT/ERR');
}

// ─── Auto-Login ───────────────────────────────────────────────────────────────

/**
 * Reads the saved refresh-token from the Electron session cookies,
 * exchanges it for a fresh access-token, and injects that token back
 * into the session so the Next.js middleware sees an authenticated request.
 *
 * Returns the role-based redirect path on success, null on failure.
 */
async function tryAutoLogin(baseUrl) {
    try {
        // Refresh-token cookie is scoped to path /api/auth/refresh
        const cookies = await session.defaultSession.cookies.get({
            url: `${baseUrl}/api/auth/refresh`,
        });
        const refreshCookie = cookies.find(c => c.name === 'refresh-token');

        if (!refreshCookie) {
            console.log('[AutoLogin] No refresh token — showing login page.');
            return null;
        }

        console.log('[AutoLogin] Refresh token found — attempting silent re-auth…');

        // Call the local Next.js refresh endpoint from the main process
        const res = await fetch(`${baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Pass the token both ways — cookie header + body
                'Cookie': `refresh-token=${refreshCookie.value}`,
            },
            body: JSON.stringify({ refreshToken: refreshCookie.value }),
        });

        if (!res.ok) {
            console.log(`[AutoLogin] Refresh rejected (${res.status}) — showing login.`);
            // Clear stale cookies so we start fresh
            await session.defaultSession.cookies.remove(baseUrl, 'refresh-token');
            await session.defaultSession.cookies.remove(baseUrl, 'auth-token');
            return null;
        }

        const { accessToken } = await res.json();

        // Inject the new access-token into the Electron session
        await session.defaultSession.cookies.set({
            url:            baseUrl,
            name:           'auth-token',
            value:          accessToken,
            httpOnly:       true,
            path:           '/',
            sameSite:       'lax',
            expirationDate: Math.floor(Date.now() / 1000) + 8 * 3600,
        });

        // Decode JWT payload (no signature check needed — server already validated)
        const payloadB64 = accessToken.split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
        const role = payload.role ?? 'CASHIER';

        const ROLE_REDIRECT = {
            SUPER_ADMIN:    '/super-admin/dashboard',
            ADMIN:          '/dashboard',
            BRANCH_MANAGER: '/dashboard',
            CASHIER:        '/pos',
            STOCK_KEEPER:   '/dashboard/inventory',
        };
        const redirectTo = ROLE_REDIRECT[role] ?? '/pos';

        console.log(`[AutoLogin] Success — role: ${role} → ${redirectTo}`);
        return redirectTo;
    } catch (err) {
        console.error('[AutoLogin] Unexpected error:', err.message);
        return null;
    }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// ─── Auto-Activation from activation_params.json ────────────────────────────
// The login route writes this file when IS_ELECTRON=1. Main process watches it
// and calls the cloud activate endpoint in Node.js (no CORS restrictions).

async function attemptAutoActivation(serverDir, envCloudUrl) {
    if (loadBranchConfig()?.branchToken) { debugLog('[activation] Skipping — branchToken already saved'); return; }
    const paramsPath = path.join(serverDir, 'activation_params.json');
    if (!fs.existsSync(paramsPath)) { debugLog(`[activation] No params file at ${paramsPath}`); return; }
    try {
        debugLog(`[activation] Reading params from ${paramsPath}`);
        const params = JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
        const cloudUrl = params.cloudUrl || envCloudUrl || '';
        if (!cloudUrl || !params.branchId || !params.activationCode) {
            debugLog(`[activation] Missing fields — cloudUrl=${cloudUrl} branchId=${params.branchId} activationCode=${params.activationCode ? '<set>' : '<empty>'}`);
            return;
        }
        debugLog(`[activation] POST ${cloudUrl}/api/branches/${params.branchId}/activate`);
        const res = await fetch(`${cloudUrl}/api/branches/${params.branchId}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activationCode: params.activationCode }),
        });
        debugLog(`[activation] Response status=${res.status}`);
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            debugLog(`[activation] Non-OK body: ${body.slice(0, 500)}`);
            return;
        }
        const data = await res.json();
        if (!data.branchToken) { debugLog(`[activation] No branchToken in response: ${JSON.stringify(data).slice(0,300)}`); return; }
        const config = {
            branchToken: data.branchToken,
            branchId:    params.branchId,
            tenantId:    params.tenantId,
            cloudUrl,
        };
        saveBranchConfig(config);
        startSyncWorker(config);
        debugLog('[activation] Saved branch config + started sync worker');
        if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send('sync:activated');
        }
    } catch (err) {
        debugLog(`[activation] ERROR: ${err.message}\n${err.stack || ''}`);
    }
}

function watchForActivation(serverDir, envCloudUrl) {
    debugLog(`[watchForActivation] Starting — serverDir=${serverDir} envCloudUrl=${envCloudUrl}`);
    attemptAutoActivation(serverDir, envCloudUrl);
    const timer = setInterval(() => {
        if (loadBranchConfig()?.branchToken) {
            debugLog('[watchForActivation] branchToken present — stopping poll');
            clearInterval(timer);
            return;
        }
        attemptAutoActivation(serverDir, envCloudUrl);
    }, 3000);
    setTimeout(() => clearInterval(timer), 30 * 60 * 1000);
}

// Renderer → Main: save branch config after activation
ipcMain.handle('branch:activate', (_event, config) => {
    saveBranchConfig(config);
    startSyncWorker(config);
    return { ok: true };
});

// Renderer → Main: activate sync worker via cloud (runs in main process — no CORS)
ipcMain.handle('sync:activate', async (_event, { activationCode, branchId, tenantId, cloudUrl }) => {
    try {
        const res = await fetch(`${cloudUrl}/api/branches/${branchId}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activationCode }),
        });
        if (!res.ok) {
            const err = await res.text().catch(() => res.status.toString());
            return { ok: false, error: err };
        }
        const data = await res.json();
        const branchToken = data.branchToken;
        if (!branchToken) return { ok: false, error: 'no_token' };

        const config = { branchToken, branchId, tenantId, cloudUrl };
        saveBranchConfig(config);
        startSyncWorker(config);
        return { ok: true };
    } catch (err) {
        console.error('[sync:activate] Failed:', err.message);
        return { ok: false, error: err.message };
    }
});

// Renderer → Main: get current branch config
ipcMain.handle('branch:get-config', () => loadBranchConfig());

// Renderer → Main: force sync
ipcMain.on('sync:force', () => {
    if (syncWorkerProcess) {
        syncWorkerProcess.send({ type: 'sync:force' });
    }
});

// Renderer → Main: wipe all local tenant data then restart sync worker
ipcMain.handle('db:wipe-local', async () => {
    // Kill sync worker first so it doesn't re-write data during wipe
    if (syncWorkerProcess) {
        try { syncWorkerProcess.kill(); } catch (_) {}
        syncWorkerProcess = null;
        debugLog('[db:wipe-local] Sync worker killed');
    }

    // Resolve local DB path (same logic as startSyncWorker)
    const localDbPath = app.isPackaged
        ? path.join(process.resourcesPath, 'server', 'dev.db')
        : path.join(process.cwd(), 'prisma', 'dev.db');
    const localDbUrl = `file:${localDbPath}`;

    // Load OfflineQueue — try dev path first, then packaged path
    let OfflineQueueClass = null;
    try {
        OfflineQueueClass = require('./offline-queue').OfflineQueue;
    } catch (_) {
        try {
            OfflineQueueClass = require(
                path.join(process.resourcesPath, 'server', 'electron', 'offline-queue.js')
            ).OfflineQueue;
        } catch (__) {}
    }

    if (!OfflineQueueClass) {
        debugLog('[db:wipe-local] ERROR: OfflineQueue not found');
        return { ok: false, error: 'OfflineQueue not available' };
    }

    try {
        const queue = new OfflineQueueClass(localDbUrl);
        const counts = await queue.wipeSyncData();
        debugLog(`[db:wipe-local] Wiped: ${JSON.stringify(counts)}`);

        // Restart sync worker so it re-pulls everything fresh from cloud
        const config = loadBranchConfig();
        if (config?.branchToken) {
            setTimeout(() => startSyncWorker(config), 2000);
            debugLog('[db:wipe-local] Sync worker restart scheduled');
        }

        return { ok: true, counts };
    } catch (err) {
        debugLog(`[db:wipe-local] Error: ${err.message}`);
        return { ok: false, error: err.message };
    }
});

// ─── Loading Window ───────────────────────────────────────────────────────────
function createLoadingWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        maximized: true,
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
        icon: process.platform === 'win32' ? path.join(__dirname, '../public/logo.ico') : path.join(__dirname, '../public/logo.png')
    });
    win.maximize();

    win.loadURL(`data:text/html;charset=utf-8,
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head><meta charset="utf-8"><title>SupermarketPOS</title></head>
    <body style="margin:0;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:'Segoe UI',Tahoma,sans-serif;background:#0f172a;color:white;">
      <div style="text-align:center;">
        <div style="width:60px;height:60px;border:4px solid rgba(255,255,255,0.15);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 24px;"></div>
        <h1 style="font-size:24px;margin:0 0 8px;font-weight:600;">جاري تشغيل النظام...</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0;">يرجى الانتظار بينما يتم تهيئة الخادم</p>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </body>
    </html>`);

    return win;
}

// ─── Main Window ─────────────────────────────────────────────────────────────
function createMainWindow(startUrl) {
    mainWin = new BrowserWindow({
        width: 1280,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,  // allow renderer to fetch cross-port cloud URLs (local POS only)
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: process.platform === 'win32' ? path.join(__dirname, '../public/logo.ico') : path.join(__dirname, '../public/logo.png')
    });
    mainWin.maximize();

    // Restrict navigation to the local server; open any external link in the
    // user's default browser rather than inside the privileged app window.
    const isLocal = (url) => /^https?:\/\/localhost(:\d+)?(\/|$)/i.test(url);
    mainWin.webContents.on('will-navigate', (event, url) => {
        if (!isLocal(url)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
    mainWin.webContents.setWindowOpenHandler(({ url }) => {
        if (!isLocal(url)) shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWin.loadURL(startUrl).catch(() => {
        setTimeout(() => mainWin.loadURL(startUrl), 3000);
    });

    mainWin.webContents.on('did-fail-load', () => {
        setTimeout(() => mainWin.loadURL(startUrl), 3000);
    });

    return mainWin;
}

// ─── Backup Config ────────────────────────────────────────────────────────────
function getBackupConfig() {
    const p = path.join(app.getPath('userData'), 'backup-config.json');
    try {
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (_) {}
    return { intervalHours: 6 };
}

function saveBackupConfig(cfg) {
    try {
        fs.writeFileSync(path.join(app.getPath('userData'), 'backup-config.json'), JSON.stringify(cfg, null, 2), 'utf-8');
    } catch (_) {}
}

// Save backup JSON received from renderer to userData/backups/
ipcMain.handle('backup:save', async (_event, { json, filename }) => {
    try {
        const backupsDir = path.join(app.getPath('userData'), 'backups');
        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
        fs.writeFileSync(path.join(backupsDir, filename), json, 'utf-8');
        debugLog(`[backup] Saved: ${filename} (${Math.round(Buffer.byteLength(json, 'utf8') / 1024)} KB)`);
        return { success: true };
    } catch (err) {
        debugLog(`[backup] Save failed: ${err.message}`);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('backup:get-interval', () => getBackupConfig().intervalHours);

ipcMain.handle('backup:set-interval', (_event, hours) => {
    saveBackupConfig({ intervalHours: hours });
    setupBackupInterval(hours);
    debugLog(`[backup] Interval updated to ${hours}h`);
    return { success: true };
});

// Renderer signals backup complete → safe to quit
let isQuittingAfterBackup = false;
ipcMain.on('backup:done-quit', () => {
    debugLog('[backup] done-quit received — exiting');
    isQuittingAfterBackup = true;
    app.exit(0);
});

// Send IPC request to the active renderer window
function requestBackupFromRenderer(isQuit = false) {
    const wins = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
    if (wins.length === 0) { debugLog('[backup] No window available for backup'); return false; }
    wins[0].webContents.send(isQuit ? 'backup:request-quit' : 'backup:request');
    debugLog(`[backup] Sent ${isQuit ? 'request-quit' : 'request'} to renderer`);
    return true;
}

// Interval timer (started after main window loads)
let backupTimer = null;
function setupBackupInterval(hours) {
    if (backupTimer) clearInterval(backupTimer);
    backupTimer = setInterval(() => requestBackupFromRenderer(), hours * 3_600_000);
    debugLog(`[backup] Interval active: every ${hours}h`);
}

// ─── App Ready ───────────────────────────────────────────────────────────────
app.whenReady().then(async () => {

    const loadingWin = createLoadingWindow();
    let tempRef = loadingWin; // keep reference until replaced

    // Load branch config first so we can pass CLOUD_URL to the server process
    const branchConfig = loadBranchConfig();

    const baseUrl = await startServer(branchConfig?.cloudUrl ?? '').catch((err) => {
        console.error('Failed to start server:', err);
        return 'http://localhost:3000';
    });

    // Resolve the server directory for watchForActivation
    const serverDir = app.isPackaged
        ? path.join(process.resourcesPath, 'server')
        : process.cwd();
    const envCloudUrl = branchConfig?.cloudUrl || '';

    // DevTools — always available (temporarily for debugging sync issues)
    globalShortcut.register('CommandOrControl+Shift+I', () => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) focused.webContents.toggleDevTools();
    });

    // ── Determine start URL ──────────────────────────────────────────────────
    let startUrl;

    debugLog(`[whenReady] isPackaged=${app.isPackaged} serverDir=${serverDir} branchConfig=${branchConfig ? 'YES' : 'NO'}`);
    if (branchConfig?.branchToken) {
        debugLog('[whenReady] branchToken present — starting sync worker directly');
        startSyncWorker(branchConfig);
        const autoPath = await tryAutoLogin(baseUrl);
        startUrl = `${baseUrl}${autoPath ?? '/pos'}`;
    } else {
        debugLog('[whenReady] No branchConfig — calling watchForActivation()');
        watchForActivation(serverDir, envCloudUrl);
        const autoPath = await tryAutoLogin(baseUrl);
        startUrl = autoPath
            ? `${baseUrl}${autoPath}`
            : `${baseUrl}/login`;
    }
    debugLog(`[whenReady] startUrl=${startUrl}`);

    console.log('Navigating to:', startUrl);
    const win = createMainWindow(startUrl);

    // Destroy loading window once main window is ready; start backup interval
    win.webContents.once('did-finish-load', () => {
        if (tempRef && !tempRef.isDestroyed()) tempRef.close();
        tempRef = null;
        // Start configurable auto-backup interval
        const cfg = getBackupConfig();
        setupBackupInterval(cfg.intervalHours);
    });

    // Dual screen (Customer Display)
    const displays = screen.getAllDisplays();
    const externalDisplay = displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0);
    if (externalDisplay) {
        console.log('Second display detected! Opening Customer Screen.');
        const customerWin = new BrowserWindow({
            x: externalDisplay.bounds.x + 50,
            y: externalDisplay.bounds.y + 50,
            width: 1024,
            height: 768,
            fullscreen: true,
            autoHideMenuBar: true,
            webPreferences: { nodeIntegration: false, contextIsolation: true },
            icon: process.platform === 'win32' ? path.join(__dirname, '../public/logo.ico') : path.join(__dirname, '../public/logo.png')
        });
        customerWin.loadURL(`${baseUrl}/customer-screen`).catch((err) => {
            console.error('Customer screen failed to load', err);
        });
    }
});

app.on('before-quit', (event) => {
    // Trigger a final backup before quitting (unless already in quit sequence)
    if (!isQuittingAfterBackup) {
        const sent = requestBackupFromRenderer(true);
        if (sent) {
            event.preventDefault(); // hold quit until backup:done-quit arrives
            // Fallback: if renderer never responds within 12s, force-quit
            setTimeout(() => { isQuittingAfterBackup = true; app.exit(0); }, 12000);
            return;
        }
    }
    globalShortcut.unregisterAll();
    if (backupTimer) clearInterval(backupTimer);
    if (serverProcess) serverProcess.kill();
    if (syncWorkerProcess) syncWorkerProcess.kill();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoadingWindow();
});
