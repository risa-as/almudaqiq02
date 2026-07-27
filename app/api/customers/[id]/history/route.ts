import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';
import { RELATION_JOIN } from '@/lib/prisma-runtime';

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

        // الاستعلامان مستقلّان: الأول يتحقق من ملكية المستأجر للعميل، والثاني
        // مُقيَّد أصلًا بـ tenantId — فجلبهما بالتوازي لا يوسّع النطاق، ويظل
        // الردّ 404 قبل استعمال الفواتير إن لم يكن العميل تابعًا للمستأجر.
        // قياسًا: ~928ms ← ~431ms لاستعلام الفواتير وحده، ورحلة أقل بالتوازي.
        const [customer, transactions] = await Promise.all([
            prisma.customer.findFirst({
                where: { id: customerId, tenantId }
            }),
            prisma.transaction.findMany({
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
                },
                ...RELATION_JOIN,
            }),
        ]);

        if (!customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        return NextResponse.json(transactions);

    } catch (error) {
        console.error('Fetch History Error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
