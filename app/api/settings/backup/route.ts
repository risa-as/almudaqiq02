import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST() {
    try {
        let dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        if (!fs.existsSync(dbPath)) {
            dbPath = path.join(process.cwd(), 'dev.db');
        }

        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({ error: 'لم يتم العثور على قاعدة البيانات للنسخ.' }, { status: 404 });
        }

        // In development, store backups in project root/backups. 
        // In production standalone, process.cwd() is server dir, store in server/backups.
        const backupsDir = path.join(process.cwd(), 'backups');

        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }

        const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `backup-${dateStr}.db`;
        const destPath = path.join(backupsDir, backupFileName);

        fs.copyFileSync(dbPath, destPath);

        return NextResponse.json({
            success: true,
            message: 'تم أخذ نسخة احتياطية بنجاح!',
            file: backupFileName,
            location: destPath
        });
    } catch (error) {
        console.error('Backup error:', error);
        return NextResponse.json({ error: 'حدث خطأ أثناء أخذ النسخة الاحتياطية' }, { status: 500 });
    }
}
