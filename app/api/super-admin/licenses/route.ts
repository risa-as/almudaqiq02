import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/multi-tenant/prisma'

export const dynamic = 'force-dynamic'

const DURATION_MAP: Record<string, number | null> = {
  '1M':       30  * 24 * 60 * 60 * 1000,
  '3M':       90  * 24 * 60 * 60 * 1000,
  '6M':       180 * 24 * 60 * 60 * 1000,
  '1Y':       365 * 24 * 60 * 60 * 1000,
  'LIFETIME': null,
}

function parseDurationMs(duration: string): number | null | undefined {
  if (Object.prototype.hasOwnProperty.call(DURATION_MAP, duration)) return DURATION_MAP[duration]
  const match = duration.match(/^(\d+)d$/i)
  if (match) {
    const days = parseInt(match[1], 10)
    if (days > 0) return days * 24 * 60 * 60 * 1000
  }
  return undefined
}

function requireSuperAdmin(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  if (role !== 'SUPER_ADMIN') return false
  return true
}

// GET: list all licenses
export async function GET(request: NextRequest) {
  if (!requireSuperAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const licenses = await prisma.licenseLog.findMany({ orderBy: { generatedAt: 'desc' } })
  return NextResponse.json({ licenses })
}

// POST: generate new license
export async function POST(request: NextRequest) {
  if (!requireSuperAdmin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { clientName, duration, machineId, clientPhone, clientAddress } = await request.json()

  if (!clientName || !duration) {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
  }

  const durationMs = parseDurationMs(duration)
  if (durationMs === undefined) {
    return NextResponse.json({ error: 'مدة ترخيص غير صحيحة' }, { status: 400 })
  }

  const secretKey = process.env.LICENSE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'LICENSE_SECRET_KEY غير مُعيَّن' }, { status: 500 })
  }

  const secret = new TextEncoder().encode(secretKey)
  const issuedAt = new Date()
  const expiresAt = durationMs ? new Date(issuedAt.getTime() + durationMs) : null

  const jwtBuilder = new SignJWT({
    clientName,
    duration,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt ? expiresAt.toISOString() : 'LIFETIME',
    allowedMachineId: machineId ? machineId.toLowerCase().trim() : null,
  }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt()

  if (expiresAt) jwtBuilder.setExpirationTime(expiresAt)

  const licenseKey = await jwtBuilder.sign(secret)

  const superAdminId = request.headers.get('x-user-id') ?? undefined

  await prisma.licenseLog.create({
    data: {
      clientName,
      clientPhone: clientPhone || null,
      clientAddress: clientAddress || null,
      duration,
      expiresAt,
      licenseKey,
      machineId: machineId ? machineId.toLowerCase().trim() : null,
      generatedBy: superAdminId,
    },
  })

  return NextResponse.json({ success: true, licenseKey, clientName, duration, expiresAt: expiresAt?.toISOString() ?? 'مدى الحياة' }, { status: 201 })
}
