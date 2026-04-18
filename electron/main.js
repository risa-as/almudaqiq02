const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, fork } = require('child_process');
const http = require('http');

// Prevent app crash on EPIPE or other uncaught exceptions
process.on('uncaughtException', (err) => {
    if (err.code === 'EPIPE') return;
    console.error('Uncaught exception:', err);
});

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

function startServer() {
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

        serverProcess = spawn(process.execPath, [serverPath], {
            env: {
                ...process.env,
                ...envFromFile,
                DATABASE_URL: databaseUrl,
                ELECTRON_RUN_AS_NODE: '1',
                ELECTRON_NO_ASAR: '1',
                PORT: '3000',
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
    if (!branchConfig?.branchToken) return;

    const workerPath = app.isPackaged
        ? path.join(process.resourcesPath, 'server', 'electron', 'sync-worker.js')
        : path.join(__dirname, 'sync-worker.js');

    if (!fs.existsSync(workerPath)) {
        console.warn('Sync worker not found at:', workerPath);
        return;
    }

    syncWorkerProcess = fork(workerPath, [], {
        env: {
            ...process.env,
            BRANCH_TOKEN: branchConfig.branchToken,
            BRANCH_ID: branchConfig.branchId,
            TENANT_ID: branchConfig.tenantId,
            CLOUD_URL: branchConfig.cloudUrl ?? 'http://localhost:3000',
            NODE_ENV: app.isPackaged ? 'production' : 'development',
        },
        silent: true,
    });

    syncWorkerProcess.on('message', (msg) => {
        // Forward sync status to renderer process
        if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send('sync:status', msg);
        }
    });

    syncWorkerProcess.on('error', (err) => console.error('Sync worker error:', err));
    syncWorkerProcess.on('exit', (code) => console.log(`Sync worker exited: ${code}`));

    console.log('Sync worker started.');
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Renderer → Main: save branch config after activation
ipcMain.handle('branch:activate', (_event, config) => {
    saveBranchConfig(config);
    startSyncWorker(config);
    return { ok: true };
});

// Renderer → Main: get current branch config
ipcMain.handle('branch:get-config', () => loadBranchConfig());

// Renderer → Main: force sync
ipcMain.on('sync:force', () => {
    if (syncWorkerProcess) {
        syncWorkerProcess.send({ type: 'sync:force' });
    }
});

// ─── Loading Window ───────────────────────────────────────────────────────────
function createLoadingWindow() {
    const win = new BrowserWindow({
        width: 1024,
        height: 748,
        fullscreen: true,
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
        icon: path.join(__dirname, '../public/logo.png')
    });

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
        width: 1024,
        height: 748,
        fullscreen: true,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, '../public/logo.png')
    });

    mainWin.loadURL(startUrl).catch(() => {
        setTimeout(() => mainWin.loadURL(startUrl), 3000);
    });

    mainWin.webContents.on('did-fail-load', () => {
        setTimeout(() => mainWin.loadURL(startUrl), 3000);
    });

    return mainWin;
}

// ─── Auto Backup ─────────────────────────────────────────────────────────────
function autoBackup() {
    try {
        const cwd = app.isPackaged ? path.join(process.resourcesPath, 'server') : process.cwd();
        let dbPath = path.join(cwd, 'prisma', 'dev.db');
        if (!fs.existsSync(dbPath)) dbPath = path.join(cwd, 'dev.db');
        if (!fs.existsSync(dbPath)) return;

        const backupsDir = app.isPackaged
            ? path.join(path.dirname(app.getPath('exe')), 'backups')
            : path.join(cwd, 'backups');

        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

        const todayDate = new Date().toISOString().split('T')[0];
        const destPath = path.join(backupsDir, `backup-auto-${todayDate}.db`);
        if (!fs.existsSync(destPath)) {
            fs.copyFileSync(dbPath, destPath);
            console.log('Auto-backup completed:', destPath);
        }
    } catch (err) {
        console.error('Auto-backup failed:', err);
    }
}

// ─── App Ready ───────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    autoBackup();

    const loadingWin = createLoadingWindow();
    let tempRef = loadingWin; // keep reference until replaced

    const baseUrl = await startServer().catch((err) => {
        console.error('Failed to start server:', err);
        return 'http://localhost:3000';
    });

    globalShortcut.register('CommandOrControl+Shift+I', () => {
        const focused = BrowserWindow.getFocusedWindow();
        if (focused) focused.webContents.toggleDevTools();
    });

    // Determine start URL based on activation status
    const branchConfig = loadBranchConfig();
    let startUrl;

    if (branchConfig?.branchToken) {
        // Already activated → go to POS
        startUrl = `${baseUrl}/pos`;
        startSyncWorker(branchConfig);
    } else {
        // Not activated → show branch activation page
        startUrl = `${baseUrl}/activate/branch`;
    }

    console.log('Navigating to:', startUrl);
    const win = createMainWindow(startUrl);

    // Destroy loading window once main window is ready
    win.webContents.once('did-finish-load', () => {
        if (tempRef && !tempRef.isDestroyed()) tempRef.close();
        tempRef = null;
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
            icon: path.join(__dirname, '../public/logo.png')
        });
        customerWin.loadURL(`${baseUrl}/customer-screen`).catch((err) => {
            console.error('Customer screen failed to load', err);
        });
    }
});

app.on('before-quit', () => {
    globalShortcut.unregisterAll();
    if (serverProcess) serverProcess.kill();
    if (syncWorkerProcess) syncWorkerProcess.kill();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoadingWindow();
});
