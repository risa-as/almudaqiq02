import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/multi-tenant/prisma'
import { hashPassword } from '@/lib/auth'
import { withCloudDb } from '@/lib/cloud-guard'

export const dynamic = 'force-dynamic'

function generateSlug(name: string): string {
  const suffix = Math.random().toString(36).slice(2, 7)
  const base   = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'tenant'
  return `${base}-${suffix}`.slice(0, 50)
}

export async function GET(request: NextRequest) {
  return withCloudDb(async () => {
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
  })
}

const CreateSchema = z.object({
  name:          z.string().min(2),
  planName:      z.string().default('Basic'),
  adminEmail:    z.string().email('بريد إلكتروني غير صحيح'),
  adminPassword: z.string().min(6),
  trialDays:     z.number().int().min(0).default(14),
  aiDailyLimit:  z.number().int().min(0).max(10000).default(50),
})

export async function POST(request: NextRequest) {
  return withCloudDb(async () => {
    const body   = await request.json().catch(() => null)
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { name, planName, adminEmail, adminPassword, trialDays, aiDailyLimit } = parsed.data

    const existingUser = await prisma.user.findFirst({ where: { email: adminEmail } })
    if (existingUser) return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 409 })

    const plan = await prisma.subscriptionPlan.findUnique({ where: { name: planName } })
    if (!plan) return NextResponse.json({ error: `الخطة "${planName}" غير موجودة` }, { status: 400 })

    let slug = generateSlug(name)
    while (await prisma.tenant.findUnique({ where: { slug } })) slug = generateSlug(name)

    const emailPrefix   = adminEmail.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'admin'
    const randomSuffix  = Math.random().toString(36).slice(2, 6)
    const adminUsername = `${emailPrefix}-${randomSuffix}`

    const trialEndDate = trialDays > 0 ? new Date(Date.now() + trialDays * 86400_000) : null
    const hashedPwd    = await hashPassword(adminPassword)

    // Step 1 — Tenant + subscription
    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug,
        status:       trialDays > 0 ? 'TRIAL' : 'ACTIVE',
        aiDailyLimit,
        subscription: {
          create: {
            planId:      plan.id,
            status:      trialDays > 0 ? 'TRIAL' : 'ACTIVE',
            startDate:   new Date(),
            trialEndDate,
          },
        },
      },
    })

    // Step 2 — Default branch
    const branch = await prisma.branch.create({
      data: { tenantId: tenant.id, name: 'الفرع الرئيسي', isActive: true },
    })

    // Step 3 — Admin user linked to the branch
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        username: adminUsername,
        password: hashedPwd,
        role:     'ADMIN',
        email:    adminEmail,
      },
    })

    // Step 4 — Store settings for the branch
    await prisma.storeSettings.create({
      data: { tenantId: tenant.id, branchId: branch.id, storeName: name },
    })

    return NextResponse.json(
      { id: tenant.id, name: tenant.name, email: adminEmail, branchId: branch.id },
      { status: 201 },
    )
  })
}
