import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'
import { getAuthContext } from '@/lib/api-helpers'
import { guardFeature } from '@/lib/plan-features'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = await guardFeature('branch_comparison'); if (blocked) return blocked
  const tenantId = auth.tenantId
  const { searchParams } = request.nextUrl
  const startDate = searchParams.get('startDate')
    ? new Date(searchParams.get('startDate')!)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const endDate = searchParams.get('endDate')
    ? new Date(searchParams.get('endDate')!)
    : new Date()
  endDate.setHours(23, 59, 59, 999)

  // BRANCH_MANAGER sees only their own branch (server-side enforcement)
  const branchFilter: { tenantId: string; isActive: boolean; id?: string } = { tenantId, isActive: true }
  if (auth.role === 'BRANCH_MANAGER' && auth.branchId) {
    branchFilter.id = auth.branchId
  }

  const branches = await prisma.branch.findMany({
    where: branchFilter,
    select: { id: true, name: true },
  })

  const results = await Promise.all(branches.map(async (branch) => {
    const [salesAgg, saleCogs, refundCogs, expenseAgg, refundAgg, paymentTxs] = await Promise.all([
      prisma.transaction.aggregate({
        where: { tenantId, branchId: branch.id, type: 'SALE', date: { gte: startDate, lte: endDate } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // COGS of goods sold (SALE) and the COGS reversed by returns (REFUND/RETURN)
      prisma.transactionItem.aggregate({
        where: { transaction: { tenantId, branchId: branch.id, type: 'SALE', date: { gte: startDate, lte: endDate } } },
        _sum: { cost: true },
      }),
      prisma.transactionItem.aggregate({
        where: { transaction: { tenantId, branchId: branch.id, type: { in: ['REFUND', 'RETURN'] }, date: { gte: startDate, lte: endDate } } },
        _sum: { cost: true },
      }),
      prisma.expense.aggregate({
        where: { tenantId, branchId: branch.id, date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
      // Fetched (not aggregated) to normalise the sign: REFUND is +amount,
      // legacy RETURN is -amount; both are positive "money returned".
      prisma.transaction.findMany({
        where: { tenantId, branchId: branch.id, type: { in: ['REFUND', 'RETURN'] }, date: { gte: startDate, lte: endDate } },
        select: { type: true, totalAmount: true },
      }),
      prisma.transaction.findMany({
        where: { tenantId, branchId: branch.id, type: 'SALE', date: { gte: startDate, lte: endDate } },
        select: { paymentMethod: true, totalAmount: true }
      }),
    ])

    const totalSales    = Number(salesAgg._sum.totalAmount ?? 0)
    const totalExpenses = Number(expenseAgg._sum.amount ?? 0)
    const saleCount     = salesAgg._count.id
    const avgTicket     = saleCount > 0 ? totalSales / saleCount : 0
    const refundTotal   = refundAgg.reduce((s: number, t: any) =>
        s + (t.type === 'REFUND' ? Number(t.totalAmount) : -Number(t.totalAmount)), 0)
    const refundCount   = refundAgg.length
    const refundRate    = totalSales > 0 ? (refundTotal / totalSales) * 100 : 0
    // Net profit = (gross sales − returns) − net COGS − expenses
    const cogs          = Number(saleCogs._sum.cost ?? 0) - Number(refundCogs._sum.cost ?? 0)
    const netProfit     = (totalSales - refundTotal) - cogs - totalExpenses

    const payMap: Record<string, number> = { CASH: 0, CARD: 0, CREDIT: 0 }
    for (const tx of paymentTxs) {
      const m = tx.paymentMethod ?? 'CASH'
      payMap[m] = (payMap[m] ?? 0) + Number(tx.totalAmount)
    }

    return {
      branchId:   branch.id,
      branchName: branch.name,
      totalSales,
      netRevenue: totalSales - refundTotal,
      totalExpenses,
      netProfit,
      saleCount,
      avgTicket:  Math.round(avgTicket),
      refundTotal,
      refundCount,
      refundRate: Math.round(refundRate * 10) / 10,
      cashSales:   payMap.CASH,
      cardSales:   payMap.CARD,
      creditSales: payMap.CREDIT,
    }
  }))

  results.sort((a, b) => b.totalSales - a.totalSales)

  const totals = {
    totalSales:    results.reduce((s, b) => s + b.totalSales, 0),
    netRevenue:    results.reduce((s, b) => s + b.netRevenue, 0),
    refundTotal:   results.reduce((s, b) => s + b.refundTotal, 0),
    totalExpenses: results.reduce((s, b) => s + b.totalExpenses, 0),
    netProfit:     results.reduce((s, b) => s + b.netProfit, 0),
    saleCount:     results.reduce((s, b) => s + b.saleCount, 0),
  }

  return NextResponse.json({ branches: results, totals, startDate, endDate })
}
