import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getMachineId } from '@/lib/machineId';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const settings = await prisma.storeSettings.findFirst();

        if (!settings?.activationKey) {
            return NextResponse.json({ status: 'INACTIVE', message: 'لم يتم التفعيل بعد' });
        }

        const secretKey = process.env.LICENSE_SECRET_KEY;
        if (!secretKey) {
            return NextResponse.json({ status: 'INACTIVE', message: 'خطأ في تكوين النظام' });
        }

        const secret = new TextEncoder().encode(secretKey);
        const now = new Date();

        // === ANTI-CLOCK-ROLLBACK CHECK ===
        // If the current system date is BEFORE the last known valid date, the client
        // is attempting to extend their license by rolling back the system clock.
        if (settings.lastActiveDate) {
            const lastActive = new Date(settings.lastActiveDate);
            // Add 1 minute grace to prevent false positives on fast subsequent checks
            const gracePeriod = 60 * 1000;
            if (now.getTime() < lastActive.getTime() - gracePeriod) {
                // Clock was rolled back — lock the system immediately
                await prisma.storeSettings.update({
                    where: { id: settings.id },
                    data: { systemStatus: 'EXPIRED' }
                });
                return NextResponse.json({
                    status: 'EXPIRED',
                    message: 'تم اكتشاف تلاعب بتاريخ النظام. تم قفل الترخيص.'
                });
            }
        }

        // Verify JWT signature
        let payload: any;
        try {
            const result = await jwtVerify(settings.activationKey, secret);
            payload = result.payload;
        } catch (jwtError: any) {
            const newStatus = jwtError?.code === 'ERR_JWT_EXPIRED' ? 'EXPIRED' : 'INACTIVE';
            await prisma.storeSettings.update({
                where: { id: settings.id },
                data: { systemStatus: newStatus }
            });
            return NextResponse.json({ status: newStatus, message: 'انتهت صلاحية الترخيص أو هو غير صالح' });
        }

        // Check expiry from payload
        const expiresAtStr = payload.expiresAt as string;
        if (expiresAtStr && expiresAtStr !== 'LIFETIME') {
            const expiresAt = new Date(expiresAtStr);
            if (now > expiresAt) {
                await prisma.storeSettings.update({
                    where: { id: settings.id },
                    data: { systemStatus: 'EXPIRED' }
                });
                return NextResponse.json({ status: 'EXPIRED', message: 'انتهت صلاحية الترخيص', expiresAt: expiresAtStr });
            }
        }

        // === MACHINE ID / HARDWARE BINDING CHECK ===
        const allowedMachineId = payload.allowedMachineId as string | null;
        if (allowedMachineId) {
            const currentMachineId = getMachineId();
            if (currentMachineId.toLowerCase() !== allowedMachineId.toLowerCase()) {
                // Machine doesn't match — lock the system
                await prisma.storeSettings.update({
                    where: { id: settings.id },
                    data: { systemStatus: 'EXPIRED' }
                });
                return NextResponse.json({
                    status: 'MACHINE_MISMATCH',
                    message: 'تم اكتشاف عدم تطابق بصمة الجهاز. تم قفل النظام.'
                });
            }
        }

        // All good — update lastActiveDate and systemStatus
        await prisma.storeSettings.update({
            where: { id: settings.id },
            data: { systemStatus: 'ACTIVE', lastActiveDate: now }
        });

        const daysRemaining = expiresAtStr && expiresAtStr !== 'LIFETIME'
            ? Math.ceil((new Date(expiresAtStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        return NextResponse.json({
            status: 'ACTIVE',
            clientName: payload.clientName,
            duration: payload.duration,
            expiresAt: expiresAtStr,
            daysRemaining,
            isLifetime: expiresAtStr === 'LIFETIME',
        });

    } catch (error) {
        console.error('License Status Error:', error);
        return NextResponse.json({ status: 'INACTIVE', message: 'خطأ في قراءة حالة الترخيص' });
    }
}
