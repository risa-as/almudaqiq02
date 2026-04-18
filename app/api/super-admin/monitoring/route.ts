import { NextResponse } from 'next/server'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const since14Days = new Date(Date.now() - 14 * 86400_000)

  const [recentAuditLogs, auditByDay] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, entity: true, username: true, createdAt: true, details: true },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since14Days } },
      select: { createdAt: true, action: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const dbResponseStart = Date.now()
  await prisma.$queryRaw`SELECT 1`
  const dbResponseMs = Date.now() - dbResponseStart

  // Group audit logs by day
  const auditDayMap: Record<string, { total: number; creates: number; deletes: number }> = {}
  auditByDay.forEach((log: { createdAt: Date; action: string }) => {
    const day = log.createdAt.toISOString().slice(0, 10)
    if (!auditDayMap[day]) auditDayMap[day] = { total: 0, creates: 0, deletes: 0 }
    auditDayMap[day].total++
    if (log.action === 'CREATE') auditDayMap[day].creates++
    if (log.action === 'DELETE') auditDayMap[day].deletes++
  })

  // Generate last 14 days
  const chartDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400_000)
    return d.toISOString().slice(0, 10)
  })

  const activityByDay = chartDays.map(day => ({
    day: day.slice(5), // MM-DD
    total: auditDayMap[day]?.total ?? 0,
    creates: auditDayMap[day]?.creates ?? 0,
    deletes: auditDayMap[day]?.deletes ?? 0,
  }))

  return NextResponse.json({
    dbResponseMs,
    auditLogs: recentAuditLogs,
    activityByDay,
  })
}


