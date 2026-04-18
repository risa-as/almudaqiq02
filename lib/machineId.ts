import os from 'os';

/**
 * Returns the first physical MAC address of this machine.
 * Uses Node.js built-in os.networkInterfaces() — Node.js only, NOT Edge Runtime compatible.
 * Falls back to 'unknown' if no physical interface is found.
 */
export function getMachineId(): string {
    try {
        const nets = os.networkInterfaces();
        for (const interfaces of Object.values(nets)) {
            for (const iface of interfaces ?? []) {
                if (
                    !iface.internal &&
                    iface.mac &&
                    iface.mac !== '00:00:00:00:00:00'
                ) {
                    return iface.mac.toLowerCase();
                }
            }
        }
    } catch {
        // Should not happen in Node.js, but fail safely
    }
    return 'unknown';
}
