import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Generate internal slug from name + random suffix
function generateSlug(name: string): string {
  const suffix = Math.random().toString(36).slice(2, 7)
  const base   = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'tenant'
  return `${base}-${suffix}`.slice(0, 50)
}

// ── GET /api/super-admin/tenants ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? undefined

  const where = {
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    ...(status ? { status } : {}),
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        subscription: { include: { plan: { select: { name: true } } } },
        _count: { select: { branches: true, users: true } },
        users: { where: { role: 'ADMIN' }, select: { email: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tenant.count({ where }),
  ])

  return NextResponse.json({ tenants, total, page, limit })
}

// ── POST /api/super-admin/tenants ────────────────────────────────────────────
const CreateSchema = z.object({
  name:          z.string().min(2),
  planName:      z.string().default('Basic'),
  adminEmail:    z.string().email('بريد إلكتروني غير صحيح'),
  adminPassword: z.string().min(6),
  trialDays:     z.number().int().min(0).default(14),
})

export async function POST(request: NextRequest) {
  const body   = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, planName, adminEmail, adminPassword, trialDays } = parsed.data

  // Check email uniqueness
  const existingUser = await prisma.user.findFirst({ where: { email: adminEmail } })
  if (existingUser) return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 409 })

  // Find plan
  const plan = await prisma.subscriptionPlan.findUnique({ where: { name: planName } })
  if (!plan) return NextResponse.json({ error: `الخطة "${planName}" غير موجودة` }, { status: 400 })

  // Generate unique slug
  let slug = generateSlug(name)
  while (await prisma.tenant.findUnique({ where: { slug } })) slug = generateSlug(name)

  // Auto-generate username from email prefix + random suffix
  const emailPrefix = adminEmail.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'admin'
  const randomSuffix = Math.random().toString(36).slice(2, 6)
  let adminUsername = `${emailPrefix}-${randomSuffix}`

  const trialEndDate = trialDays > 0 ? new Date(Date.now() + trialDays * 86400_000) : null
  const hashedPwd    = await hashPassword(adminPassword)

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      status: trialDays > 0 ? 'TRIAL' : 'ACTIVE',
      subscription: {
        create: {
          planId:       plan.id,
          status:       trialDays > 0 ? 'TRIAL' : 'ACTIVE',
          startDate:    new Date(),
          trialEndDate,
        },
      },
      branches: {
        create: {
          name:     'الفرع الرئيسي',
          isActive: true,
        },
      },
      users: {
        create: {
          username: adminUsername,
          password: hashedPwd,
          role:     'ADMIN',
          email:    adminEmail,
        },
      },
    },
    include: { subscription: { include: { plan: true } }, _count: { select: { branches: true } } },
  })

  return NextResponse.json({ id: tenant.id, name: tenant.name, email: adminEmail }, { status: 201 })
}
