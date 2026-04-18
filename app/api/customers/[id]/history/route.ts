import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } // Correct type for Next.js 15+ App Router
) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const { id } = await context.params;
        const customerId = id;

        if (!customerId) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        // Verify the customer belongs to this tenant
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, tenantId }
        });

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const transactions = await prisma.transaction.findMany({
            where: { customerId, tenantId },
            orderBy: { date: 'desc' },
            take: 50, // Limit to last 50 transactions
            include: {
                items: {
                    include: {
                        product: { select: { name: true } },
                        unit: { select: { name: true } }
                    }
                }
            }
        });

        return NextResponse.json(transactions);

    } catch (error) {
        console.error('Fetch History Error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
