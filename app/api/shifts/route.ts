import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId } = auth;

    try {
        // Get the active shift for this user within this tenant
        const activeShift = await prisma.cashierShift.findFirst({
            where: {
                tenantId,
                userId,
                closedAt: null
            }
        });

        return NextResponse.json({ activeShift });
    } catch (error) {
        console.error('Error fetching shift:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const { tenantId, userId, branchId: authBranchId } = auth;

    try {
        const body = await request.json();
        const branchId = body.branchId || authBranchId;
        if (!branchId || branchId === 'all') return NextResponse.json({ error: 'الرجاء اختيار فرع محدد لفتح الوردية (لا يمكن فتح وردية لكل الفروع)' }, { status: 400 });

        // Check if there's already an open shift for this user in this tenant
        const existingShift = await prisma.cashierShift.findFirst({
            where: {
                tenantId,
                userId,
                closedAt: null
            }
        });

        if (existingShift) {
            return NextResponse.json({ error: 'يوجد وردية مفتوحة بالفعل' }, { status: 400 });
        }

        const newShift = await prisma.cashierShift.create({
            data: {
                tenant: { connect: { id: tenantId } },
                branch: { connect: { id: branchId } },
                user: { connect: { id: userId } },
                openingAmount: Number(body.openingAmount || 0),
                openedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, shift: newShift });
    } catch (error) {
        console.error('Error opening shift:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
