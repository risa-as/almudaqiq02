import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { getTenantId } from '@/lib/api-helpers';
import { canManage } from '@/lib/roles';

export const dynamic = 'force-dynamic';

function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

export async function GET(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const callerRole = request.headers.get('x-user-role') || 'CASHIER';

        const users = await prisma.user.findMany({
            where: { tenantId },
            select: { id: true, username: true, email: true, role: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });

        // ADMIN can see everyone except SUPER_ADMIN accounts
        if (callerRole === 'ADMIN') {
            return NextResponse.json(users.filter(u => u.role !== 'SUPER_ADMIN'));
        }

        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const callerRole = request.headers.get('x-user-role') || 'CASHIER';
        const body = await request.json();
        const { email, password, role } = body;

        if (!email || !password) {
            return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 });
        }

        const requestedRole = role || 'CASHIER';

        // المنشئ لا يستطيع إنشاء مستخدم بدور مساوٍ له أو أعلى منه
        if (!canManage(callerRole, requestedRole)) {
            return NextResponse.json({ error: 'غير مصرح لك بإنشاء مستخدم بهذا الدور' }, { status: 403 });
        }

        const existing = await prisma.user.findFirst({ where: { email, tenantId } });
        if (existing) {
            return NextResponse.json({ error: 'البريد الإلكتروني مستخدم مسبقاً' }, { status: 400 });
        }

        // Auto-generate unique username from email prefix
        const prefix = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'user';
        const username = `${prefix}-${Math.random().toString(36).slice(2, 6)}`;

        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password: hashPassword(password),
                role: requestedRole,
                tenant: { connect: { id: tenantId } }
            }
        });

        return NextResponse.json({
            success: true,
            user: { id: newUser.id, email: newUser.email, role: newUser.role }
        });

    } catch (error) {
        console.error('Create User Error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    try {
        const callerRole = request.headers.get('x-user-role') || 'CASHIER';
        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get('id'));

        if (!id) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: { id, tenantId }
        });
        if (!user) {
            return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
        }

        // Only SUPER_ADMIN can delete SUPER_ADMIN accounts
        if (user.role === 'SUPER_ADMIN' && callerRole !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'لا يمكن حذف حساب سوبر أدمن' }, { status: 403 });
        }

        // Prevent deleting last ADMIN (SUPER_ADMIN doesn't count as ADMIN here)
        if (user.role === 'ADMIN') {
            const adminCount = await prisma.user.count({ where: { role: 'ADMIN', tenantId } });
            if (adminCount <= 1) {
                return NextResponse.json({ error: 'لا يمكن حذف آخر مدير في النظام' }, { status: 400 });
            }
        }

        // Prevent deleting last SUPER_ADMIN
        if (user.role === 'SUPER_ADMIN') {
            const superAdminCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN', tenantId } });
            if (superAdminCount <= 1) {
                return NextResponse.json({ error: 'لا يمكن حذف آخر سوبر أدمن في النظام' }, { status: 400 });
            }
        }

        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete User Error:', error);
        return NextResponse.json({ error: 'فشل حذف المستخدم' }, { status: 500 });
    }
}
