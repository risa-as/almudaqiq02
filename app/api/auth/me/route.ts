import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-helpers'
import { getTenantFeatures } from '@/lib/plan-features'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await getAuthContext()
    if (!auth) return NextResponse.json({ user: null })

    const features = await getTenantFeatures(auth.tenantId)
    return NextResponse.json({
      user: {
        id:       auth.userId,
        role:     auth.role,
        tenantId: auth.tenantId,
        branchId: auth.branchId,
      },
      features,
      isElectron: process.env.IS_ELECTRON === '1',
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
