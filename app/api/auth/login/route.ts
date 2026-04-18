import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import {
  verifyPassword,
  generateTokenPair,
  generateSuperAdminAccessToken,
  generateSuperAdminRefreshToken,
} from '@/lib/auth'

export const dynamic = 'force-dynamic'

const LoginSchema = z.object({
  email:    z.string().email('بريد إلكتروني غير صحيح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
})

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

function redirectTo(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':    return '/super-admin/dashboard'
    case 'CASHIER':        return '/pos'
    case 'STOCK_KEEPER':   return '/dashboard/inventory'
    default:               return '/dashboard'  // ADMIN, BRANCH_MANAGER
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' }, { status: 400 })
  }
  const { email, password } = parsed.data

  // ── 1. البحث في SuperAdmin أولاً ────────────────────────────────────────────
  const superAdmin = await prisma.superAdmin.findFirst({ where: { email } })
  if (superAdmin) {
    // فحص القفل
    if (superAdmin.lockedUntil && superAdmin.lockedUntil > new Date()) {
      const remaining = Math.ceil((superAdmin.lockedUntil.getTime() - Date.now()) / 60000)
      return NextResponse.json({ error: `الحساب مقفل. حاول بعد ${remaining} دقيقة` }, { status: 423 })
    }

    const valid = await verifyPassword(password, superAdmin.password)
    if (!valid) {
      const attempts = superAdmin.failedAttempts + 1
      const locked   = attempts >= MAX_ATTEMPTS
      await prisma.superAdmin.update({
        where: { id: superAdmin.id },
        data:  { failedAttempts: attempts, lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      })
      return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
    }

    await prisma.superAdmin.update({ where: { id: superAdmin.id }, data: { failedAttempts: 0, lockedUntil: null } })

    const [accessToken, refreshToken] = await Promise.all([
      generateSuperAdminAccessToken(superAdmin.id),
      generateSuperAdminRefreshToken(superAdmin.id),
    ])
    await prisma.refreshToken.create({
      data: { token: refreshToken, superAdminId: superAdmin.id, expiresAt: new Date(Date.now() + 30 * 86400_000) },
    })

    const res = NextResponse.json({
      accessToken,
      user:       { id: superAdmin.id, email: superAdmin.email, role: 'SUPER_ADMIN' },
      redirectTo: '/super-admin/dashboard',
    })
    res.cookies.set('auth-token',    accessToken,  { httpOnly: true, path: '/',                  sameSite: 'lax', maxAge: 28800 })
    res.cookies.set('refresh-token', refreshToken, { httpOnly: true, path: '/api/auth/refresh', sameSite: 'lax', maxAge: 30 * 86400 })
    return res
  }

  // ── 2. البحث في User بالـ email ──────────────────────────────────────────────
  const user = await prisma.user.findFirst({
    where:   { email },
    include: { tenant: { select: { id: true, name: true, status: true } } },
  })

  if (!user) {
    // رسالة موحدة لا تكشف إن كان الـ email موجوداً أم لا
    return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
  }

  // فحص حالة الـ tenant
  if (user.tenant.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'الحساب معلق، تواصل مع الدعم' }, { status: 403 })
  }
  if (user.tenant.status === 'CANCELLED') {
    return NextResponse.json({ error: 'الاشتراك ملغى' }, { status: 403 })
  }

  // فحص قفل الحساب
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return NextResponse.json({ error: `الحساب مقفل. حاول بعد ${remaining} دقيقة` }, { status: 423 })
  }

  // فحص كلمة المرور
  const valid = await verifyPassword(password, user.password)
  if (!valid) {
    const attempts = user.failedAttempts + 1
    const locked   = attempts >= MAX_ATTEMPTS
    await prisma.user.update({
      where: { id: user.id },
      data:  { failedAttempts: attempts, lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    })
    const msg = locked
      ? `تم قفل الحساب لمدة ${LOCK_MINUTES} دقيقة`
      : 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  // إعادة تعيين عداد المحاولات
  await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } })

  // توليد الـ tokens
  const { accessToken, refreshToken } = await generateTokenPair({
    sub:      user.id,
    role:     user.role as string,
    tenantId: user.tenantId,
    branchId: user.branchId ?? undefined,
  })

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 30 * 86400_000) },
  })

  const res = NextResponse.json({
    accessToken,
    user:       { id: user.id, email: user.email, role: user.role },
    tenant:     { id: user.tenant.id, name: user.tenant.name },
    redirectTo: redirectTo(user.role as string),
  })
  res.cookies.set('auth-token',    accessToken,  { httpOnly: true, path: '/',                  sameSite: 'lax', maxAge: 28800 })
  res.cookies.set('refresh-token', refreshToken, { httpOnly: true, path: '/api/auth/refresh', sameSite: 'lax', maxAge: 30 * 86400 })
  return res
}
