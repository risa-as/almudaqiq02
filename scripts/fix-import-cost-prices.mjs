/**
 * fix-import-cost-prices.mjs
 *
 * يُصحح تكاليف المنتجات المستوردة التي لديها معامل تحويل > 1
 * المشكلة: استيراد Excel خزّن "سعر الشراء للكرتون" كـ costPrice
 * لكن النظام يتوقع costPrice = تكلفة الوحدة الأساسية (القطعة)
 *
 * التشغيل:
 *   node scripts/fix-import-cost-prices.mjs
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  console.log('\n🔍 البحث عن منتجات بمعامل تحويل > 1...\n')

  // Find all product units with conversionFactor > 1
  const units = await prisma.productUnit.findMany({
    where: { conversionFactor: { gt: 1 } },
    select: {
      id: true,
      name: true,
      conversionFactor: true,
      product: { select: { id: true, name: true, costPrice: true } },
    },
  })

  if (units.length === 0) {
    console.log('✅ لا توجد منتجات تحتاج إلى تصحيح.')
    return
  }

  console.log(`⚠️  وجدنا ${units.length} وحدة بمعامل تحويل > 1:\n`)

  let fixed = 0
  for (const unit of units) {
    const product    = unit.product
    const factor     = unit.conversionFactor
    const wrongCost  = Number(product.costPrice)
    const fixedCost  = wrongCost / factor

    console.log(`  📦 ${product.name}`)
    console.log(`     الوحدة: ${unit.name} (معامل ${factor})`)
    console.log(`     التكلفة الخاطئة : ${wrongCost.toLocaleString('ar-IQ')} د.ع`)
    console.log(`     التكلفة الصحيحة : ${fixedCost.toLocaleString('ar-IQ')} د.ع`)
    console.log('')

    // Update product costPrice
    await prisma.product.update({
      where: { id: product.id },
      data:  { costPrice: fixedCost },
    })

    // Update batch costPrice for IMPORT batches
    await prisma.productBatch.updateMany({
      where: { productId: product.id, batchNumber: 'IMPORT' },
      data:  { costPrice: fixedCost },
    })

    fixed++
  }

  console.log(`\n✅ تم تصحيح ${fixed} منتج بنجاح.`)
  console.log('   ملاحظة: الفواتير السابقة لا تتأثر (التكلفة مخزّنة في كل فاتورة مستقلة).\n')
}

main()
  .catch(e => { console.error('❌ خطأ:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
