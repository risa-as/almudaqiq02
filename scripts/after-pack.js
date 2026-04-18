/**
 * afterPack hook — runs after electron-builder finishes packing.
 *
 * Problem: electron-builder ALWAYS excludes **/node_modules/** from
 * extraResources (it's hard-coded in its default filter patterns).
 * This means the Next.js standalone server's node_modules never make
 * it into resources/server/, so server.js crashes immediately with
 * "Cannot find module 'next'" and the app shows a white screen.
 *
 * Fix: we copy the two missing node_modules directories here, after
 * electron-builder has finished, bypassing its filter system entirely.
 */

const path = require('path');
const fs = require('fs');

module.exports = async function afterPack(context) {
    const appOutDir = context.appOutDir;                        // e.g. dist/win-unpacked
    const serverDest = path.join(appOutDir, 'resources', 'server');
    const standaloneSrc = path.join(__dirname, '..', '.next', 'standalone');

    const targets = [
        // 1. The standalone's own node_modules (next, react, prisma, etc.)
        {
            src: path.join(standaloneSrc, 'node_modules'),
            dest: path.join(serverDest, 'node_modules'),
            label: 'standalone/node_modules',
        },
        // 2. Next.js internal node_modules used by SSR routes
        {
            src: path.join(standaloneSrc, '.next', 'node_modules'),
            dest: path.join(serverDest, '.next', 'node_modules'),
            label: '.next/node_modules',
        },
    ];

    for (const { src, dest, label } of targets) {
        if (!fs.existsSync(src)) {
            console.log(`afterPack: ${label} — not found, skipping`);
            continue;
        }
        console.log(`afterPack: copying ${label} …`);
        fs.cpSync(src, dest, { recursive: true });
        console.log(`afterPack: ${label} — done`);
    }
};
