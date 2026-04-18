import { NextRequest, NextResponse } from 'next/server'

/**
 * هذا الـ endpoint أصبح مهجوراً — تسجيل الدخول موحّد الآن في /api/auth/login
 * يُبقى هنا لمنع 404 على أي client قديم، ويُعيد توجيهه.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'هذا المسار مهجور. استخدم /api/auth/login', redirectTo: '/api/auth/login' },
    { status: 410 },
  )
}
