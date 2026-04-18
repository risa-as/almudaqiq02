import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const branchId = searchParams.get('branchId');
    const branchFilter = branchId && branchId !== 'all' ? { branchId } : {};

    try {
        const shifts = await (prisma as any).cashierShift.findMany({
            where: { tenantId, ...branchFilter },
            orderBy: { openedAt: 'desc' },
            take: limit,
            include: {
                user: { select: { username: true } }
            }
        });

        return NextResponse.json(shifts);
    } catch (error) {
        console.error('Failed to fetch shifts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
