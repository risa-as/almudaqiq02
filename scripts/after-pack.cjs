// electron-builder afterPack hook (CommonJS).
// electron-builder excludes node_modules from extraResources by default, so the
// Next.js standalone server's node_modules never reach resources/server/. We
// copy them here, after packing, bypassing the filter system.
//
// On Windows we use `robocopy` instead of fs.cpSync because Defender often
// holds short-lived locks on freshly-written Prisma engine binaries; robocopy
// has built-in retry and handles locked files far better than cpSync.

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

function copyDir(src, dest, label) {
    if (process.platform === 'win32') {
        const result = spawnSync('robocopy', [
            src, dest,
            '/E',         // include subdirs (incl. empty)
            '/R:20',      // 20 retries on each file
            '/W:2',       // wait 2 sec between retries
            '/MT:4',      // 4 copy threads
            '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS', '/NP', // quiet output
        ], { stdio: 'inherit' });
        // robocopy: status 0-7 = success (with various meanings), >= 8 = real error
        if (result.status === null || result.status >= 8) {
            throw new Error(`robocopy failed for ${label} (exit ${result.status})`);
        }
        return;
    }
    fs.cpSync(src, dest, { recursive: true, force: true });
}

module.exports = async function afterPack(context) {
    const appOutDir = context.appOutDir;
    const serverDest = path.join(appOutDir, 'resources', 'server');
    const distDir = process.env.NEXT_DIST_DIR || '.next';
    const standaloneSrc = path.join(__dirname, '..', distDir, 'standalone');

    const targets = [
        {
            src: path.join(standaloneSrc, 'node_modules'),
            dest: path.join(serverDest, 'node_modules'),
            label: 'standalone deps',
        },
        {
            src: path.join(standaloneSrc, '.next', 'node_modules'),
            dest: path.join(serverDest, '.next', 'node_modules'),
            label: '.next deps',
        },
    ];

    for (const { src, dest, label } of targets) {
        if (!fs.existsSync(src)) {
            console.log(`afterPack: ${label} — not found, skipping`);
            continue;
        }
        console.log(`afterPack: copying ${label} ...`);
        copyDir(src, dest, label);
        console.log(`afterPack: ${label} — done`);
    }

    verifyPackagedApp(appOutDir);
};

/**
 * Last gate on what actually ships, run on the packed output. prepare-standalone
 * only sees the Next standalone dir — but app.asar is assembled by electron-builder
 * from `build.files`, and that is where the Jul-2026 installer carried the real
 * project .env (DB password, JWT/branch secrets, LICENSE_PRIVATE_KEY), .env.bak,
 * backups/*.db and *.dump files. Throwing here aborts the build before an
 * installer exists.
 */
function verifyPackagedApp(appOutDir) {
    const problems = [];
    const forbidden = (rel) => {
        const p = rel.split('\\').join('/').replace(/^\/+/, '');
        const name = p.split('/').pop().toLowerCase();
        if (p.split('/').includes('node_modules')) return null;
        if (name.startsWith('.env')) return '.env file';
        if (/\.(db|sqlite|dump|bak)$/.test(name)) return 'data file'; // not .sql: prisma/migrations ships
        if (name === 'activation_params.json' || name === 'dump.txt') return 'dev data';
        if (/^(backups|mobile|specs|marketing_video)\//.test(p)) return 'project folder';
        return null;
    };

    const asarPath = path.join(appOutDir, 'resources', 'app.asar');
    if (fs.existsSync(asarPath)) {
        const asar = require('@electron/asar');
        for (const entry of asar.listPackage(asarPath)) {
            const why = forbidden(entry);
            if (why) problems.push(`app.asar: ${entry} (${why})`);
        }
    }

    const serverDir = path.join(appOutDir, 'resources', 'server');
    const walk = (dir, base) => {
        if (!fs.existsSync(dir)) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name === 'node_modules') continue;
            const rel = base ? `${base}/${e.name}` : e.name;
            if (e.isDirectory()) { walk(path.join(dir, e.name), rel); continue; }
            // The generated minimal .env and the verified clean dev.db are expected.
            if (rel === '.env' || rel === 'dev.db') continue;
            const why = forbidden(rel);
            if (why) problems.push(`resources/server/${rel} (${why})`);
        }
    };
    walk(serverDir, '');

    const shippedEnv = path.join(serverDir, '.env');
    const SECRET_KEYS = /(^|\n)\s*(DATABASE_URL|JWT_SECRET|REFRESH_TOKEN_SECRET|BRANCH_TOKEN_SECRET|LICENSE_PRIVATE_KEY|CRON_SECRET|GEMINI_API_KEY|OPENAI_API_KEY)=/;
    if (fs.existsSync(shippedEnv) && SECRET_KEYS.test(fs.readFileSync(shippedEnv, 'utf8'))) {
        problems.push('resources/server/.env contains cloud secrets');
    }

    if (problems.length) {
        throw new Error('afterPack: refusing to build an installer that ships private data:\n  - ' + problems.slice(0, 50).join('\n  - '));
    }
    console.log('afterPack: packaged app verified — no secrets or data files in app.asar or resources/server');
}
