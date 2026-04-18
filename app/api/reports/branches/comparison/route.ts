import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ?? ''
  const { searchParams } = request.nextUrl
  const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const endDate   = searchParams.get('endDate')   ? new Date(searchParams.get('endDate')!)   : new Date()

  const branches = await prisma.branch.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true },
  })

  const results = await Promise.all(branches.map(async (branch) => {
    const [salesAgg, txCount, expenseAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { tenantId, branchId: branch.id, type: 'SALE', date: { gte: startDate, lte: endDate } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      prisma.transaction.count({
        where: { tenantId, branchId: branch.id, date: { gte: startDate, lte: endDate } },
      }),
      prisma.expense.aggregate({
        where: { tenantId, branchId: branch.id, date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
    ])

    const totalSales   = Number(salesAgg._sum.totalAmount ?? 0)
    const totalExpenses = Number(expenseAgg._sum.amount ?? 0)
    const saleCount    = salesAgg._count.id
    const avgTicket    = saleCount > 0 ? totalSales / saleCount : 0

    return {
      branchId:   branch.id,
      branchName: branch.name,
      totalSales,
      totalExpenses,
      netProfit: totalSales - totalExpenses,
      saleCount,
      avgTicket: Math.round(avgTicket),
    }
  }))

  // Sort by total sales descending
  results.sort((a, b) => b.totalSales - a.totalSales)

  return NextResponse.json({ branches: results, startDate, endDate })
}
