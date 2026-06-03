import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { generateBranchToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const Schema = z.object({ activationCode: z.string().min(4) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body   = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'رمز التفعيل مطلوب' }, { status: 400 })

  const branch = await prisma.branch.findFirst({
    where: { id, activationCode: parsed.data.activationCode },
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
