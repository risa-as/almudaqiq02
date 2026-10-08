import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { generateBranchToken } from '@/lib/auth'
import { checkRateLimitAsync } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const Schema = z.object({ activationCode: z.string().min(4) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Public endpoint (no user session) — throttle guessing per IP.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimitAsync(`branch-activate:${ip}`, { limit: 10, windowMs: 10 * 60_000 })
  if (!rl.allowed) return NextResponse.json({ error: 'محاولات كثيرة جداً. حاول مرة أخرى بعد قليل.' }, { status: 429 })

  const body   = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'رمز التفعيل مطلوب' }, { status: 400 })

  const branch = await prisma.branch.findFirst({
    // An archived branch must not be re-bound to a new install.
    where: { id, activationCode: parsed.data.activationCode, isActive: true },
    include: { storeSettings: true },
  })
  if (!branch) return NextResponse.json({ error: 'رمز التفعيل غير صحيح' }, { status: 401 })

  const branchToken = await generateBranchToken(branch.id, branch.tenantId, branch.tokenVersion)

  return NextResponse.json({
    branchToken,
    branchId: branch.id,
    tenantId: branch.tenantId,
    branchName: branch.name,
    settings: branch.storeSettings?.[0] ?? null,
  })
}
