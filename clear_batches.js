const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearAllBatches() {
    try {
        console.log('⚠️  جاري مسح جميع الدفعات...');

        // 1. Delete all ProductBatch records
        const deleted = await prisma.productBatch.deleteMany({});
        console.log(`✅ تم مسح ${deleted.count} دفعة من قاعدة البيانات`);

        // 2. Reset all products' baseStock to 0
        const updated = await prisma.product.updateMany({
            data: { baseStock: 0 }
        });
        console.log(`✅ تم تصفير كمية المخزون لـ ${updated.count} منتج`);

        console.log('\n🎉 تمت العملية بنجاح. يمكنك الآن إعادة إدخال البضاعة من صفحة (استلام البضاعة) بالأسعار الصحيحة.');
    } catch (error) {
        console.error('❌ خطأ:', error);
    } finally {
        await prisma.$disconnect();
    }
}

clearAllBatches();
