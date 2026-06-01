import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRefreshToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  // Revoke refresh token if provided
  const refreshToken = request.cookies.get('refresh-token')?.value
  if (refreshToken) {
    try {
      await verifyRefreshToken(refreshToken)
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      })
    } catch { /* ignore invalid token */ }
  }

  const res = NextResponse.json({ success: true })
  res.cookies.delete('auth-token')
  res.cookies.delete('refresh-token')
  // Legacy cookie cleanup
  res.cookies.delete('session')
  return res
}
