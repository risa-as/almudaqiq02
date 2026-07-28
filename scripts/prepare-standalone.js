const fs = require('fs');
const path = require('path');
const { cpSync } = require('fs');
const { buildCleanDatabase, assertCleanForShipping } = require('./make-clean-db');

// Paths
const projectRoot = path.join(__dirname, '..');
const distDir = process.env.NEXT_DIST_DIR || '.next';
const sourcePublic = path.join(projectRoot, 'public');
const destPublic = path.join(projectRoot, `${distDir}/standalone/public`);
const sourceStatic = path.join(projectRoot, `${distDir}/static`);
const destStatic = path.join(projectRoot, `${distDir}/standalone/${distDir}/static`);

console.log('Preparing standalone build...');

async function main() {
    // Copy public folder
    if (fs.existsSync(sourcePublic)) {
        console.log('Copying public folder...');
        if (!fs.existsSync(destPublic)) {
            fs.mkdirSync(destPublic, { recursive: true });
        }
        cpSync(sourcePublic, destPublic, { recursive: true });
    }

    // Copy .next/static folder
    if (fs.existsSync(sourceStatic)) {
        console.log('Copying static folder...');
        const staticDestDir = path.dirname(destStatic);
        if (!fs.existsSync(staticDestDir)) {
            fs.mkdirSync(staticDestDir, { recursive: true });
        }
        cpSync(sourceStatic, destStatic, { recursive: true });
    }

    // Copy the Electron sync worker + offline queue so the packaged app can
    // find them at resources/server/electron/ (main.js looks there in prod).
    const sourceElectron = path.join(projectRoot, 'electron');
    const destElectron = path.join(projectRoot, `${distDir}/standalone/electron`);
    if (fs.existsSync(sourceElectron)) {
        console.log('Copying electron/ (sync worker + offline queue)...');
        cpSync(sourceElectron, destElectron, { recursive: true });
    } else {
        console.warn('WARNING: electron/ folder not found — sync worker will be missing.');
    }

    // Copy the local SQLite Prisma client into the standalone node_modules so
    // both the server routes and the sync worker can require @prisma/client-local
    // at runtime. (afterPack copies standalone/node_modules into the package.)
    const sourceLocalClient = path.join(projectRoot, 'node_modules/@prisma/client-local');
    const destLocalClient = path.join(projectRoot, `${distDir}/standalone/node_modules/@prisma/client-local`);
    if (fs.existsSync(sourceLocalClient)) {
        console.log('Copying @prisma/client-local...');
        fs.mkdirSync(path.dirname(destLocalClient), { recursive: true });
        cpSync(sourceLocalClient, destLocalClient, { recursive: true });
    } else {
        console.warn('WARNING: @prisma/client-local not generated! Run "npm run prisma:local" first — offline sync will not work.');
    }

    // Ship an EMPTY database, never the developer's own.
    //
    // This used to copy prisma/dev.db verbatim, which meant every customer
    // received the dev machine's User rows (loginable accounts), RefreshTokens,
    // another tenant's transactions and audit log — and worst of all a populated
    // SyncQueue, whose rows get pushed to the cloud on the new install's first
    // sync. The clean copy keeps the schema and drops every row; the assert below
    // re-checks the file that is actually being shipped, so a failure here stops
    // the build instead of producing a leaky installer.
    let sourceDb = path.join(projectRoot, 'prisma', 'dev.db');
    if (!fs.existsSync(sourceDb)) sourceDb = path.join(projectRoot, 'dev.db');
    const destDb = path.join(projectRoot, `${distDir}/standalone/dev.db`);

    if (fs.existsSync(sourceDb)) {
        console.log('Building clean shipping database (no accounts, no business data)...');
        const cleanDb = await buildCleanDatabase({
            sourceDb,
            outputDb: path.join(projectRoot, distDir, 'clean-build.db'),
        });

        cpSync(cleanDb, destDb);

        // Stale WAL sidecars next to the destination would silently resurrect
        // rows that the clean copy dropped.
        for (const suffix of ['-wal', '-shm']) {
            if (fs.existsSync(destDb + suffix)) fs.rmSync(destDb + suffix, { force: true });
        }

        const counts = await assertCleanForShipping(destDb);
        console.log(
            `Verified clean database — User=${counts.userCount} SuperAdmin=${counts.superAdminCount}` +
            ` RefreshToken=${counts.refreshTokenCount} SyncQueue=${counts.syncQueueCount}`
        );
    } else {
        console.warn('WARNING: dev.db not found! The installed app will start with no database. Run "npm run db:setup" first.');
    }

    // SECURITY: never ship the cloud .env (it holds the cloud DB credentials and
    // JWT/refresh/branch secrets). Write a MINIMAL desktop .env instead. Per-install
    // JWT secrets and the local DB path are injected by electron/main.js at runtime.
    //
    // CLOUD_URL is the only cloud value we DO ship — it tells the desktop where to
    // call /api/auth/desktop-verify for first-login cloud verification.
    // Set CLOUD_URL in the project .env to your deployed URL before running npm run dist.
    function readEnvVar(filePath, varName) {
        if (!fs.existsSync(filePath)) return '';
        const content = fs.readFileSync(filePath, 'utf-8');
        const regex = new RegExp(`^${varName}=["']?([^"'\\n]+)["']?\\s*$`, 'm');
        const m = content.match(regex);
        return m ? m[1].trim() : '';
    }
    const cloudUrl = readEnvVar(path.join(projectRoot, '.env'), 'CLOUD_URL');
    if (!cloudUrl || cloudUrl.includes('localhost')) {
        console.warn('WARNING: CLOUD_URL is not set or points to localhost. Desktop login will fail unless a real cloud URL is set in .env before building.');
    }

    const destEnv = path.join(projectRoot, `${distDir}/standalone/.env`);
    const desktopEnv = [
        '# Desktop (Electron) environment — generated at build time.',
        '# Cloud credentials and JWT secrets are intentionally NOT shipped here;',
        '# electron/main.js injects per-install secrets and the local DB path at runtime.',
        'NODE_ENV=production',
        'IS_ELECTRON=1',
        'LOCAL_DATABASE_URL="file:./dev.db"',
        `CLOUD_URL="${cloudUrl}"`,
        '',
    ].join('\n');
    fs.writeFileSync(destEnv, desktopEnv, 'utf-8');
    console.log('Wrote minimal desktop .env (no cloud secrets).');

    // ── Remove what Next's file tracing swept in ─────────────────────────────
    // `next build` copies the whole prisma/ folder into standalone/, so the
    // developer's real database lands at standalone/prisma/dev.db — a second
    // copy that bypasses the clean database written above. The shipped .env
    // points LOCAL_DATABASE_URL at ./dev.db, but leaving a populated file next
    // to it ships every account and queued sync row anyway.
    const sweptPrismaDb = path.join(projectRoot, `${distDir}/standalone/prisma/dev.db`);
    for (const suffix of ['', '-wal', '-shm']) {
        if (fs.existsSync(sweptPrismaDb + suffix)) {
            fs.rmSync(sweptPrismaDb + suffix, { force: true });
            console.log(`Removed swept developer database: prisma/dev.db${suffix}`);
        }
    }

    await verifyNothingSecretIsShipped();

    console.log('Standalone build prepared successfully!');
}

