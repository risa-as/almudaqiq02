import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-helpers';
import { hashPassword } from '@/lib/auth';
import { canManage } from '@/lib/roles';
import { enqueueSync } from '@/lib/sync-enqueue';
import { logCloudDelete } from '@/lib/sync-delete-log';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const tenantId = auth.tenantId;

    try {
        const callerRole = auth.role;

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
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const tenantId = auth.tenantId;

    try {
        const callerRole = auth.role;
        const body = await request.json();
        const { email, password, role, username: rawUsername } = body;

        if (!email || !password) {
            return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 });
        }

        const username = rawUsername?.trim() ||
            `${email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'user'}-${Math.random().toString(36).slice(2, 6)}`;

        if (username.length < 2) {
            return NextResponse.json({ error: 'اسم المستخدم قصير جداً' }, { status: 400 });
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

        const usernameTaken = await prisma.user.findFirst({ where: { username, tenantId } });
        if (usernameTaken) {
            return NextResponse.json({ error: 'اسم المستخدم مستخدم مسبقاً' }, { status: 400 });
        }

        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password: await hashPassword(password),
                role: requestedRole,
                tenant: { connect: { id: tenantId } }
            }
        });

        // Desktop → cloud: queue the new user for push (no-op on web).
        // We send the already-hashed password so the cloud stores the same hash.
        enqueueSync('users', 'INSERT', newUser.id, {
            username: newUser.username,
            email:    newUser.email,
            password: newUser.password,
            role:     newUser.role,
            branchId: newUser.branchId,
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
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const tenantId = auth.tenantId;

    try {
        const callerRole = auth.role;
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: { id, tenantId }
        });
        if (!user) {
            return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
        }

        // Only users with strictly higher role can delete
        if (!canManage(callerRole, user.role)) {
            return NextResponse.json({ error: 'غير مصرح لك بحذف هذا المستخدم' }, { status: 403 });
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

        // Web → other devices: record the delete so desktops hard-delete on pull.
        await logCloudDelete(tenantId, 'users', id);
        // Desktop → cloud: queue the delete for push (no-op on web).
        enqueueSync('users', 'DELETE', id, {});

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete User Error:', error);
        return NextResponse.json({ error: 'فشل حذف المستخدم' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    const tenantId = auth.tenantId;

    try {
        const callerRole = auth.role;
        const body = await request.json();
        const { id, username, email, password, role } = body;

        if (!id) return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 });

        const user = await prisma.user.findFirst({ where: { id: String(id), tenantId } });
        if (!user) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });

        if (!canManage(callerRole, user.role)) {
            return NextResponse.json({ error: 'غير مصرح لك بتعديل هذا المستخدم' }, { status: 403 });
        }

        if (role && role !== user.role && !canManage(callerRole, role)) {
            return NextResponse.json({ error: 'غير مصرح لك بتعيين هذا الدور' }, { status: 403 });
        }

        if (username?.trim() && username.trim() !== user.username) {
            const taken = await prisma.user.findFirst({ where: { username: username.trim(), tenantId } });
            if (taken) return NextResponse.json({ error: 'اسم المستخدم مستخدم مسبقاً' }, { status: 400 });
        }

        if (email?.trim() && email.trim() !== user.email) {
            const taken = await prisma.user.findFirst({ where: { email: email.trim(), tenantId } });
            if (taken) return NextResponse.json({ error: 'البريد الإلكتروني مستخدم مسبقاً' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (username?.trim()) updateData.username = username.trim();
        if (email?.trim())    updateData.email    = email.trim();
        if (role)             updateData.role     = role;
        if (password?.trim()) updateData.password = await hashPassword(password.trim());

        const updated = await prisma.user.update({
            where: { id: String(id) },
            data: updateData,
            select: { id: true, username: true, email: true, role: true },
        });

        // Sync the same partial change. updateData already holds only the fields
        // that changed (incl. the bcrypt-hashed password when it was updated).
        enqueueSync('users', 'UPDATE', String(id), updateData);

        return NextResponse.json({ success: true, user: updated });

    } catch (error) {
        console.error('Update User Error:', error);
        return NextResponse.json({ error: 'فشل تحديث المستخدم' }, { status: 500 });
    }
}
