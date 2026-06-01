import { getTenantPrisma } from '@/lib/multi-tenant/prisma'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, addDays, parseISO, format } from 'date-fns'
import type { ToolDefinition } from './providers/interface'

type AuthContext = { tenantId: string; userId: string; role: string; branchId?: string | null }

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_sales_report',
    description: 'Get sales data for a date range. Use for questions about revenue, number of invoices, or sales trends.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date:   { type: 'string', description: 'End date YYYY-MM-DD' },
        branch_id:  { type: 'string', description: 'Optional branch UUID to filter' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_inventory_levels',
    description: 'Get current stock levels, inventory value, expiry alerts, and low-stock items.',
    parameters: {
      type: 'object',
      properties: {
        branch_id:      { type: 'string' },
        low_stock_only: { type: 'string', description: '"true" to return only low-stock/out-of-stock' },
        expiry_days:    { type: 'string', description: 'Alert for products expiring within N days (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_financial_summary',
    description: 'Get profit, revenue, cost, tax, and expense summary.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_top_products',
    description: 'Get best-selling products ranked by units sold.',
    parameters: {
      type: 'object',
      properties: {
        period:    { type: 'string', enum: ['today', 'week', 'month'] },
        limit:     { type: 'string', description: 'Number of products (default 10)' },
        branch_id: { type: 'string' },
      },
      required: ['period'],
    },
  },
  {
    name: 'get_branch_stats',
    description: 'Get revenue statistics for all branches.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_recent_transactions',
    description: 'Get the most recent transactions.',
    parameters: {
      type: 'object',
      properties: {
        limit:     { type: 'string', description: 'Number of transactions (default 10, max 50)' },
        branch_id: { type: 'string' },
        type:      { type: 'string', enum: ['SALE', 'RETURN', 'REFUND'] },
      },
      required: [],
    },
  },
  {
    name: 'get_shift_summary',
    description: 'Get cashier shift reports for a specific date.',
    parameters: {
      type: 'object',
      properties: {
        date:      { type: 'string', description: 'Specific date YYYY-MM-DD (default today)' },
        branch_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_discount_report',
    description: 'Get discount usage report per cashier.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
        branch_id:  { type: 'string' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_staff_performance',
    description: 'Get staff performance rankings by revenue and transaction count.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
        branch_id:  { type: 'string' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_customer_insights',
    description: 'Get customer loyalty, spending insights, and customers with debts.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_purchase_orders_summary',
    description: 'Get purchasing costs, supplier summary, and recent purchase batches.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_menu_performance',
    description: 'Analyze product performance to find slow-moving items.',
    parameters: {
      type: 'object',
      properties: {
        branch_id: { type: 'string' },
        days_back: { type: 'string', description: 'Look back N days (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_hourly_heatmap',
    description: 'Get hourly transaction heatmap to identify peak and slow hours.',
    parameters: {
      type: 'object',
      properties: {
        days_back: { type: 'string', description: 'Number of days to average (default 7)' },
        branch_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_offers_effectiveness',
    description: 'Measure how effective promotions are including usage count per offer.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'get_orders_analysis',
    description: 'Analyze transaction types, returns count, and average order value.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
        branch_id:  { type: 'string' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_expense_breakdown',
    description: 'Get expense categories and totals.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
        branch_id:  { type: 'string' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_product_margins',
    description: 'Get gross profit margin per product based on cost vs selling price. Use for questions about most/least profitable products.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
        branch_id:  { type: 'string' },
        limit:      { type: 'string', description: 'Number of products to return (default 20)' },
        sort:       { type: 'string', enum: ['margin_pct', 'gross_profit'], description: 'Sort by margin % or absolute profit' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_branch_profit_detail',
    description: 'Get detailed profit breakdown per branch including COGS and net profit. Use for branch profitability comparisons.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_stock_movements',
    description: 'Get stock movement history — what came in (purchases) and went out (sales) per product.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string' },
        end_date:   { type: 'string' },
        branch_id:  { type: 'string' },
        product_name: { type: 'string', description: 'Optional: filter by product name (partial match)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_supplier_prices',
    description: 'Compare supplier prices — show products per supplier with cost price history. Use for questions about supplier pricing.',
    parameters: {
      type: 'object',
      properties: {
        supplier_name: { type: 'string', description: 'Optional: filter by supplier name (partial match)' },
      },
      required: [],
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateRange(start: string, end: string) {
  return { gte: startOfDay(parseISO(start)), lte: endOfDay(parseISO(end)) }
}

function periodToRange(period: string) {
  const now = new Date()
  switch (period) {
    case 'today': return { gte: startOfDay(now), lte: endOfDay(now) }
    case 'week':  return { gte: startOfWeek(now, { weekStartsOn: 0 }), lte: endOfWeek(now, { weekStartsOn: 0 }) }
    case 'month': return { gte: startOfMonth(now), lte: endOfMonth(now) }
    default:      return { gte: startOfDay(now), lte: endOfDay(now) }
  }
}

// ─── Tool Executors ───────────────────────────────────────────────────────────

async function getSalesReport(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)
  const branchId = args.branch_id ?? auth.branchId ?? undefined

  const where: any = { type: 'SALE', date: dateRange }
  if (branchId) where.branchId = branchId

  const transactions = await db.transaction.findMany({
    where,
    include: { items: true, branch: { select: { name: true } } },
    orderBy: { date: 'asc' },
  })

  const totalRevenue = transactions.reduce((s: number, t: any) => s + Number(t.totalAmount), 0)
  const itemsSold    = transactions.reduce((s: number, t: any) => s + t.items.reduce((si: number, i: any) => si + Number(i.quantity), 0), 0)

  const byDay: Record<string, { date: string; revenue: number; transactions: number }> = {}
  for (const t of transactions) {
    const key = format(new Date(t.date), 'yyyy-MM-dd')
    if (!byDay[key]) byDay[key] = { date: key, revenue: 0, transactions: 0 }
    byDay[key].revenue    += Number(t.totalAmount)
    byDay[key].transactions += 1
  }

  return {
    total_revenue:      Math.round(totalRevenue * 100) / 100,
    total_transactions: transactions.length,
    items_sold:         Math.round(Number(itemsSold)),
    period:             `${args.start_date} إلى ${args.end_date}`,
    by_day:             Object.values(byDay),
  }
}

async function getInventoryLevels(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const branchId   = args.branch_id ?? auth.branchId ?? undefined
  const lowStockOnly = args.low_stock_only === 'true'
  const expiryDays = parseInt(args.expiry_days ?? '30', 10)
  const expiryAlert = addDays(new Date(), expiryDays)

  const where: any = {}
  if (branchId) where.branchId = branchId

  const batches = await db.productBatch.findMany({
    where,
    include: {
      product: {
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true } },
          units:    { select: { price: true }, take: 1 },
        },
      },
    },
  })

  // Aggregate per product: quantity, total cost value, nearest expiry
  const productMap: Record<string, {
    name: string; category: string; supplier: string; sellPrice: number
    quantity: number; totalCostValue: number; nearestExpiry: Date | null
  }> = {}

  for (const b of batches) {
    const pid = b.productId
    const p   = (b as any).product
    if (!productMap[pid]) {
      productMap[pid] = {
        name:           p.name,
        category:       p.category?.name ?? 'غير مصنّف',
        supplier:       p.supplier?.name ?? 'غير محدد',
        sellPrice:      Number(p.units?.[0]?.price ?? 0),
        quantity:       0,
        totalCostValue: 0,
        nearestExpiry:  null,
      }
    }
    productMap[pid].quantity       += b.quantity
    productMap[pid].totalCostValue += Number(b.costPrice) * b.quantity
    if (b.expiryDate) {
      const exp = new Date(b.expiryDate)
      if (!productMap[pid].nearestExpiry || exp < productMap[pid].nearestExpiry!) {
        productMap[pid].nearestExpiry = exp
      }
    }
  }

  const products = Object.entries(productMap).map(([id, p]) => ({
    id,
    name:            p.name,
    category:        p.category,
    supplier:        p.supplier,
    quantity:        p.quantity,
    sell_price:      p.sellPrice,
    cost_value:      Math.round(p.totalCostValue * 100) / 100,
    retail_value:    Math.round(p.sellPrice * p.quantity * 100) / 100,
    potential_profit: Math.round((p.sellPrice * p.quantity - p.totalCostValue) * 100) / 100,
    status:          p.quantity <= 0 ? 'out' : p.quantity <= 5 ? 'low' : 'ok',
    expiry_date:     p.nearestExpiry ? format(p.nearestExpiry, 'yyyy-MM-dd') : null,
    expiry_status:   p.nearestExpiry
      ? (p.nearestExpiry <= new Date() ? 'expired' : p.nearestExpiry <= expiryAlert ? 'near' : 'ok')
      : 'no_expiry',
  }))

  const totalCostValue   = products.reduce((s, p) => s + p.cost_value, 0)
  const totalRetailValue = products.reduce((s, p) => s + p.retail_value, 0)
  const filtered         = lowStockOnly ? products.filter(p => p.status !== 'ok') : products
  const expiryAlerts     = products
    .filter(p => p.expiry_status === 'near' || p.expiry_status === 'expired')
    .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
  const mostValuable = [...products]
    .sort((a, b) => b.cost_value - a.cost_value)
    .slice(0, 10)

  return {
    total_products:       products.length,
    low_stock_count:      products.filter(p => p.status === 'low').length,
    out_of_stock_count:   products.filter(p => p.status === 'out').length,
    total_inventory_cost_value:   Math.round(totalCostValue * 100) / 100,
    total_inventory_retail_value: Math.round(totalRetailValue * 100) / 100,
    expiry_alerts_count:  expiryAlerts.length,
    expiry_alerts:        expiryAlerts.slice(0, 10),
    most_valuable_products: mostValuable.map(p => ({
      name: p.name, category: p.category, quantity: p.quantity, cost_value: p.cost_value,
    })),
    products: filtered.sort((a, b) => a.quantity - b.quantity).slice(0, 50),
  }
}

async function getFinancialSummary(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)

  const [salesAgg, expensesAgg, returns, settings] = await Promise.all([
    db.transaction.findMany({
      where: { type: 'SALE', date: dateRange },
      select: { totalAmount: true, discount: true, taxAmount: true },
    }),
    db.expense.findMany({ where: { date: dateRange }, select: { amount: true } }),
    db.transaction.findMany({
      where: { type: { in: ['RETURN', 'REFUND'] }, date: dateRange },
      select: { totalAmount: true },
    }),
    db.storeSettings.findFirst({ select: { taxRate: true } }),
  ])

  const grossRevenue  = salesAgg.reduce((s: number, t: any) => s + Number(t.totalAmount), 0)
  const totalDiscounts = salesAgg.reduce((s: number, t: any) => s + Number(t.discount ?? 0), 0)
  const totalTax      = salesAgg.reduce((s: number, t: any) => s + Number(t.taxAmount ?? 0), 0)
  const totalExpenses = expensesAgg.reduce((s: number, e: any) => s + Number(e.amount), 0)
  const totalReturns  = returns.reduce((s: number, t: any) => s + Number(t.totalAmount), 0)
  const netRevenue    = grossRevenue - totalReturns
  const netProfit     = netRevenue - totalExpenses
  const profitMargin  = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100) : 0
  const taxRate       = Number(settings?.taxRate ?? 0)

  return {
    gross_revenue:       Math.round(grossRevenue * 100) / 100,
    total_discounts:     Math.round(totalDiscounts * 100) / 100,
    total_returns:       Math.round(totalReturns * 100) / 100,
    net_revenue:         Math.round(netRevenue * 100) / 100,
    total_expenses:      Math.round(totalExpenses * 100) / 100,
    total_tax_collected: Math.round(totalTax * 100) / 100,
    tax_rate_configured: taxRate > 0 ? `${taxRate}%` : 'لم يتم ضبط نسبة الضريبة بعد',
    net_profit:          Math.round(netProfit * 100) / 100,
    profit_margin_pct:   profitMargin,
    period:              `${args.start_date} إلى ${args.end_date}`,
  }
}

async function getTopProducts(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = periodToRange(args.period)
  const limit     = Math.min(parseInt(args.limit ?? '10', 10), 50)
  const branchId  = args.branch_id ?? auth.branchId ?? undefined

  const txWhere: any = { type: 'SALE', date: dateRange }
  if (branchId) txWhere.branchId = branchId

  const transactions = await db.transaction.findMany({
    where: txWhere,
    include: {
      items: {
        include: {
          product: { include: { category: { select: { name: true } } } },
        },
      },
    },
  })

  const productTotals: Record<string, { name: string; category: string; units: number; revenue: number; cost: number }> = {}
  for (const tx of transactions) {
    for (const item of (tx as any).items) {
      const pid = item.productId
      if (!productTotals[pid]) {
        productTotals[pid] = {
          name: item.product.name,
          category: item.product.category?.name ?? 'غير مصنّف',
          units: 0, revenue: 0, cost: 0,
        }
      }
      productTotals[pid].units   += Number(item.quantity)
      productTotals[pid].revenue += Number(item.price) * Number(item.quantity)
      productTotals[pid].cost    += Number(item.cost ?? 0) * Number(item.quantity)
    }
  }

  const ranked = Object.values(productTotals)
    .sort((a, b) => b.units - a.units)
    .slice(0, limit)
    .map((p, i) => ({
      rank:         i + 1,
      name:         p.name,
      category:     p.category,
      units_sold:   Math.round(p.units),
      revenue:      Math.round(p.revenue * 100) / 100,
      gross_profit: Math.round((p.revenue - p.cost) * 100) / 100,
    }))

  return { period: args.period, products: ranked }
}

async function getBranchStats(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)

  const transactions = await db.transaction.findMany({
    where: { type: 'SALE', date: dateRange },
    include: { branch: { select: { name: true } } },
  })

  const branchMap: Record<string, { name: string; revenue: number; count: number }> = {}
  for (const t of transactions) {
    const bid = t.branchId
    if (!branchMap[bid]) branchMap[bid] = { name: (t as any).branch.name, revenue: 0, count: 0 }
    branchMap[bid].revenue += Number(t.totalAmount)
    branchMap[bid].count   += 1
  }

  const branches = Object.values(branchMap)
    .sort((a, b) => b.revenue - a.revenue)
    .map((b, i) => ({
      rank: i + 1,
      name: b.name,
      total_revenue:        Math.round(b.revenue * 100) / 100,
      total_transactions:   b.count,
      avg_transaction_value: b.count > 0 ? Math.round((b.revenue / b.count) * 100) / 100 : 0,
    }))

  return { branches, period: `${args.start_date} إلى ${args.end_date}` }
}

async function getRecentTransactions(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const limit    = Math.min(parseInt(args.limit ?? '10', 10), 50)
  const branchId = args.branch_id ?? auth.branchId ?? undefined

  const where: any = {}
  if (branchId) where.branchId = branchId
  if (args.type) where.type = args.type

  const txs = await db.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    take:     limit,
    include: {
      branch:  { select: { name: true } },
      user:    { select: { username: true } },
      items:   true,
      offer:   { select: { name: true } },
    },
  })

  return {
    transactions: txs.map((t: any) => ({
      id:           t.id.slice(-6).toUpperCase(),
      date:         format(new Date(t.date), 'yyyy-MM-dd HH:mm'),
      type:         t.type,
      amount:       Math.round(Number(t.totalAmount) * 100) / 100,
      discount:     Number(t.discount ?? 0),
      tax:          Number(t.taxAmount ?? 0),
      branch_name:  t.branch.name,
      cashier_name: t.user?.username ?? 'غير محدد',
      items_count:  t.items.length,
      offer_used:   t.offer?.name ?? null,
    })),
  }
}

async function getShiftSummary(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const targetDate = args.date ? parseISO(args.date) : new Date()
  const branchId   = args.branch_id ?? auth.branchId ?? undefined

  const where: any = { openedAt: { gte: startOfDay(targetDate), lte: endOfDay(targetDate) } }
  if (branchId) where.branchId = branchId

  const shifts = await db.cashierShift.findMany({
    where,
    include: {
      user:   { select: { username: true } },
      branch: { select: { name: true } },
    },
    orderBy: { openedAt: 'desc' },
  })

  const result = shifts.map((s: any) => ({
    cashier:      s.user.username,
    branch:       s.branch.name,
    opened_at:    format(new Date(s.openedAt), 'HH:mm'),
    closed_at:    s.closedAt ? format(new Date(s.closedAt), 'HH:mm') : 'لم تُغلق بعد',
    opening_cash: Number(s.openingAmount),
    closing_cash: Number(s.closingAmount ?? 0),
    expected:     Number(s.expectedAmount ?? 0),
    difference:   Number(s.difference ?? 0),
    status:       s.closedAt
      ? (Number(s.difference ?? 0) === 0 ? 'متطابق' : Number(s.difference ?? 0) > 0 ? 'فائض' : 'عجز')
      : 'مفتوحة',
  }))

  const totalDiff = result.reduce((s: number, r: any) => s + r.difference, 0)
  return {
    date:             format(targetDate, 'yyyy-MM-dd'),
    shifts:           result,
    total_shifts:     result.length,
    total_difference: Math.round(totalDiff * 100) / 100,
  }
}

async function getDiscountReport(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)
  const branchId  = args.branch_id ?? auth.branchId ?? undefined

  const where: any = { type: 'SALE', date: dateRange, discount: { gt: 0 } }
  if (branchId) where.branchId = branchId

  const txs = await db.transaction.findMany({
    where,
    include: { user: { select: { username: true } } },
  })

  const totalDiscount = txs.reduce((s: number, t: any) => s + Number(t.discount), 0)
  const totalRevenue  = txs.reduce((s: number, t: any) => s + Number(t.totalAmount), 0)

  const byCashier: Record<string, { name: string; count: number; total: number }> = {}
  for (const t of txs) {
    const name = (t as any).user?.username ?? 'غير محدد'
    if (!byCashier[name]) byCashier[name] = { name, count: 0, total: 0 }
    byCashier[name].count += 1
    byCashier[name].total += Number(t.discount)
  }

  return {
    period:                  `${args.start_date} إلى ${args.end_date}`,
    total_discount_amount:   Math.round(totalDiscount * 100) / 100,
    discounted_transactions: txs.length,
    discount_rate_pct:       totalRevenue > 0 ? Math.round((totalDiscount / (totalRevenue + totalDiscount)) * 100) : 0,
    by_cashier: Object.values(byCashier)
      .sort((a, b) => b.total - a.total)
      .map(c => ({ ...c, total: Math.round(c.total * 100) / 100, avg: Math.round((c.total / c.count) * 100) / 100 })),
  }
}

async function getStaffPerformance(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)
  const branchId  = args.branch_id ?? auth.branchId ?? undefined

  const where: any = { type: 'SALE', date: dateRange, userId: { not: null } }
  if (branchId) where.branchId = branchId

  const txs = await db.transaction.findMany({
    where,
    include: { user: { select: { username: true, role: true } } },
  })

  const staffMap: Record<string, { name: string; role: string; count: number; revenue: number }> = {}
  for (const t of txs) {
    if (!(t as any).user) continue
    const uid = t.userId!
    if (!staffMap[uid]) staffMap[uid] = { name: (t as any).user.username, role: (t as any).user.role, count: 0, revenue: 0 }
    staffMap[uid].count   += 1
    staffMap[uid].revenue += Number(t.totalAmount)
  }

  const staff = Object.values(staffMap)
    .sort((a, b) => b.revenue - a.revenue)
    .map((s, i) => ({
      rank:                  i + 1,
      name:                  s.name,
      role:                  s.role,
      total_transactions:    s.count,
      total_revenue:         Math.round(s.revenue * 100) / 100,
      avg_transaction_value: s.count > 0 ? Math.round((s.revenue / s.count) * 100) / 100 : 0,
    }))

  return { period: `${args.start_date} إلى ${args.end_date}`, staff }
}

async function getCustomerInsights(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)

  const customers = await db.customer.findMany({
    include: {
      transactions: {
        where: { type: 'SALE' },
        select: { totalAmount: true, date: true },
        orderBy: { date: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const withTx = customers.map((c: any) => ({
    id:             c.id,
    name:           c.name,
    phone:          c.phone,
    balance:        Number(c.balance ?? 0),
    purchase_count: c.transactions.length,
    total_spent:    c.transactions.reduce((s: number, t: any) => s + Number(t.totalAmount), 0),
    last_purchase:  c.transactions[0]?.date ? format(new Date(c.transactions[0].date), 'yyyy-MM-dd') : 'لا توجد',
  }))

  const repeat       = withTx.filter((c: any) => c.purchase_count > 1)
  const totalSpent   = withTx.reduce((s: number, c: any) => s + c.total_spent, 0)
  const top          = [...withTx].sort((a: any, b: any) => b.total_spent - a.total_spent).slice(0, 10)

  // Debtors: negative balance means they owe money
  const debtors = withTx
    .filter((c: any) => c.balance < 0)
    .sort((a: any, b: any) => a.balance - b.balance)
  const totalOutstandingDebt = debtors.reduce((s: number, c: any) => s + Math.abs(c.balance), 0)

  // Credit customers (positive balance = they have a credit/overpaid)
  const creditCustomers = withTx.filter((c: any) => c.balance > 0)

  return {
    total_customers:       customers.length,
    repeat_customers:      repeat.length,
    repeat_rate_pct:       customers.length > 0 ? Math.round((repeat.length / customers.length) * 100) : 0,
    avg_spend:             customers.length > 0 ? Math.round((totalSpent / customers.length) * 100) / 100 : 0,
    debtors_count:         debtors.length,
    total_outstanding_debt: Math.round(totalOutstandingDebt * 100) / 100,
    credit_customers_count: creditCustomers.length,
    debtors:               debtors.slice(0, 10).map((c: any) => ({
      name:   c.name,
      phone:  c.phone ?? '—',
      amount_owed: Math.round(Math.abs(c.balance) * 100) / 100,
    })),
    top_customers: top.map((c: any) => ({
      name:           c.name,
      phone:          c.phone ?? '—',
      purchase_count: c.purchase_count,
      total_spent:    Math.round(c.total_spent * 100) / 100,
      last_purchase:  c.last_purchase,
      balance:        Math.round(c.balance * 100) / 100,
    })),
  }
}

async function getPurchaseOrdersSummary(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)

  const batches = await db.productBatch.findMany({
    where: { createdAt: dateRange },
    include: {
      product: {
        include: {
          supplier: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const total = batches.reduce((s: number, b: any) => s + Number(b.costPrice) * b.quantity, 0)

  const supplierMap: Record<string, { name: string; total: number; count: number }> = {}
  for (const b of batches) {
    const sname = (b as any).product?.supplier?.name ?? 'غير محدد'
    if (!supplierMap[sname]) supplierMap[sname] = { name: sname, total: 0, count: 0 }
    supplierMap[sname].total += Number(b.costPrice) * b.quantity
    supplierMap[sname].count += 1
  }

  const recentBatches = batches.slice(0, 15).map((b: any) => ({
    date:          format(new Date(b.createdAt), 'yyyy-MM-dd'),
    product:       b.product.name,
    category:      b.product.category?.name ?? '—',
    supplier:      b.product.supplier?.name ?? 'غير محدد',
    branch:        b.branch.name,
    quantity:      b.quantity,
    cost_price:    Number(b.costPrice),
    total_cost:    Math.round(Number(b.costPrice) * b.quantity * 100) / 100,
    batch_number:  b.batchNumber ?? '—',
    expiry_date:   b.expiryDate ? format(new Date(b.expiryDate), 'yyyy-MM-dd') : '—',
  }))

  return {
    period:        `${args.start_date} إلى ${args.end_date}`,
    total_spent:   Math.round(total * 100) / 100,
    total_batches: batches.length,
    by_supplier:   Object.values(supplierMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(s => ({ ...s, total: Math.round(s.total * 100) / 100 })),
    recent_purchases: recentBatches,
  }
}

async function getMenuPerformance(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const daysBack = parseInt(args.days_back ?? '30', 10)
  const since    = subDays(new Date(), daysBack)
  const branchId = args.branch_id ?? auth.branchId ?? undefined

  const txWhere: any = { type: 'SALE', date: { gte: since } }
  if (branchId) txWhere.branchId = branchId

  const txs = await db.transaction.findMany({
    where: txWhere,
    include: { items: { select: { productId: true, quantity: true } } },
  })

  const soldProductIds = new Set<string>()
  const salesCount: Record<string, number> = {}
  for (const tx of txs) {
    for (const item of (tx as any).items) {
      soldProductIds.add(item.productId)
      salesCount[item.productId] = (salesCount[item.productId] ?? 0) + Number(item.quantity)
    }
  }

  const allProducts = await db.product.findMany({
    include: { category: { select: { name: true } } },
  })

  const slowMovers = allProducts
    .filter((p: any) => !soldProductIds.has(p.id))
    .slice(0, 20)
    .map((p: any) => ({ name: p.name, category: p.category?.name ?? 'غير مصنّف', units_sold: 0 }))

  const topSellers = allProducts
    .filter((p: any) => salesCount[p.id])
    .sort((a: any, b: any) => (salesCount[b.id] ?? 0) - (salesCount[a.id] ?? 0))
    .slice(0, 5)
    .map((p: any) => ({ name: p.name, units_sold: salesCount[p.id] }))

  return {
    period_days:              daysBack,
    total_products:           allProducts.length,
    products_with_no_sales:   slowMovers.length,
    slow_movers:              slowMovers,
    top_sellers:              topSellers,
  }
}

async function getHourlyHeatmap(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const daysBack = parseInt(args.days_back ?? '7', 10)
  const since    = subDays(new Date(), daysBack)
  const branchId = args.branch_id ?? auth.branchId ?? undefined

  const where: any = { type: 'SALE', date: { gte: since } }
  if (branchId) where.branchId = branchId

  const txs = await db.transaction.findMany({
    where,
    select: { date: true, totalAmount: true },
  })

  const hourly: Record<number, { count: number; revenue: number }> = {}
  for (let h = 0; h < 24; h++) hourly[h] = { count: 0, revenue: 0 }

  for (const t of txs) {
    const h = new Date(t.date).getHours()
    hourly[h].count   += 1
    hourly[h].revenue += Number(t.totalAmount)
  }

  const arabicHour = (h: number) => {
    const ampm    = h < 12 ? 'صباحاً' : 'مساءً'
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${display} ${ampm}`
  }

  const hours    = Object.entries(hourly).map(([h, d]) => ({
    hour:    parseInt(h),
    label:   arabicHour(parseInt(h)),
    count:   d.count,
    revenue: Math.round(d.revenue * 100) / 100,
  }))
  const operating = hours.filter(h => h.hour >= 6 && h.hour <= 23)
  const peak      = operating.reduce((max, h) => (h.count > max.count ? h : max), operating[0])
  const slow      = operating.reduce((min, h) => (h.count < min.count ? h : min), operating[0])

  return {
    days_analyzed: daysBack,
    hours,
    peak_hour:     peak,
    slowest_hour:  slow,
    avg_per_hour:  txs.length > 0 ? Math.round(txs.length / 24) : 0,
  }
}

async function getOffersEffectiveness(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)

  const startDate = args.start_date ? parseISO(args.start_date) : subDays(new Date(), 30)
  const endDate   = args.end_date   ? parseISO(args.end_date)   : new Date()
  const dateRange = { gte: startOfDay(startDate), lte: endOfDay(endDate) }

  const [offers, txWithOffers] = await Promise.all([
    db.offer.findMany({ orderBy: { createdAt: 'desc' } }),
    db.transaction.findMany({
      where: { type: 'SALE', date: dateRange, offerId: { not: null } },
      select: { offerId: true, totalAmount: true, discount: true },
    }),
  ])

  // Count usage and revenue per offer
  const usageMap: Record<string, { count: number; revenue: number; discountGiven: number }> = {}
  for (const t of txWithOffers) {
    if (!t.offerId) continue
    if (!usageMap[t.offerId]) usageMap[t.offerId] = { count: 0, revenue: 0, discountGiven: 0 }
    usageMap[t.offerId].count        += 1
    usageMap[t.offerId].revenue      += Number(t.totalAmount)
    usageMap[t.offerId].discountGiven += Number(t.discount ?? 0)
  }

  const offerList = offers.map((o: any) => ({
    name:            o.name,
    type:            o.type,
    value:           Number(o.value),
    is_active:       o.isActive,
    start_date:      format(new Date(o.startDate), 'yyyy-MM-dd'),
    end_date:        o.endDate ? format(new Date(o.endDate), 'yyyy-MM-dd') : 'بلا نهاية',
    usage_count:     usageMap[o.id]?.count ?? 0,
    revenue_from_offer: Math.round((usageMap[o.id]?.revenue ?? 0) * 100) / 100,
    total_discount_given: Math.round((usageMap[o.id]?.discountGiven ?? 0) * 100) / 100,
  })).sort((a, b) => b.usage_count - a.usage_count)

  const totalUsage    = txWithOffers.length
  const totalDiscount = txWithOffers.reduce((s, t) => s + Number(t.discount ?? 0), 0)

  return {
    period:              `${format(startDate, 'yyyy-MM-dd')} إلى ${format(endDate, 'yyyy-MM-dd')}`,
    total_offers:        offers.length,
    active_offers:       offers.filter((o: any) => o.isActive).length,
    total_offer_usage:   totalUsage,
    total_discount_from_offers: Math.round(totalDiscount * 100) / 100,
    most_used_offers:    offerList.slice(0, 5),
    all_offers:          offerList,
  }
}

async function getOrdersAnalysis(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)
  const branchId  = args.branch_id ?? auth.branchId ?? undefined

  const where: any = { date: dateRange }
  if (branchId) where.branchId = branchId

  const txs = await db.transaction.findMany({
    where,
    select: { type: true, totalAmount: true, date: true },
  })

  const typeMap: Record<string, { count: number; revenue: number }> = {}
  for (const t of txs) {
    if (!typeMap[t.type]) typeMap[t.type] = { count: 0, revenue: 0 }
    typeMap[t.type].count   += 1
    typeMap[t.type].revenue += Number(t.totalAmount)
  }

  const total     = txs.length
  const breakdown = Object.entries(typeMap).map(([type, d]) => ({
    type,
    count:      d.count,
    revenue:    Math.round(d.revenue * 100) / 100,
    percentage: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }))

  return {
    period:               `${args.start_date} إلى ${args.end_date}`,
    total_transactions:   total,
    avg_transaction_value: total > 0
      ? Math.round(txs.reduce((s, t) => s + Number(t.totalAmount), 0) / total * 100) / 100
      : 0,
    by_type: breakdown,
  }
}

async function getExpenseBreakdown(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)
  const branchId  = args.branch_id ?? auth.branchId ?? undefined

  const where: any = { date: dateRange }
  if (branchId) where.branchId = branchId

  const expenses = await db.expense.findMany({
    where,
    include: { branch: { select: { name: true } } },
  })

  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0)

  const byCategory: Record<string, number> = {}
  for (const e of expenses) {
    const cat = e.category ?? 'أخرى'
    byCategory[cat] = (byCategory[cat] ?? 0) + Number(e.amount)
  }

  return {
    period:         `${args.start_date} إلى ${args.end_date}`,
    total_expenses: Math.round(total * 100) / 100,
    count:          expenses.length,
    by_category:    Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amount]) => ({ category: cat, amount: Math.round(amount * 100) / 100 })),
  }
}

// ─── NEW: Product Profit Margins ──────────────────────────────────────────────

async function getProductMargins(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)
  const branchId  = args.branch_id ?? auth.branchId ?? undefined
  const limit     = Math.min(parseInt(args.limit ?? '20', 10), 50)
  const sortBy    = args.sort ?? 'gross_profit'

  const txWhere: any = { type: 'SALE', date: dateRange }
  if (branchId) txWhere.branchId = branchId

  const transactions = await db.transaction.findMany({
    where: txWhere,
    include: {
      items: {
        include: { product: { include: { category: { select: { name: true } } } } },
      },
    },
  })

  const productMap: Record<string, {
    name: string; category: string; units: number; revenue: number; cogs: number
  }> = {}

  for (const tx of transactions) {
    for (const item of (tx as any).items) {
      const pid = item.productId
      if (!productMap[pid]) {
        productMap[pid] = {
          name:     item.product.name,
          category: item.product.category?.name ?? 'غير مصنّف',
          units: 0, revenue: 0, cogs: 0,
        }
      }
      const qty = Number(item.quantity)
      productMap[pid].units   += qty
      productMap[pid].revenue += Number(item.price) * qty
      productMap[pid].cogs    += Number(item.cost ?? 0) * qty
    }
  }

  const products = Object.values(productMap)
    .filter(p => p.revenue > 0)
    .map(p => ({
      name:         p.name,
      category:     p.category,
      units_sold:   Math.round(p.units),
      revenue:      Math.round(p.revenue * 100) / 100,
      cogs:         Math.round(p.cogs * 100) / 100,
      gross_profit: Math.round((p.revenue - p.cogs) * 100) / 100,
      margin_pct:   Math.round(p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0),
    }))
    .sort((a, b) => sortBy === 'margin_pct' ? b.margin_pct - a.margin_pct : b.gross_profit - a.gross_profit)
    .slice(0, limit)

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)
  const totalCogs    = products.reduce((s, p) => s + p.cogs, 0)
  const overallMargin = totalRevenue > 0 ? Math.round(((totalRevenue - totalCogs) / totalRevenue) * 100) : 0

  return {
    period:              `${args.start_date} إلى ${args.end_date}`,
    overall_margin_pct:  overallMargin,
    total_gross_profit:  Math.round((totalRevenue - totalCogs) * 100) / 100,
    sorted_by:           sortBy === 'margin_pct' ? 'نسبة الهامش' : 'إجمالي الربح',
    products,
  }
}

// ─── NEW: Branch Profit Detail ────────────────────────────────────────────────

async function getBranchProfitDetail(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)

  const [transactions, expenses, branches] = await Promise.all([
    db.transaction.findMany({
      where:   { type: 'SALE', date: dateRange },
      include: {
        branch: { select: { name: true } },
        items:  { select: { price: true, cost: true, quantity: true } },
      },
    }),
    db.expense.findMany({
      where:   { date: dateRange },
      select:  { branchId: true, amount: true },
    }),
    db.branch.findMany({ select: { id: true, name: true } }),
  ])

  const branchMap: Record<string, {
    name: string; revenue: number; cogs: number; expenses: number; count: number
  }> = {}

  for (const b of branches) {
    branchMap[b.id] = { name: b.name, revenue: 0, cogs: 0, expenses: 0, count: 0 }
  }

  for (const t of transactions) {
    if (!branchMap[t.branchId]) continue
    branchMap[t.branchId].revenue += Number(t.totalAmount)
    branchMap[t.branchId].count   += 1
    for (const item of (t as any).items) {
      branchMap[t.branchId].cogs += Number(item.cost ?? 0) * Number(item.quantity)
    }
  }

  for (const e of expenses) {
    if (!branchMap[e.branchId]) continue
    branchMap[e.branchId].expenses += Number(e.amount)
  }

  const result = Object.values(branchMap)
    .filter(b => b.revenue > 0 || b.expenses > 0)
    .map(b => {
      const grossProfit = b.revenue - b.cogs
      const netProfit   = grossProfit - b.expenses
      return {
        name:              b.name,
        total_revenue:     Math.round(b.revenue * 100) / 100,
        cogs:              Math.round(b.cogs * 100) / 100,
        gross_profit:      Math.round(grossProfit * 100) / 100,
        gross_margin_pct:  b.revenue > 0 ? Math.round((grossProfit / b.revenue) * 100) : 0,
        operating_expenses: Math.round(b.expenses * 100) / 100,
        net_profit:        Math.round(netProfit * 100) / 100,
        net_margin_pct:    b.revenue > 0 ? Math.round((netProfit / b.revenue) * 100) : 0,
        transactions_count: b.count,
      }
    })
    .sort((a, b) => b.net_profit - a.net_profit)

  return {
    period:   `${args.start_date} إلى ${args.end_date}`,
    branches: result,
    top_branch_by_profit: result[0]?.name ?? 'لا يوجد',
  }
}

// ─── NEW: Stock Movements ─────────────────────────────────────────────────────

async function getStockMovements(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)
  const dateRange = parseDateRange(args.start_date, args.end_date)
  const branchId  = args.branch_id ?? auth.branchId ?? undefined

  const batchWhere: any = { createdAt: dateRange }
  if (branchId) batchWhere.branchId = branchId

  const txWhere: any = { type: 'SALE', date: dateRange }
  if (branchId) txWhere.branchId = branchId

  const [batches, transactions] = await Promise.all([
    db.productBatch.findMany({
      where:   batchWhere,
      include: {
        product:  { include: { supplier: { select: { name: true } } } },
        branch:   { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.transaction.findMany({
      where:   txWhere,
      include: {
        items: {
          include: { product: { select: { name: true } } },
        },
        branch: { select: { name: true } },
      },
    }),
  ])

  // Stock IN — from batches
  const stockIn = batches.slice(0, 20).map((b: any) => ({
    type:        'وارد',
    date:        format(new Date(b.createdAt), 'yyyy-MM-dd'),
    product:     b.product.name,
    supplier:    b.product.supplier?.name ?? 'غير محدد',
    branch:      b.branch.name,
    quantity_in: b.quantity,
    cost_price:  Number(b.costPrice),
    total_cost:  Math.round(Number(b.costPrice) * b.quantity * 100) / 100,
  }))

  // Stock OUT — from transaction items aggregated by product
  const outMap: Record<string, { name: string; branch: string; qty: number; revenue: number }> = {}
  for (const tx of transactions) {
    for (const item of (tx as any).items) {
      const key = `${item.productId}_${tx.branchId}`
      if (!outMap[key]) outMap[key] = { name: item.product.name, branch: (tx as any).branch.name, qty: 0, revenue: 0 }
      outMap[key].qty     += Number(item.quantity)
      outMap[key].revenue += Number(item.price) * Number(item.quantity)
    }
  }

  const stockOut = Object.values(outMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 20)
    .map(o => ({
      type:         'صادر (مبيعات)',
      product:      o.name,
      branch:       o.branch,
      quantity_out: Math.round(o.qty),
      revenue:      Math.round(o.revenue * 100) / 100,
    }))

  // Summary per product
  const productActivity: Record<string, { name: string; in: number; out: number }> = {}
  for (const b of batches) {
    const name = (b as any).product.name
    if (!productActivity[name]) productActivity[name] = { name, in: 0, out: 0 }
    productActivity[name].in += b.quantity
  }
  for (const out of stockOut) {
    if (!productActivity[out.product]) productActivity[out.product] = { name: out.product, in: 0, out: 0 }
    productActivity[out.product].out += out.quantity_out
  }

  return {
    period:             `${args.start_date} إلى ${args.end_date}`,
    total_batches_in:   batches.length,
    total_units_in:     batches.reduce((s: number, b: any) => s + b.quantity, 0),
    stock_in:           stockIn,
    stock_out_summary:  stockOut,
    product_activity:   Object.values(productActivity).slice(0, 20),
  }
}

// ─── NEW: Supplier Price Comparison ──────────────────────────────────────────

async function getSupplierPrices(args: any, auth: AuthContext) {
  const db = getTenantPrisma(auth.tenantId)

  const supplierWhere: any = {}
  if (args.supplier_name) {
    supplierWhere.name = { contains: args.supplier_name, mode: 'insensitive' }
  }

  const suppliers = await db.supplier.findMany({
    where:   { ...supplierWhere, tenantId: auth.tenantId },
    include: {
      products: {
        include: {
          batches: {
            orderBy: { createdAt: 'desc' },
            take:    5,
            select:  { costPrice: true, quantity: true, createdAt: true },
          },
          units: { select: { price: true, name: true }, take: 1 },
        },
      },
    },
    take: 10,
  })

  const result = suppliers.map((s: any) => {
    const products = s.products.map((p: any) => {
      const batches       = p.batches
      const avgCost       = batches.length > 0
        ? batches.reduce((sum: number, b: any) => sum + Number(b.costPrice), 0) / batches.length
        : 0
      const latestCost    = batches[0] ? Number(batches[0].costPrice) : 0
      const sellPrice     = Number(p.units?.[0]?.price ?? 0)
      const marginPct     = sellPrice > 0 ? Math.round(((sellPrice - latestCost) / sellPrice) * 100) : 0
      const priceHistory  = batches.map((b: any) => ({
        date:       format(new Date(b.createdAt), 'yyyy-MM-dd'),
        cost_price: Number(b.costPrice),
        quantity:   b.quantity,
      }))

      return {
        product_name:  p.name,
        latest_cost:   Math.round(latestCost * 100) / 100,
        avg_cost:      Math.round(avgCost * 100) / 100,
        sell_price:    Math.round(sellPrice * 100) / 100,
        margin_pct:    marginPct,
        price_history: priceHistory,
      }
    }).filter((p: any) => p.latest_cost > 0)

    return {
      supplier_name:  s.name,
      phone:          s.phone ?? '—',
      balance:        Number(s.balance ?? 0),
      products_count: products.length,
      products:       products.sort((a: any, b: any) => b.latest_cost - a.latest_cost),
    }
  }).filter((s: any) => s.products_count > 0)

  return {
    suppliers_found: result.length,
    suppliers:       result,
    note:            'الأسعار مأخوذة من آخر دفعات الشراء المسجلة',
  }
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

export async function executeToolCall(name: string, args: unknown, auth: AuthContext): Promise<unknown> {
  const a = (args ?? {}) as any

  const financialTools = ['get_financial_summary', 'get_expense_breakdown', 'get_discount_report',
    'get_purchase_orders_summary', 'get_product_margins', 'get_branch_profit_detail']
  if (financialTools.includes(name) && ['CASHIER', 'STOCK_KEEPER'].includes(auth.role)) {
    return { error: 'unauthorized', message: 'غير مصرح لك بالاطلاع على البيانات المالية' }
  }

  switch (name) {
    case 'get_sales_report':          return getSalesReport(a, auth)
    case 'get_inventory_levels':      return getInventoryLevels(a, auth)
    case 'get_financial_summary':     return getFinancialSummary(a, auth)
    case 'get_top_products':          return getTopProducts(a, auth)
    case 'get_branch_stats':          return getBranchStats(a, auth)
    case 'get_recent_transactions':   return getRecentTransactions(a, auth)
    case 'get_shift_summary':         return getShiftSummary(a, auth)
    case 'get_discount_report':       return getDiscountReport(a, auth)
    case 'get_staff_performance':     return getStaffPerformance(a, auth)
    case 'get_customer_insights':     return getCustomerInsights(a, auth)
    case 'get_purchase_orders_summary': return getPurchaseOrdersSummary(a, auth)
    case 'get_menu_performance':      return getMenuPerformance(a, auth)
    case 'get_hourly_heatmap':        return getHourlyHeatmap(a, auth)
    case 'get_offers_effectiveness':  return getOffersEffectiveness(a, auth)
    case 'get_orders_analysis':       return getOrdersAnalysis(a, auth)
    case 'get_expense_breakdown':     return getExpenseBreakdown(a, auth)
    case 'get_product_margins':       return getProductMargins(a, auth)
    case 'get_branch_profit_detail':  return getBranchProfitDetail(a, auth)
    case 'get_stock_movements':       return getStockMovements(a, auth)
    case 'get_supplier_prices':       return getSupplierPrices(a, auth)
    default:
      return { error: 'unknown_tool', tool: name }
  }
}
