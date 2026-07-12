import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/api-helpers'
import { guardFeature } from '@/lib/plan-features'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { getAIProvider } from '@/lib/ai/factory'
import { TOOL_DEFINITIONS, executeToolCall } from '@/lib/ai/tools'
import { extractChart, type MessageChart } from '@/lib/ai/charts'
import type { ActionProposal } from '@/lib/ai/proposals'
import { buildSystemPrompt } from '@/lib/ai/prompts'
import { prisma } from '@/lib/multi-tenant/prisma'

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(20)
    .default([]),
  branchId: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  stream: z.boolean().optional().default(false),
})

/** Map a provider failure to a user-facing Arabic error payload. */
function classifyAiError(error: any): { error: string; reply: string; status: number } {
  const status  = error?.status ?? error?.httpErrorCode ?? 0
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (status === 429 || message.includes('429') || message.toLowerCase().includes('quota')) {
    return {
      error:  'quota_exceeded',
      reply:  'عذراً، خدمة الذكاء الاصطناعي وصلت إلى حدها اليومي من جانب المزوّد. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.',
      status: 503,
    }
  }
  if (
    status === 503 ||
    message.includes('503') ||
    message.toLowerCase().includes('service unavailable') ||
    message.toLowerCase().includes('overloaded') ||
    message.toLowerCase().includes('high demand')
  ) {
    return {
      error:  'service_overloaded',
      reply:  'خدمة الذكاء الاصطناعي مشغولة حالياً بسبب الضغط العالي. جرّب مرة أخرى بعد لحظات.',
      status: 503,
    }
  }
  return {
    error:  'ai_unavailable',
    reply:  'عذراً، المساعد الذكي غير متاح حالياً. يرجى المحاولة مرة أخرى.',
    status: 503,
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = await guardFeature('ai_assistant'); if (blocked) return blocked

  // Burst control: per-user per-minute cap, in addition to the tenant daily limit.
  const burst = await checkRateLimitAsync(`ai:chat:${auth.userId}`, { limit: 6, windowMs: 60_000 })
  if (!burst.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', reply: 'أرسلت عدة استفسارات متتالية بسرعة. انتظر دقيقة ثم حاول مجدداً.' },
      { status: 429 }
    )
  }

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

  const { message, history: clientHistory, branchId, conversationId, stream } = parsed.data
  const today = todayStr()

  // ── Server-side conversation history ────────────────────────────────────────
  // When resuming a stored conversation, the trusted history comes from the DB —
  // the client-supplied history is ignored (it could be tampered with).
  let conversation: { id: string } | null = null
  let history = clientHistory
  if (conversationId) {
    conversation = await prisma.aiConversation.findFirst({
      where:  { id: conversationId, tenantId: auth.tenantId, userId: auth.userId },
      select: { id: true },
    })
    if (!conversation) {
      return NextResponse.json({ error: 'Invalid conversation' }, { status: 404 })
    }
    const stored = await prisma.aiMessage.findMany({
      where:   { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take:    20,
      select:  { role: true, content: true },
    })
    history = stored
      .reverse()
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  }

  /** Persist the exchange after a successful reply; returns the conversation id. */
  const persistExchange = async (
    reply: string,
    toolsInvoked: string[],
    chartsPayload: unknown[]
  ): Promise<string> => {
    const conv = conversation
      ? await prisma.aiConversation.update({
          where: { id: conversation.id },
          data:  { updatedAt: new Date() },
          select: { id: true },
        })
      : await prisma.aiConversation.create({
          data: {
            tenantId: auth.tenantId,
            userId:   auth.userId,
            title:    message.slice(0, 60),
          },
          select: { id: true },
        })
    await prisma.aiMessage.createMany({
      data: [
        { conversationId: conv.id, role: 'user', content: message },
        {
          conversationId: conv.id,
          role:           'assistant',
          content:        reply,
          toolsInvoked:   toolsInvoked.length ? JSON.stringify(toolsInvoked) : null,
          charts:         chartsPayload.length ? JSON.stringify(chartsPayload) : null,
        },
      ],
    })
    return conv.id
  }

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

  // ── Resolve branch scope (strict isolation) ─────────────────────────────────
  // Branch-bound users (cashier, branch manager, stock keeper) are ALWAYS locked
  // to their own branch — a request-supplied branchId can never widen their scope.
  // Only owners/admins (no branchId in their token) may target a specific branch
  // or view all branches ("all" / none → undefined = no branch filter).
  let resolvedBranchId: string | undefined
  if (auth.branchId) {
    resolvedBranchId = auth.branchId
  } else if (branchId && branchId !== 'all') {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId: auth.tenantId },
      select: { id: true },
    })
    if (!branch) {
      return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
    }
    resolvedBranchId = branch.id
  } else {
    resolvedBranchId = undefined
  }

  const enrichedAuth = { ...auth, branchId: resolvedBranchId }
  const currency = storeSettings?.currency ?? 'ريال'

  // Collect chartable tool results (max 2 per reply) + action proposals for the chat UI.
  const charts: MessageChart[] = []
  const proposals: ActionProposal[] = []
  const makeExec = (onChart?: (c: MessageChart) => void, onProposal?: (p: ActionProposal) => void) =>
    async (name: string, args: unknown) => {
      const result = await executeToolCall(name, args, enrichedAuth)
      if (charts.length < 2) {
        const chart = extractChart(name, result)
        if (chart) {
          charts.push(chart)
          onChart?.(chart)
        }
      }
      const proposal = (result as any)?.__proposal as ActionProposal | undefined
      if (proposal && proposals.length < 3) {
        proposals.push(proposal)
        onProposal?.(proposal)
      }
      return result
    }

  const providerParams = {
    message,
    history,
    toolDefinitions: TOOL_DEFINITIONS,
    systemPrompt:    buildSystemPrompt(currency),
    executeToolCall: makeExec(),
  }

  const bumpUsage = async () => {
    const newCount = used + 1
    await prisma.aiUsageLog.upsert({
      where:  { tenantId_date: { tenantId: auth.tenantId, date: today } },
      create: { tenantId: auth.tenantId, date: today, count: 1 },
      update: { count: { increment: 1 } },
    })
    return newCount
  }

  // ── Streaming mode: NDJSON — one JSON event per line ────────────────────────
  if (stream) {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        try {
          const provider = getAIProvider()
          const streamParams = {
            ...providerParams,
            executeToolCall: makeExec(
              chart => send({ type: 'chart', chart }),
              proposal => send({ type: 'proposal', proposal }),
            ),
          }
          let result: { reply: string; toolsInvoked: string[] }
          if (provider.generateResponseStream) {
            result = await provider.generateResponseStream({ ...streamParams, onEvent: send })
          } else {
            result = await provider.generateResponse(streamParams)
            send({ type: 'delta', text: result.reply })
            for (const chart of charts) send({ type: 'chart', chart })
            for (const proposal of proposals) send({ type: 'proposal', proposal })
          }
          const newCount = await bumpUsage()
          let convId: string | null = conversation?.id ?? null
          try {
            convId = await persistExchange(result.reply, result.toolsInvoked, charts)
          } catch (e) {
            console.error('[AI Chat] persist failed:', e)
          }
          send({
            type:           'done',
            toolsInvoked:   result.toolsInvoked,
            conversationId: convId,
            used:           newCount,
            limit,
            remaining:      Math.max(0, limit - newCount),
          })
        } catch (error: any) {
          console.error('[AI Chat stream]', error)
          const mapped = classifyAiError(error)
          send({ type: 'error', error: mapped.error, reply: mapped.reply })
        } finally {
          controller.close()
        }
      },
    })
    return new Response(body, {
      headers: {
        'Content-Type':      'application/x-ndjson; charset=utf-8',
        'Cache-Control':     'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  try {
    const provider = getAIProvider()

    const result = await provider.generateResponse(providerParams)

    const newCount = await bumpUsage()

    let convId: string | null = conversation?.id ?? null
    try {
      convId = await persistExchange(result.reply, result.toolsInvoked, charts)
    } catch (e) {
      console.error('[AI Chat] persist failed:', e)
    }

    return NextResponse.json({
      reply:          result.reply,
      toolsInvoked:   result.toolsInvoked,
      charts,
      proposals,
      conversationId: convId,
      provider:       process.env.AI_PROVIDER ?? 'gemini',
      used:           newCount,
      limit,
      remaining:      Math.max(0, limit - newCount),
    })
  } catch (error: any) {
    console.error('[AI Chat]', error)
    const mapped = classifyAiError(error)
    return NextResponse.json(
      {
        error:     mapped.error,
        reply:     mapped.reply,
        used,
        limit,
        remaining: Math.max(0, limit - used),
      },
      { status: mapped.status }
    )
  }
}
