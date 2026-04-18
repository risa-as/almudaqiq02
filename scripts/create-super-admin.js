/**
 * سكريبت إنشاء حساب SUPER_ADMIN الأول
 *
 * الاستخدام:
 *   node scripts/create-super-admin.js
 *
 * أو لتغيير الاسم وكلمة المرور:
 *   node scripts/create-super-admin.js superadmin MySecurePass123
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
    const username = process.argv[2] || 'superadmin';
    const password = process.argv[3] || 'super@1234';

    // Check if already exists
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        if (existing.role === 'SUPER_ADMIN') {
            console.log(`✅ المستخدم "${username}" موجود مسبقاً بصلاحية SUPER_ADMIN.`);
        } else {
            // Upgrade existing user to SUPER_ADMIN
            await prisma.user.update({
                where: { username },
                data: { role: 'SUPER_ADMIN' }
            });
            console.log(`⬆️  تم ترقية "${username}" إلى SUPER_ADMIN.`);
        }
        return;
    }

    const user = await prisma.user.create({
        data: {
            username,
            password: hashPassword(password),
            role: 'SUPER_ADMIN',
        }
    });

    console.log('');
    console.log('✅ تم إنشاء حساب SUPER_ADMIN بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  اسم المستخدم : ${user.username}`);
    console.log(`  كلمة المرور  : ${password}`);
    console.log(`  الدور        : ${user.role}`);
    console.log(`  الرقم        : ${user.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  يرجى تغيير كلمة المرور فور تسجيل الدخول الأول.');
    console.log('');
}

main()
    .catch(e => { console.error('❌ خطأ:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
