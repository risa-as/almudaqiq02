import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/api-helpers'
import { getAIProvider } from '@/lib/ai/factory'
import { TOOL_DEFINITIONS, executeToolCall } from '@/lib/ai/tools'
import { buildSystemPrompt } from '@/lib/ai/prompts'
import { prisma } from '@/lib/multi-tenant/prisma'

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(20)
    .default([]),
  branchId: z.string().nullable().optional(),
})

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Message is required and must be under 2000 characters' },
      { status: 400 }
    )
  }

  const { message, history, branchId } = parsed.data
  const today = todayStr()

  // ── Check daily limit + fetch currency ──────────────────────────────────────
  const [tenant, usageLog, storeSettings] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: auth.tenantId }, select: { aiDailyLimit: true } }),
    prisma.aiUsageLog.findUnique({ where: { tenantId_date: { tenantId: auth.tenantId, date: today } } }),
    prisma.storeSettings.findFirst({ where: { tenantId: auth.tenantId }, select: { currency: true } }),
  ])

  const limit = tenant?.aiDailyLimit ?? 50
  const used  = usageLog?.count ?? 0

  if (limit > 0 && used >= limit) {
    return NextResponse.json(
      {
        error:     'daily_limit_reached',
        reply:     `عذراً، لقد وصلت إلى الحد اليومي للمساعد الذكي (${limit} استفسار). يتجدد الحد تلقائياً في منتصف الليل.`,
        used,
        limit,
        remaining: 0,
      },
      { status: 429 }
    )
  }

  // ── Validate branchId ────────────────────────────────────────────────────────
  let resolvedBranchId: string | undefined = auth.branchId ?? undefined
  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId: auth.tenantId },
      select: { id: true },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
    }
    resolvedBranchId = branch.id
  }

  const enrichedAuth = { ...auth, branchId: resolvedBranchId }
  const currency = storeSettings?.currency ?? 'ريال'

  try {
    const provider = getAIProvider()

    const result = await provider.generateResponse({
      message,
      history,
      toolDefinitions: TOOL_DEFINITIONS,
      systemPrompt:    buildSystemPrompt(currency),
      executeToolCall: (name, args) => executeToolCall(name, args, enrichedAuth),
    })

    // ── Increment usage ────────────────────────────────────────────────────────
    const newCount = used + 1
    await prisma.aiUsageLog.upsert({
      where:  { tenantId_date: { tenantId: auth.tenantId, date: today } },
      create: { tenantId: auth.tenantId, date: today, count: 1 },
      update: { count: { increment: 1 } },
    })

    return NextResponse.json({
      reply:        result.reply,
      toolsInvoked: result.toolsInvoked,
      provider:     process.env.AI_PROVIDER ?? 'gemini',
      used:         newCount,
      limit,
      remaining:    Math.max(0, limit - newCount),
    })
  } catch (error: any) {
    console.error('[AI Chat]', error)

    const status  = error?.status ?? error?.httpErrorCode ?? 0
    const message = error instanceof Error ? error.message : String(error ?? '')

    const isQuota = status === 429 ||
      message.includes('429') ||
      message.toLowerCase().includes('quota')

    const isOverloaded = status === 503 ||
      message.includes('503') ||
      message.toLowerCase().includes('service unavailable') ||
      message.toLowerCase().includes('overloaded') ||
      message.toLowerCase().includes('high demand')

    if (isQuota) {
      return NextResponse.json(
        {
          error:     'quota_exceeded',
          reply:     'عذراً، خدمة الذكاء الاصطناعي وصلت إلى حدها اليومي من جانب المزوّد. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.',
          used,
          limit,
          remaining: Math.max(0, limit - used),
        },
        { status: 503 }
      )
    }

    if (isOverloaded) {
      return NextResponse.json(
        {
          error:     'service_overloaded',
          reply:     'خدمة الذكاء الاصطناعي مشغولة حالياً بسبب الضغط العالي. جرّب مرة أخرى بعد لحظات.',
          used,
          limit,
          remaining: Math.max(0, limit - used),
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: 'ai_unavailable',
        reply: 'عذراً، المساعد الذكي غير متاح حالياً. يرجى المحاولة مرة أخرى.',
      },
      { status: 503 }
    )
  }
}
