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
};
