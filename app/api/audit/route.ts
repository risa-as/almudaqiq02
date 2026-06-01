import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthContext();
        if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
        const { tenantId } = auth;

        const { searchParams } = new URL(request.url);
        const branchId   = searchParams.get('branchId');
        const action     = searchParams.get('action');
        const entity     = searchParams.get('entity');
        const username   = searchParams.get('username');
        const period     = searchParams.get('period') || 'all';
        const limit      = parseInt(searchParams.get('limit') || '200', 10);

        const branchFilter = branchId && branchId !== 'all' ? { branchId } : {};

        let dateFrom: Date | undefined;
        const now = new Date();
        if (period === 'today') { dateFrom = new Date(now); dateFrom.setHours(0,0,0,0); }
        else if (period === 'week')  { dateFrom = new Date(now.getTime() - 7 * 86400000); }
        else if (period === 'month') { dateFrom = new Date(now.getTime() - 30 * 86400000); }

        const where: any = {
            OR: [{ tenantId }, { tenantId: null }],
            ...branchFilter,
            ...(action   ? { action }   : {}),
            ...(entity   ? { entity }   : {}),
            ...(username ? { username: { contains: username } } : {}),
            ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
        };

        const [logs, totalCount, actionGroups, entityGroups, userGroups] = await Promise.all([
            prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
            prisma.auditLog.count({ where: { OR: [{ tenantId }, { tenantId: null }], ...branchFilter } }),
            prisma.auditLog.groupBy({ by: ['action'], where: { OR: [{ tenantId }, { tenantId: null }], ...branchFilter }, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
            prisma.auditLog.groupBy({ by: ['entity'], where: { OR: [{ tenantId }, { tenantId: null }], ...branchFilter }, _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
            prisma.auditLog.groupBy({ by: ['username'], where: { OR: [{ tenantId }, { tenantId: null }], ...branchFilter }, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
        ]);

        // Today count
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const todayCount = logs.filter(l => new Date(l.createdAt) >= todayStart).length;

        return NextResponse.json({
            logs,
            stats: {
                total:    totalCount,
                today:    todayCount,
                shown:    logs.length,
            },
            filters: {
                actions:  actionGroups.map((a: any) => ({ value: a.action, count: a._count.id })),
                entities: entityGroups.map((e: any) => ({ value: e.entity, count: e._count.id })),
                users:    userGroups.map((u: any) => ({ value: u.username ?? 'System', count: u._count.id })),
            }
        });
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
