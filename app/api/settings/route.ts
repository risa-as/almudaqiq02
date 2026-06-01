import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyAccessToken } from '@/lib/auth'
import { enqueueSync } from '@/lib/sync-enqueue'

export const dynamic = 'force-dynamic'

async function getTenantId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return null
    const payload = await verifyAccessToken(token)
    return payload.tenantId ?? null
  } catch {
    return null
  }
}

async function getBranchId(tenantId: string, fromToken?: string): Promise<string | null> {
  if (fromToken) return fromToken
  const branch = await prisma.branch.findFirst({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  return branch?.id ?? null
}

export async function GET() {
  try {
    const tenantId = await getTenantId()
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    // Return existing settings if found
    const existing = await prisma.storeSettings.findFirst({ where: { tenantId } })
    if (existing) return NextResponse.json(existing)

    // First time — need branchId to create
    const branchId = await getBranchId(tenantId)
    if (!branchId) return NextResponse.json({ error: 'لا يوجد فرع للمستأجر' }, { status: 400 })

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
    const tenantId = await getTenantId()
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const body = await request.json()
    const { storeName, storePhone, storeAddress, footerMessage, autoPrint, currency } = body

    // Find existing settings by tenant only — branchId not needed for updates
    const existing = await prisma.storeSettings.findFirst({ where: { tenantId } })

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

      return NextResponse.json({ success: true, settings: updated })
    }

    // No existing settings — create with branchId
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    const payload = token ? await verifyAccessToken(token).catch(() => null) : null
    const branchId = await getBranchId(tenantId, payload?.branchId)
    if (!branchId) return NextResponse.json({ error: 'لا يوجد فرع للمستأجر' }, { status: 400 })

    const created = await prisma.storeSettings.create({
      data: {
        tenant:        { connect: { id: tenantId } },
        branch:        { connect: { id: branchId } },
        storeName, storePhone, storeAddress, footerMessage,
        autoPrint: autoPrint ?? false,
      },
    })
    return NextResponse.json({ success: true, settings: created })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'فشل حفظ الإعدادات' }, { status: 500 })
  }
}
