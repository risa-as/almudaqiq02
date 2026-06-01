import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken, verifyPassword, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getSuperAdminId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return null;
    const payload = await verifyAccessToken(token);
    if (payload.role !== "SUPER_ADMIN") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

// GET — fetch current profile
export async function GET() {
  const id = await getSuperAdminId();
  if (!id) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const sa = await prisma.superAdmin.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!sa)
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  return NextResponse.json(sa);
}

// PUT — update profile (username / email / password)
export async function PUT(request: NextRequest) {
  const id = await getSuperAdminId();
  if (!id) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

  const { username, email, currentPassword, newPassword } = body;

  // Load current record for password verification
  const sa = await prisma.superAdmin.findUnique({ where: { id } });
  if (!sa)
    return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  const updateData: Record<string, any> = {};

  // Username
  if (username && username.trim() !== sa.username) {
    const taken = await prisma.superAdmin.findFirst({
      where: { username: username.trim(), NOT: { id } },
    });
    if (taken)
      return NextResponse.json(
        { error: "اسم المستخدم مستخدم من قِبَل حساب آخر" },
        { status: 409 },
      );
    updateData.username = username.trim();
  }

  // Email
  if (email !== undefined) {
    const cleaned = email?.trim() || null;
    if (cleaned !== sa.email) {
      if (cleaned) {
        const taken = await prisma.superAdmin.findFirst({
          where: { email: cleaned, NOT: { id } },
        });
        if (taken)
          return NextResponse.json(
            { error: "البريد الإلكتروني مستخدم من قِبَل حساب آخر" },
            { status: 409 },
          );
      }
      updateData.email = cleaned;
    }
  }

  // Password change
  if (newPassword) {
    if (!currentPassword)
      return NextResponse.json(
        { error: "يجب إدخال كلمة المرور الحالية لتغييرها" },
        { status: 400 },
      );
    const valid = await verifyPassword(currentPassword, sa.password);
    if (!valid)
      return NextResponse.json(
        { error: "كلمة المرور الحالية غير صحيحة" },
        { status: 400 },
      );
    if (newPassword.length < 6)
      return NextResponse.json(
        { error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 },
      );
    updateData.password = await hashPassword(newPassword);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "لا توجد تغييرات" });
  }

  const updated = await prisma.superAdmin.update({
    where: { id },
    data: updateData,
    select: { id: true, username: true, email: true, updatedAt: true },
  });

  return NextResponse.json({ message: "تم الحفظ بنجاح", user: updated });
}
