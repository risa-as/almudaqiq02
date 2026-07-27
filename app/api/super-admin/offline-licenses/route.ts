import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, importPKCS8 } from 'jose'
import { randomInt } from 'crypto'
import * as bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { withCloudDb } from '@/lib/cloud-guard'
import { getSuperAdminContext } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// ─── Duration parsing (mirrors app/api/super-admin/licenses/route.ts exactly —
// duplicated on purpose: that route must not be touched by this feature) ─────
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

// ─── Strong random password generator (crypto-secure, no ambiguous glyphs) ───
function generateStrongPassword(length = 14): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I/O
  const lower   = 'abcdefghijkmnopqrstuvwxyz' // no l
  const digits  = '23456789'                  // no 0/1
  const symbols = '!@#$%^&*-_=+'
  const all     = upper + lower + digits + symbols
  const pick    = (set: string) => set[randomInt(set.length)]

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (chars.length < length) chars.push(pick(all))

  // Fisher–Yates shuffle using a CSPRNG so the fixed-category prefix above
  // doesn't leak positional structure into the final password.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

const GenerateSchema = z.object({
  clientName:     z.string().min(1, 'اسم العميل مطلوب'),
  clientUsername: z.string().min(3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل').max(32, 'اسم المستخدم طويل جداً')
                    .regex(/^[a-zA-Z0-9._-]+$/, 'اسم المستخدم يجب أن يحتوي أحرفاً/أرقاماً إنجليزية أو . _ - فقط'),
  clientPassword: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 أحرف').optional(),
  clientEmail:    z.string().email('بريد إلكتروني غير صحيح').optional(),
  clientPhone:    z.string().optional(),
  clientAddress:  z.string().optional(),
  duration:       z.string().min(1, 'مدة الترخيص مطلوبة'),
  // ── معرّف الجهاز إلزامي ──────────────────────────────────────────────────
  // هذا هو الإجراء الوحيد الفعّال ضد إعادة استخدام المفتاح الواحد على عدة
  // أجهزة. تطبيق سطح المكتب أوف لاين بالكامل: لا اتصال بعد التفعيل، ولا إحصاء
  // للتفعيلات، ولا إلغاء عن بُعد. لحظة الإصدار هي الفرصة الوحيدة للربط، وتركه
  // اختيارياً يعني عملياً بيع ترخيص غير محدود النسخ.
  //
  // يقرأ العميل بصمة جهازه من شاشة التفعيل. الصيغة عنوان MAC.
  machineId:      z.string()
                    .trim()
                    .min(1, 'معرّف الجهاز مطلوب — اطلبه من العميل من شاشة التفعيل')
                    .regex(
                      /^[0-9a-fA-F]{2}([:-][0-9a-fA-F]{2}){5}$/,
                      'صيغة معرّف الجهاز غير صحيحة (المتوقع: aa:bb:cc:dd:ee:ff)',
                    ),
  notes:          z.string().optional(),
})

export async function POST(request: NextRequest) {
  return withCloudDb(async () => {
    const sa = await getSuperAdminContext()
    if (!sa) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const rawBody = await request.json().catch(() => null)
    if (!rawBody) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

    // Normalize optional string fields: trim, and treat '' as "not provided"
    // so zod's .email()/.min() rules don't reject an intentionally-empty field.
    const normalized = {
      ...rawBody,
      clientEmail:    typeof rawBody.clientEmail === 'string'    ? (rawBody.clientEmail.trim()    || undefined) : undefined,
      clientPhone:    typeof rawBody.clientPhone === 'string'    ? (rawBody.clientPhone.trim()    || undefined) : undefined,
      clientAddress:  typeof rawBody.clientAddress === 'string'  ? (rawBody.clientAddress.trim()  || undefined) : undefined,
      // معرّف الجهاز حقل إلزامي، فلا يُحوَّل الفراغ إلى undefined — وإلا ظهرت
      // رسالة zod العامة ("Required") بدل الرسالة الموجِّهة المكتوبة في المخطط.
      machineId:      typeof rawBody.machineId === 'string'      ? rawBody.machineId.trim() : '',
      notes:          typeof rawBody.notes === 'string'          ? (rawBody.notes.trim()          || undefined) : undefined,
      clientPassword: typeof rawBody.clientPassword === 'string' ? (rawBody.clientPassword.trim() || undefined) : undefined,
    }

    const parsed = GenerateSchema.safeParse(normalized)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json({ error: first?.message || 'بيانات غير صحيحة', details: parsed.error.flatten() }, { status: 400 })
    }

    const { clientName, clientUsername, clientEmail, clientPhone, clientAddress, duration, machineId, notes } = parsed.data

    const durationMs = parseDurationMs(duration)
    if (durationMs === undefined) return NextResponse.json({ error: 'مدة ترخيص غير صحيحة' }, { status: 400 })

    const privateKeyPemRaw = process.env.LICENSE_PRIVATE_KEY
    if (!privateKeyPemRaw) {
      return NextResponse.json(
        { error: 'مفتاح التوقيع الخاص بالتراخيص (LICENSE_PRIVATE_KEY) غير مُعيَّن على الخادم' },
        { status: 500 }
      )
    }

    // Env vars typically carry the PEM with literal "\n" sequences instead of
    // real newlines — normalize both representations.
    const privateKeyPem = privateKeyPemRaw.includes('\\n') ? privateKeyPemRaw.replace(/\\n/g, '\n') : privateKeyPemRaw

    let privateKey
    try {
      privateKey = await importPKCS8(privateKeyPem, 'EdDSA')
    } catch {
      return NextResponse.json(
        { error: 'تعذّر قراءة مفتاح التوقيع الخاص — تأكد من أنه بصيغة Ed25519 PKCS8 PEM صحيحة' },
        { status: 500 }
      )
    }

    const plainPassword = normalized.clientPassword ?? generateStrongPassword()
    const passwordHash  = await bcrypt.hash(plainPassword, 12)

    const issuedAt            = new Date()
    const expiresAt           = durationMs ? new Date(issuedAt.getTime() + durationMs) : null
    const normalizedMachineId = machineId ? machineId.toLowerCase().trim() : null
    const superAdminId        = sa.superAdminId

    // Create first (placeholder licenseKey) to obtain a stable licenseId that
    // is then embedded in the signed token itself.
    const created = await prisma.offlineLicense.create({
      data: {
        clientName,
        clientEmail:    clientEmail    || null,
        clientPhone:    clientPhone    || null,
        clientAddress:  clientAddress  || null,
        clientUsername,
        passwordHash,
        duration,
        expiresAt,
        machineId:   normalizedMachineId,
        licenseKey:  '',
        notes:       notes || null,
        generatedBy: superAdminId,
      },
    })

    const jwtBuilder = new SignJWT({
      v:                  2,
      clientName,
      clientEmail:        clientEmail || null,
      clientUsername,
      clientPasswordHash: passwordHash,
      duration,
      issuedAt:            issuedAt.toISOString(),
      expiresAt:           expiresAt ? expiresAt.toISOString() : 'LIFETIME',
      allowedMachineId:    normalizedMachineId,
      licenseId:           created.id,
    }).setProtectedHeader({ alg: 'EdDSA' }).setIssuedAt()

    if (expiresAt) jwtBuilder.setExpirationTime(expiresAt)

    const licenseKey = await jwtBuilder.sign(privateKey)

    await prisma.offlineLicense.update({ where: { id: created.id }, data: { licenseKey } })

    return NextResponse.json(
      {
        success:  true,
        licenseId: created.id,
        licenseKey,
        clientName,
        clientUsername,
        // Plaintext password: returned ONCE here, never persisted, never retrievable again.
        clientPassword: plainPassword,
        duration,
        expiresAt: expiresAt?.toISOString() ?? 'مدى الحياة',
      },
      { status: 201 }
    )
  })
}

