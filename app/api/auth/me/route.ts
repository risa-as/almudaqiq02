import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return NextResponse.json({ user: null })

    const payload = await verifyAccessToken(token)
    return NextResponse.json({
      user: {
        id:       payload.sub,
        role:     payload.role,
        tenantId: payload.tenantId,
        branchId: payload.branchId,
      },
      isElectron: process.env.IS_ELECTRON === '1',
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
