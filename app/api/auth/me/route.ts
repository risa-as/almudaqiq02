import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getTenantFeatures } from '@/lib/plan-features'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json({ user: null })

    const payload = await verifyAccessToken(token)
    const features = payload.tenantId ? await getTenantFeatures(payload.tenantId) : {}
    return NextResponse.json({
      user: {
        id:       payload.sub,
        role:     payload.role,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
      },
      features,
      isElectron: process.env.IS_ELECTRON === '1',
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
