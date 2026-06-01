/**
 * fix-base-stock.mjs
 * Sync product.baseStock with the actual sum of productBatch.quantity for each product.
 * The import route previously stored baseStock in selling units (cartons) instead of
 * base units, causing a mismatch with the batch quantities that were stored correctly.
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  // Get all products with their batch sums
  const [products, batchSums] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, baseStock: true, tenantId: true } }),
    prisma.productBatch.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
    }),
  ]);

  const batchMap = new Map(batchSums.map(b => [b.productId, b._sum.quantity ?? 0]));

  let updated = 0;
  for (const product of products) {
    const correctStock = batchMap.has(product.id)
      ? (batchMap.get(product.id) ?? 0)
      : product.baseStock;

    if (correctStock !== product.baseStock) {
      await prisma.product.update({
        where: { id: product.id },
        data: { baseStock: correctStock },
      });
      console.log(`  ✓ ${product.name}: ${product.baseStock} → ${correctStock}`);
      updated++;
    }
  }

  console.log(`\nDone — updated ${updated} of ${products.length} products.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
