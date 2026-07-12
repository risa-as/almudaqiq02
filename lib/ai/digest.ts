import { getTenantPrisma } from '@/lib/multi-tenant/prisma'
import { startOfDay, endOfDay, subDays, addDays, format } from 'date-fns'

/**
 * Rule-based daily digest: compares yesterday against the trailing week and
 * scans stock/shift/debt signals. Deterministic (no LLM call) so it can run
 * for every tenant every morning at zero token cost.
 */

export interface DigestInsight {
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
}

export interface DailyDigest {
  date: string
  insights: DigestInsight[]
  /** Ready-to-send Arabic summary (notification body / email). */
  text: string
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export async function buildDailyDigest(tenantId: string): Promise<DailyDigest> {
  const db = getTenantPrisma(tenantId)
  const now = new Date()
  const yStart = startOfDay(subDays(now, 1))
  const yEnd   = endOfDay(subDays(now, 1))
  const weekStart = startOfDay(subDays(now, 8))

  const [yesterdaySales, priorWeekSales, badShifts, expiring, recentTx, batches, debtors] = await Promise.all([
    db.transaction.findMany({
      where: { type: 'SALE', date: { gte: yStart, lte: yEnd } },
      select: { totalAmount: true },
    }),
    db.transaction.findMany({
      where: { type: 'SALE', date: { gte: weekStart, lt: yStart } },
      select: { totalAmount: true, date: true },
    }),
    db.cashierShift.findMany({
      where: { openedAt: { gte: yStart, lte: yEnd }, difference: { lt: 0 } },
      include: { user: { select: { username: true } } },
    }),
    db.productBatch.findMany({
      where: {
        quantity: { gt: 0 },
        expiryDate: { gte: now, lte: addDays(now, 7) },
      },
      include: { product: { select: { name: true } } },
      take: 10,
    }),
    // Base-unit consumption over the last 14 days → stock-out risk.
    db.transaction.findMany({
      where: { type: 'SALE', date: { gte: subDays(now, 14) } },
      include: {
        items: {
          include: {
            unit:    { select: { conversionFactor: true } },
            product: { select: { name: true } },
          },
        },
      },
    }),
    db.productBatch.findMany({ select: { productId: true, quantity: true } }),
    db.customer.findMany({
      where: { balance: { lt: 0 } },
      select: { balance: true },
    }),
  ])

  const insights: DigestInsight[] = []

  // ── 1. Sales anomaly: yesterday vs trailing 7-day average ────────────────────
  const yRevenue = yesterdaySales.reduce((s, t) => s + Number(t.totalAmount), 0)
  const priorDays: Record<string, number> = {}
  for (const t of priorWeekSales) {
    const key = format(new Date(t.date), 'yyyy-MM-dd')
    priorDays[key] = (priorDays[key] ?? 0) + Number(t.totalAmount)
  }
  const priorValues = Object.values(priorDays)
  const avg = priorValues.length ? priorValues.reduce((a, b) => a + b, 0) / priorValues.length : 0
  if (avg > 0) {
    const deltaPct = Math.round(((yRevenue - avg) / avg) * 100)
    if (deltaPct <= -25) {
      insights.push({
        severity: 'warning',
        title: `انخفاض غير معتاد في المبيعات (${deltaPct}%)`,
        detail: `مبيعات الأمس ${fmt(yRevenue)} مقابل متوسط أسبوعي ${fmt(avg)} — راجع الأسباب المحتملة`,
      })
    } else if (deltaPct >= 40) {
      insights.push({
        severity: 'info',
        title: `قفزة في المبيعات (+${deltaPct}%)`,
        detail: `مبيعات الأمس ${fmt(yRevenue)} مقابل متوسط ${fmt(avg)} — تأكد من توفر المخزون للأصناف الرائجة`,
      })
    }
  }

  // ── 2. Shift deficits yesterday ───────────────────────────────────────────────
  if (badShifts.length > 0) {
    const totalDeficit = badShifts.reduce((s, sh) => s + Math.abs(Number(sh.difference ?? 0)), 0)
    const names = [...new Set(badShifts.map((s: any) => s.user?.username ?? 'غير معروف'))].join('، ')
    insights.push({
      severity: 'critical',
      title: `عجز في ${badShifts.length} وردية أمس بإجمالي ${fmt(totalDeficit)}`,
      detail: `الكاشير: ${names}`,
    })
  }

  // ── 3. Stock-out risk within 7 days ──────────────────────────────────────────
  const stockMap: Record<string, number> = {}
  for (const b of batches) stockMap[b.productId] = (stockMap[b.productId] ?? 0) + b.quantity
  const soldMap: Record<string, { name: string; baseSold: number }> = {}
  for (const tx of recentTx) {
    for (const item of (tx as any).items) {
      const pid = item.productId
      if (!soldMap[pid]) soldMap[pid] = { name: item.product.name, baseSold: 0 }
      soldMap[pid].baseSold += Number(item.quantity) * Number(item.unit?.conversionFactor ?? 1)
    }
  }
  const atRisk = Object.entries(soldMap)
    .map(([pid, p]) => {
      const rate = p.baseSold / 14
      const stock = stockMap[pid] ?? 0
      return { name: p.name, daysLeft: rate > 0 ? stock / rate : Infinity }
    })
    .filter(p => p.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5)
  if (atRisk.length > 0) {
    insights.push({
      severity: 'warning',
      title: `${atRisk.length} منتجات ستنفد خلال أسبوع حسب معدل البيع`,
      detail: atRisk.map(p => `${p.name} (${Math.max(0, Math.round(p.daysLeft))} يوم)`).join('، '),
    })
  }

  // ── 4. Expiring stock within 7 days ──────────────────────────────────────────
  if (expiring.length > 0) {
    insights.push({
      severity: 'warning',
      title: `${expiring.length} دفعات تنتهي صلاحيتها خلال 7 أيام`,
      detail: expiring.slice(0, 5).map((b: any) => b.product.name).join('، ') + ' — فكّر بعرض تصريف',
    })
  }

  // ── 5. Outstanding customer debt ─────────────────────────────────────────────
  const totalDebt = debtors.reduce((s, c) => s + Math.abs(Number(c.balance)), 0)
  if (totalDebt > 0 && debtors.length >= 3) {
    insights.push({
      severity: 'info',
      title: `ديون مستحقة على ${debtors.length} عميل بإجمالي ${fmt(totalDebt)}`,
      detail: 'راجع تقرير ديون العملاء للمتابعة',
    })
  }

  const date = format(subDays(now, 1), 'yyyy-MM-dd')
  const icon = { critical: '🔴', warning: '🟠', info: '🔵' } as const
  const text = insights.length
    ? insights.map(i => `${icon[i.severity]} ${i.title}\n${i.detail}`).join('\n\n')
    : ''

  return { date, insights, text }
}