export async function GET(request: NextRequest) {
  return withCloudDb(async () => {
    const sa = await getSuperAdminContext()
    if (!sa) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    const licenses = await prisma.offlineLicense.findMany({
      where: q
        ? {
            OR: [
              { clientName:     { contains: q, mode: 'insensitive' } },
              { clientUsername: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { generatedAt: 'desc' },
      select: {
        id:             true,
        clientName:     true,
        clientEmail:    true,
        clientPhone:    true,
        clientAddress:  true,
        clientUsername: true,
        duration:       true,
        expiresAt:      true,
        machineId:      true,
        licenseKey:     true,
        isRevoked:      true,
        revokedAt:      true,
        notes:          true,
        generatedAt:    true,
        generatedBy:    true,
        // passwordHash is intentionally never selected/returned
      },
    })

    return NextResponse.json({ licenses })
  })
}

const PatchSchema = z.object({
  id:         z.string().min(1),
  isRevoked:  z.boolean(),
})

export async function PATCH(request: NextRequest) {
  return withCloudDb(async () => {
    const sa = await getSuperAdminContext()
    if (!sa) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body   = await request.json().catch(() => null)
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })

    const { id, isRevoked } = parsed.data

    const existing = await prisma.offlineLicense.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'الترخيص غير موجود' }, { status: 404 })

    // NOTE: revocation is advisory only. A fully offline desktop install has
    // no way to learn about this unless/until it reaches the network again,
    // so this flag is informational for the super-admin, not an enforcement
    // mechanism by itself.
    const updated = await prisma.offlineLicense.update({
      where: { id },
      data: {
        isRevoked,
        revokedAt: isRevoked ? new Date() : null,
      },
      select: {
        id: true, clientName: true, clientUsername: true, duration: true, expiresAt: true,
        machineId: true, isRevoked: true, revokedAt: true, notes: true, generatedAt: true,
      },
    })

    return NextResponse.json({ success: true, license: updated })
  })
}
