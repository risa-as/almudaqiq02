'use client';
import { useEffect, useRef } from 'react';

export const BACKUP_INTERVAL_KEY = 'backupIntervalHours';
const DEFAULT_HOURS = 6;

async function runBackup(electronAPI?: any) {
    try {
        const res = await fetch('/api/settings/backup', { method: 'POST' });
        if (!res.ok) return;
        const json = await res.text();
        const dateStr = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const filename = `backup-auto-${dateStr}.json`;

        if (electronAPI?.save) {
            // Desktop: save to userData/backups/ via IPC
            await electronAPI.save(json, filename);
        } else {
            // Web: trigger browser download
            const blob = new Blob([json], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (err) {
        console.error('[AutoBackup] failed:', err);
    }
}

export function useAutoBackup() {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const el = (window as any).electron;
        const isElectron = Boolean(el?.isElectron);

        if (isElectron) {
            // Electron: main process owns the schedule, renderer just responds to requests
            el.backup?.onRequest?.(() => runBackup(el.backup));
            el.backup?.onRequestQuit?.(async () => {
                await runBackup(el.backup);
                el.backup?.doneQuit?.();
            });
            return () => el.backup?.removeListeners?.();
        }

        // Web: client-side interval
        function start(hours: number) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => runBackup(), hours * 3_600_000);
        }

        const saved = parseInt(localStorage.getItem(BACKUP_INTERVAL_KEY) || '', 10);
        start(isNaN(saved) ? DEFAULT_HOURS : saved);

        // Re-start when settings page changes the interval
        const onIntervalChange = (e: Event) => start((e as CustomEvent<number>).detail);
        window.addEventListener('backupIntervalChanged', onIntervalChange);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            window.removeEventListener('backupIntervalChanged', onIntervalChange);
        };
    }, []);
}