/**
 * Last gate before packaging. Fails the build rather than let a leaky bundle
 * through.
 *
 * This exists because the leak it checks for actually happened: `postbuild` ran
 * without NEXT_DIST_DIR, so everything above was written into `.next/standalone`
 * while electron-builder packaged `.next-build/standalone`. The installer got
 * Next's own copy of the project .env — DATABASE_URL, JWT_SECRET,
 * BRANCH_TOKEN_SECRET, CRON_SECRET, GEMINI_API_KEY and LICENSE_PRIVATE_KEY —
 * plus the developer's populated dev.db. Silent, and invisible in the build log.
 */
async function verifyNothingSecretIsShipped() {
    const standaloneDir = path.join(projectRoot, `${distDir}/standalone`);
    const problems = [];

    if (!fs.existsSync(standaloneDir)) {
        throw new Error(
            `standalone directory not found: ${standaloneDir}\n` +
            `NEXT_DIST_DIR is "${distDir}" — it must match the directory electron-builder ships ` +
            `(see "extraResources" in package.json).`
        );
    }

    // 1. No secret may appear in the shipped .env.
    const shippedEnv = path.join(standaloneDir, '.env');
    if (fs.existsSync(shippedEnv)) {
        const content = fs.readFileSync(shippedEnv, 'utf-8');
        const FORBIDDEN = [
            'DATABASE_URL=', 'JWT_SECRET=', 'REFRESH_TOKEN_SECRET=', 'BRANCH_TOKEN_SECRET=',
            'CRON_SECRET=', 'GEMINI_API_KEY=', 'OPENAI_API_KEY=', 'LICENSE_PRIVATE_KEY=',
            'LICENSE_SECRET_KEY=', 'DEVELOPER_PASSWORD=', 'RESEND_API_KEY=',
            'SUPER_ADMIN_BOOTSTRAP_SECRET=',
        ];
        // LOCAL_DATABASE_URL is fine and contains "DATABASE_URL=" as a substring.
        const found = FORBIDDEN.filter(k => new RegExp(`(^|\\n)\\s*${k}`).test(content));
        if (found.length > 0) problems.push(`.env يحتوي أسراراً: ${found.join(', ')}`);
    }

    // 2. Every database inside the bundle must be empty.
    const { assertCleanForShipping } = require('./make-clean-db');
    const dbCandidates = [
        path.join(standaloneDir, 'dev.db'),
        path.join(standaloneDir, 'prisma', 'dev.db'),
    ];
    for (const dbPath of dbCandidates) {
        if (!fs.existsSync(dbPath)) continue;
        try {
            await assertCleanForShipping(dbPath);
        } catch (err) {
            problems.push(`${path.relative(projectRoot, dbPath)}: ${err.message}`);
        }
    }

    if (problems.length > 0) {
        throw new Error(
            'أُوقف البناء — الحزمة تحتوي بيانات لا يجوز شحنها:\n  - ' + problems.join('\n  - ')
        );
    }

    console.log('Shipping bundle verified — no secrets, no populated database.');
}

main().catch(error => {
    console.error('Error preparing standalone build:', error);
    process.exit(1);
});
