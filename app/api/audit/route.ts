import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const tenantId = await getTenantId();
        if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

        const callerRole = request.headers.get('x-user-role') || 'CASHIER';
        const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'].includes(callerRole);

        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get('branchId');
        const branchFilter = branchId && branchId !== 'all' ? { branchId } : {};

        const logs = await prisma.auditLog.findMany({
            where: { tenantId, ...branchFilter },
            orderBy: { createdAt: 'desc' },
            take: 200
        });

        return NextResponse.json(logs);
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
