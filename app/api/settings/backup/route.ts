import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/settings/backup — list last 20 backup logs for this tenant
export async function GET() {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId } = auth;

    try {
        const logs = await prisma.auditLog.findMany({
            where:   { tenantId, action: 'BACKUP' },
            orderBy: { createdAt: 'desc' },
            take:    20,
            select:  { id: true, createdAt: true, details: true, username: true },
        });

        return NextResponse.json(logs.map(l => {
            let sizeKb: number | null = null;
            try { sizeKb = JSON.parse(l.details || '{}').sizeKb ?? null; } catch { /* ignore */ }
            return { id: l.id, createdAt: l.createdAt, username: l.username, sizeKb };
        }));
    } catch (error) {
        console.error('Backup list error:', error);
        return NextResponse.json({ error: 'فشل جلب السجل' }, { status: 500 });
    }
}

// POST /api/settings/backup — export full tenant data as JSON (download)
export async function POST() {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId, branchId } = auth;

    try {
        // Fetch current user's username for the log
        const userRecord = userId
            ? await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
            : null;
        const username = userRecord?.username ?? 'system';

        // Fetch all tenant data in parallel
        const [
            products,
            categories,
            suppliers,
            customers,
            branches,
            transactions,
            productBatches,
            offers,
            expenses,
            storeSettings,
        ] = await Promise.all([
            prisma.product.findMany({
                where:   { tenantId },
                include: { units: true, category: { select: { name: true } }, supplier: { select: { name: true } } },
            }),
            prisma.category.findMany({ where: { tenantId } }),
            prisma.supplier.findMany({ where: { tenantId } }),
            prisma.customer.findMany({ where: { tenantId } }),
            prisma.branch.findMany({ where: { tenantId } }),
            prisma.transaction.findMany({
                where:   { tenantId },
                include: { items: true },
                orderBy: { date: 'desc' },
                take:    5000,
            }),
            prisma.productBatch.findMany({ where: { tenantId } }),
            prisma.offer.findMany({ where: { tenantId } }),
            prisma.expense.findMany({ where: { tenantId } }),
            prisma.storeSettings.findFirst({ where: { tenantId } }),
        ]);

        const payload = {
            exportedAt: new Date().toISOString(),
            tenantId,
            products,
            categories,
            suppliers,
            customers,
            branches,
            transactions,
            productBatches,
            offers,
            expenses,
            storeSettings,
        };

        const json    = JSON.stringify(payload, null, 2);
        const sizeKb  = Math.round(Buffer.byteLength(json, 'utf8') / 1024);
        const dateStr = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

        // Log via the shared helper (handles its own errors gracefully)
        await logAction(
            'BACKUP',
            'System',
            tenantId,
            JSON.stringify({ sizeKb }),
            username,
            tenantId,
            branchId ?? undefined,
        );

        return new NextResponse(json, {
            status: 200,
            headers: {
                'Content-Type':        'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="backup-${dateStr}.json"`,
                'X-Backup-Size-KB':    String(sizeKb),
            },
        });
    } catch (error) {
        console.error('Backup error:', error);
        return NextResponse.json({ error: 'فشل إنشاء النسخة الاحتياطية' }, { status: 500 });
    }
}
