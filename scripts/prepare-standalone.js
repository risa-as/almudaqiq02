const fs = require('fs');
const path = require('path');
const { cpSync } = require('fs');

// Paths
const projectRoot = path.join(__dirname, '..');
const sourcePublic = path.join(projectRoot, 'public');
const destPublic = path.join(projectRoot, '.next/standalone/public');
const sourceStatic = path.join(projectRoot, '.next/static');
const destStatic = path.join(projectRoot, '.next/standalone/.next/static');

console.log('Preparing standalone build...');

try {
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
    const destElectron = path.join(projectRoot, '.next/standalone/electron');
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
    const destLocalClient = path.join(projectRoot, '.next/standalone/node_modules/@prisma/client-local');
    if (fs.existsSync(sourceLocalClient)) {
        console.log('Copying @prisma/client-local...');
        fs.mkdirSync(path.dirname(destLocalClient), { recursive: true });
        cpSync(sourceLocalClient, destLocalClient, { recursive: true });
    } else {
        console.warn('WARNING: @prisma/client-local not generated! Run "npm run prisma:local" first — offline sync will not work.');
    }

    // [New] Copy dev.db (Database). Prefer prisma/dev.db (where the local schema
    // is pushed) then fall back to a root-level dev.db.
    let sourceDb = path.join(projectRoot, 'prisma', 'dev.db');
    if (!fs.existsSync(sourceDb)) sourceDb = path.join(projectRoot, 'dev.db');
    const destDb = path.join(projectRoot, '.next/standalone/dev.db');
    if (fs.existsSync(sourceDb)) {
        console.log(`Copying database from ${sourceDb} ...`);
        // We copy it to the root of standalone so it sits next to server.js
        cpSync(sourceDb, destDb);
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

    const destEnv = path.join(projectRoot, '.next/standalone/.env');
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

    console.log('Standalone build prepared successfully!');
} catch (error) {
    console.error('Error preparing standalone build:', error);
    process.exit(1);
}
