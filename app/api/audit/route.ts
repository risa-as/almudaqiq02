import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { guardFeature } from '@/lib/plan-features';
import { readBranchFilter } from '@/lib/branch-scope';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthContext();
        if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
        const blocked = await guardFeature('audit_log'); if (blocked) return blocked;
        const { tenantId } = auth;

        const { searchParams } = new URL(request.url);
        const action     = searchParams.get('action');
        const entity     = searchParams.get('entity');
        const username   = searchParams.get('username');
        const period     = searchParams.get('period') || 'all';
        const limit      = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1), 1000);

        // Branch managers see their own branch's trail only.
        const branchFilter = readBranchFilter(auth, searchParams.get('branchId'));

        let dateFrom: Date | undefined;
        const now = new Date();
        if (period === 'today') { dateFrom = new Date(now); dateFrom.setHours(0,0,0,0); }
        else if (period === 'week')  { dateFrom = new Date(now.getTime() - 7 * 86400000); }
        else if (period === 'month') { dateFrom = new Date(now.getTime() - 30 * 86400000); }

        const where: any = {
            // Strictly this tenant: rows without a tenantId are platform-level and
            // must never be listed to an organisation.
            tenantId,
            ...branchFilter,
            ...(action   ? { action }   : {}),
            ...(entity   ? { entity }   : {}),
            ...(username ? { username: { contains: username } } : {}),
            ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
        };

        const [logs, totalCount, actionGroups, entityGroups, userGroups] = await Promise.all([
            prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
            prisma.auditLog.count({ where: { tenantId, ...branchFilter } }),
            prisma.auditLog.groupBy({ by: ['action'], where: { tenantId, ...branchFilter }, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
            prisma.auditLog.groupBy({ by: ['entity'], where: { tenantId, ...branchFilter }, _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
            prisma.auditLog.groupBy({ by: ['username'], where: { tenantId, ...branchFilter }, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
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
