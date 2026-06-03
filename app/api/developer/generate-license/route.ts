import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Constant-time string compare that never short-circuits on length. */
function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        // Compare against self to keep timing uniform, then fail.
        timingSafeEqual(bufA, bufA);
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}

// How many ms to add for each duration type
const DURATION_MAP: Record<string, number | null> = {
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '6M': 180 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    'LIFETIME': null, // No expiry
};

// Parse custom day-based durations like "14d", "45d"
function parseDurationMs(duration: string): number | null {
    if (DURATION_MAP.hasOwnProperty(duration)) {
        return DURATION_MAP[duration];
    }
    // Match custom days format: Xd
    const match = duration.match(/^(\d+)d$/i);
    if (match) {
        const days = parseInt(match[1], 10);
        if (days > 0) return days * 24 * 60 * 60 * 1000;
    }
    return undefined as any; // invalid
}

export async function POST(request: NextRequest) {
    try {
        // Rate-limit by IP to thwart brute-forcing the developer password.
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
        const rl = checkRateLimit(`gen-license:${ip}`, { limit: 5, windowMs: 10 * 60_000 });
        if (!rl.allowed) {
            return NextResponse.json({ error: 'محاولات كثيرة جداً. حاول لاحقاً.' }, { status: 429 });
        }

        // Developer password check (constant-time) via header.
        const authHeader = request.headers.get('x-developer-password') ?? '';
        const developerPassword = process.env.DEVELOPER_PASSWORD;

        if (!developerPassword || developerPassword.length < 16 || !safeEqual(authHeader, developerPassword)) {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
        }

        const { clientName, duration, machineId, clientPhone, clientAddress } = await request.json();

        if (!clientName || !duration) {
            return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
        }

        const durationMs = parseDurationMs(duration);
        if (durationMs === undefined) {
            return NextResponse.json({ error: 'مدة ترخيص غير صحيحة' }, { status: 400 });
        }

        const secretKey = process.env.LICENSE_SECRET_KEY;
        if (!secretKey) {
            return NextResponse.json({ error: 'مفتاح التشفير غير مُعيَّن في البيئة' }, { status: 500 });
        }

        const secret = new TextEncoder().encode(secretKey);
        const issuedAt = new Date();
        const expiresAt = durationMs ? new Date(issuedAt.getTime() + durationMs) : null;

        // Build JWT payload
        const jwtBuilder = new SignJWT({
            clientName,
            duration,
            issuedAt: issuedAt.toISOString(),
            expiresAt: expiresAt ? expiresAt.toISOString() : 'LIFETIME',
            allowedMachineId: machineId ? machineId.toLowerCase().trim() : null,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt();

        // Only set expiration if not LIFETIME
        if (expiresAt) {
            jwtBuilder.setExpirationTime(expiresAt);
        }

        const licenseKey = await jwtBuilder.sign(secret);

        // Log generation in DB
        await prisma.licenseLog.create({
            data: {
                clientName,
                clientPhone: clientPhone || null,
                clientAddress: clientAddress || null,
                duration,
                expiresAt,
                licenseKey,
                machineId: machineId ? machineId.toLowerCase().trim() : null,
            }
        });

        return NextResponse.json({
            success: true,
            licenseKey,
            clientName,
            duration,
            expiresAt: expiresAt?.toISOString() ?? 'مدى الحياة',
        });

    } catch (error) {
        console.error('Generate License Error:', error);
        return NextResponse.json({ error: 'فشل توليد الترخيص' }, { status: 500 });
    }
}

// GET: List all generated licenses (developer only)
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('x-developer-password');
    const developerPassword = process.env.DEVELOPER_PASSWORD;

    if (!developerPassword || authHeader !== developerPassword) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const licenses = await prisma.licenseLog.findMany({
        orderBy: { generatedAt: 'desc' }
    });

    return NextResponse.json({ licenses });
}
