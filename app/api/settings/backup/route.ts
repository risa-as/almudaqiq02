import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/settings/backup — list last 20 backup logs for the selected branch
export async function GET(request: Request) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId } = auth;

    try {
        // Backup history is per-branch. Owners see the branch selected in the UI;
        // branch-bound users see only their own branch's backups.
        const param = new URL(request.url).searchParams.get('branchId');
        const isOwner = auth.role === 'ADMIN' || auth.role === 'SUPER_ADMIN';
        const specificBranch = !isOwner && auth.branchId
            ? auth.branchId
            : (param && param !== 'all' ? param : null);

        const logs = await prisma.auditLog.findMany({
            where:   { tenantId, action: 'BACKUP', ...(specificBranch ? { branchId: specificBranch } : {}) },
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

// POST /api/settings/backup — export tenant data as JSON (download).
// When a specific branch is selected the export is scoped to THAT branch's data
// (its transactions, stock batches, expenses, settings + its/org customers & offers);
// owners viewing "all branches" get the full tenant backup.
export async function POST(request: Request) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId } = auth;

    try {
        const body = await request.json().catch(() => ({} as any));
        const requested = (body?.branchId as string | undefined) ?? undefined;
        // Owners (ADMIN / SUPER_ADMIN) back up the branch selected in the UI even if
        // their token carries a branchId; branch-bound users are locked to their own.
        const isOwner = auth.role === 'ADMIN' || auth.role === 'SUPER_ADMIN';
        const specificBranch = !isOwner && auth.branchId
            ? auth.branchId
            : (requested && requested !== 'all' ? requested : null);

        const branchOnly = specificBranch ? { branchId: specificBranch } : {};
        // Customers / offers are branch-scoped but include org-level rows (branchId = null).
        const branchOrOrg = specificBranch
            ? { OR: [{ branchId: specificBranch }, { branchId: null }] }
            : {};

        // Fetch current user's username for the log
        const userRecord = userId
            ? await prisma.user.findUnique({ where: { id: userId }, select: { username: true } })
            : null;
        const username = userRecord?.username ?? 'system';

        // Fetch tenant data in parallel (branch-owned entities scoped to the branch)
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
            prisma.customer.findMany({ where: { tenantId, ...branchOrOrg } }),
            prisma.branch.findMany({ where: { tenantId, ...(specificBranch ? { id: specificBranch } : {}) } }),
            prisma.transaction.findMany({
                where:   { tenantId, ...branchOnly },
                include: { items: true },
                orderBy: { date: 'desc' },
                take:    5000,
            }),
            prisma.productBatch.findMany({ where: { tenantId, ...branchOnly } }),
            prisma.offer.findMany({ where: { tenantId, ...branchOrOrg } }),
            prisma.expense.findMany({ where: { tenantId, ...branchOnly } }),
            specificBranch
                ? prisma.storeSettings.findFirst({ where: { tenantId, branchId: specificBranch } })
                : prisma.storeSettings.findFirst({ where: { tenantId } }),
        ]);

        const payload = {
            exportedAt: new Date().toISOString(),
            tenantId,
            branchId: specificBranch,
            scope: specificBranch ? 'branch' : 'tenant',
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
            specificBranch ?? auth.branchId ?? undefined,
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
