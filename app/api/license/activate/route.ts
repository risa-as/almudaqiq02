import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getMachineId } from '@/lib/machineId';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { key } = await request.json();

        if (!key || typeof key !== 'string') {
            return NextResponse.json({ error: 'رمز التفعيل مطلوب' }, { status: 400 });
        }

        const secretKey = process.env.LICENSE_SECRET_KEY;
        if (!secretKey) {
            return NextResponse.json({ error: 'خطأ في تكوين النظام' }, { status: 500 });
        }

        const secret = new TextEncoder().encode(secretKey);

        let payload: any;
        try {
            const result = await jwtVerify(key, secret);
            payload = result.payload;
        } catch (jwtError: any) {
            // JWT signature invalid or malformed
            if (jwtError?.code === 'ERR_JWT_EXPIRED') {
                // Still try to update system status to EXPIRED
                await prisma.storeSettings.updateMany({
                    data: { systemStatus: 'EXPIRED' }
                });
                return NextResponse.json({ error: 'EXPIRED', message: 'انتهت صلاحية رمز التفعيل' }, { status: 400 });
            }
            return NextResponse.json({ error: 'INVALID', message: 'رمز التفعيل غير صحيح أو مزيف' }, { status: 400 });
        }

        const now = new Date();

        // Check expiry in payload (handles LIFETIME case where no exp field)
        const expiresAtStr = payload.expiresAt as string;
        if (expiresAtStr && expiresAtStr !== 'LIFETIME') {
            const expiresAt = new Date(expiresAtStr);
            if (now > expiresAt) {
                await prisma.storeSettings.updateMany({
                    data: { systemStatus: 'EXPIRED' }
                });
                return NextResponse.json({ error: 'EXPIRED', message: 'انتهت صلاحية رمز التفعيل' }, { status: 400 });
            }
        }

        // === MACHINE ID / HARDWARE BINDING CHECK ===
        const allowedMachineId = payload.allowedMachineId as string | null;
        if (allowedMachineId) {
            const currentMachineId = getMachineId();
            if (currentMachineId.toLowerCase() !== allowedMachineId.toLowerCase()) {
                return NextResponse.json({
                    error: 'MACHINE_MISMATCH',
                    message: 'هذا الترخيص غير متوافق مع هذا الجهاز. يرجى التواصل مع المطور.'
                }, { status: 400 });
            }
        }

        // Valid license — save to DB, mark ACTIVE, update lastActiveDate
        const settings = await prisma.storeSettings.findFirst();
        if (settings) {
            await prisma.storeSettings.update({
                where: { id: settings.id },
                data: {
                    activationKey: key,
                    systemStatus: 'ACTIVE',
                    lastActiveDate: now,
                }
            });
        } else {
            await prisma.storeSettings.create({
                data: {
                    activationKey: key,
                    systemStatus: 'ACTIVE',
                    lastActiveDate: now,
                }
            });
        }

        // Calculate days remaining
        let daysRemaining: number | null = null;
        if (expiresAtStr && expiresAtStr !== 'LIFETIME') {
            daysRemaining = Math.ceil((new Date(expiresAtStr).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Set license_valid cookie (read by middleware to avoid DB calls on every request)
        const expiresAtDate = expiresAtStr !== 'LIFETIME' ? new Date(expiresAtStr) : new Date('2099-12-31');
        const response = NextResponse.json({
            success: true,
            message: 'تم تفعيل النظام بنجاح 🎉',
            clientName: payload.clientName,
            duration: payload.duration,
            expiresAt: expiresAtStr,
            daysRemaining,
        });

        response.cookies.set('license_status', 'ACTIVE', {
            httpOnly: true,
            path: '/',
            expires: expiresAtDate,
            sameSite: 'lax',
        });

        return response;

    } catch (error) {
        console.error('License Activate Error:', error);
        return NextResponse.json({ error: 'فشل في التفعيل' }, { status: 500 });
    }
}
