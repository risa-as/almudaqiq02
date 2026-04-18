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

    // [New] Copy dev.db (Database)
    const sourceDb = path.join(projectRoot, 'dev.db');
    const destDb = path.join(projectRoot, '.next/standalone/dev.db');
    if (fs.existsSync(sourceDb)) {
        console.log('Copying database (dev.db)...');
        // We copy it to the root of standalone so it sits next to server.js
        cpSync(sourceDb, destDb);
    } else {
        console.warn('WARNING: dev.db not found! The installed app will start with no database.');
    }

    // Copy .env file so loadEnvFile() in electron/main.js can find it
    const sourceEnv = path.join(projectRoot, '.env');
    const destEnv = path.join(projectRoot, '.next/standalone/.env');
    if (fs.existsSync(sourceEnv)) {
        console.log('Copying .env file...');
        fs.copyFileSync(sourceEnv, destEnv);
    } else {
        console.warn('WARNING: .env not found! Server will lack DATABASE_URL and other secrets.');
    }

    console.log('Standalone build prepared successfully!');
} catch (error) {
    console.error('Error preparing standalone build:', error);
    process.exit(1);
}
