import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth'
import { enqueueSync } from '@/lib/sync-enqueue'
import { logAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function getAuthPayload(): Promise<{ tenantId: string; branchId: string | null; role: string } | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return null
    const payload = await verifyAccessToken(token)
    if (!payload.tenantId) return null
    return { tenantId: payload.tenantId, branchId: payload.branchId ?? null, role: payload.role ?? '' }
  } catch {
    return null
  }
}

async function firstBranchId(tenantId: string): Promise<string | null> {
  const branch = await prisma.branch.findFirst({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  return branch?.id ?? null
}

/**
 * Each branch owns its own store settings (name, phone, address, footer…).
 * Owners (ADMIN / SUPER_ADMIN) oversee all branches and freely target the branch
 * selected in the UI — even if their token carries a branchId. Only branch-bound
 * roles (cashier, stock keeper, branch manager) are locked to their own branch.
 */
async function resolveBranchId(
  tenantId: string,
  tokenBranchId: string | null,
  role: string,
  candidate?: string | null,
): Promise<string | null> {
  const isOwner = role === 'ADMIN' || role === 'SUPER_ADMIN'
  if (!isOwner && tokenBranchId) return tokenBranchId
  if (candidate && candidate !== 'all') {
    const b = await prisma.branch.findFirst({ where: { id: candidate, tenantId }, select: { id: true } })
    if (b) return b.id
  }
  return tokenBranchId ?? firstBranchId(tenantId)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthPayload()
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const { tenantId } = auth

    const branchId = await resolveBranchId(
      tenantId, auth.branchId, auth.role, request.nextUrl.searchParams.get('branchId'),
    )
    if (!branchId) return NextResponse.json({ error: 'لا يوجد فرع للمستأجر' }, { status: 400 })

    // Settings are per-branch — return this branch's row (or create its default)
    const existing = await prisma.storeSettings.findFirst({ where: { tenantId, branchId } })
    if (existing) return NextResponse.json(existing)

    const settings = await prisma.storeSettings.create({
      data: {
        tenant:        { connect: { id: tenantId } },
        branch:        { connect: { id: branchId } },
        storeName:     'المدقق ميني ماركت',
        storePhone:    'رقم الهاتف: 07XX XXX XXXX',
        storeAddress:  'العنوان: العراق',
        footerMessage: 'البضاعة المباعة لا ترد ولا تستبدل بعد 3 أيام',
        autoPrint:     false,
      },
    })
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'فشل جلب الإعدادات' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthPayload()
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const { tenantId } = auth

    const body = await request.json()
    const { storeName, storePhone, storeAddress, footerMessage, autoPrint, currency, branchId: bodyBranchId } = body

    // Resolve the target branch — each branch saves its own settings row.
    const branchId = await resolveBranchId(tenantId, auth.branchId, auth.role, bodyBranchId)
    if (!branchId) return NextResponse.json({ error: 'لا يوجد فرع للمستأجر' }, { status: 400 })

    // Look up this branch's settings (scoped by branch, not just tenant)
    const existing = await prisma.storeSettings.findFirst({ where: { tenantId, branchId } })

    if (existing) {
      const updated = await prisma.storeSettings.update({
        where: { id: existing.id },
        data: {
          storeName:     storeName     ?? existing.storeName,
          storePhone:    storePhone    ?? existing.storePhone,
          storeAddress:  storeAddress  ?? existing.storeAddress,
          footerMessage: footerMessage ?? existing.footerMessage,
          autoPrint:     autoPrint     ?? existing.autoPrint,
          currency:      currency      ?? existing.currency,
        },
      })

      enqueueSync('storeSettings', 'UPDATE', updated.id, {
        id: updated.id, storeName: updated.storeName, storePhone: updated.storePhone,
        storeAddress: updated.storeAddress, footerMessage: updated.footerMessage,
        autoPrint: updated.autoPrint, currency: updated.currency,
      })

      await logAction('UPDATE_SETTINGS', 'StoreSettings', updated.id,
        `Store settings updated for branch ${branchId}`, undefined, tenantId, branchId)

      return NextResponse.json({ success: true, settings: updated })
    }

    // No row for this branch yet — create it
    const created = await prisma.storeSettings.create({
      data: {
        tenant:        { connect: { id: tenantId } },
        branch:        { connect: { id: branchId } },
        storeName, storePhone, storeAddress, footerMessage,
        autoPrint: autoPrint ?? false,
        ...(currency ? { currency } : {}),
      },
    })
    return NextResponse.json({ success: true, settings: created })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'فشل حفظ الإعدادات' }, { status: 500 })
  }
}
