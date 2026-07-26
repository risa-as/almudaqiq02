import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const tenantId = 'cmo8hfv8r0000w7c8mnzwwqyk';
const branchId = 'cmo8hfvt90005w7c872vxlnos';
const time = async (label, fn) => { const t=Date.now(); const r = await fn(); console.log(String(Date.now()-t).padStart(6)+'ms  '+label); return r; };

await p.$queryRaw`SELECT 1`; // warm
console.log('--- baseline ---');
await time('SELECT 1 (pure round trip)', () => p.$queryRaw`SELECT 1`);
await time('SELECT 1 (again)',           () => p.$queryRaw`SELECT 1`);

console.log('\n--- current /api/products implementation ---');
for (let i=0;i<2;i++) await time('Promise.all[findMany+include{units,category,supplier}, groupBy]', () => Promise.all([
  p.product.findMany({ where:{tenantId}, include:{units:true,category:true,supplier:true}, orderBy:{id:'desc'} }),
  p.productBatch.groupBy({ by:['productId'], where:{tenantId,branchId}, _sum:{quantity:true} }),
]));

console.log('\n--- alternatives ---');
for (let i=0;i<2;i++) await time('findMany WITHOUT any include', () => p.product.findMany({ where:{tenantId}, orderBy:{id:'desc'} }));
for (let i=0;i<2;i++) await time('findMany include{units} only',  () => p.product.findMany({ where:{tenantId}, include:{units:true}, orderBy:{id:'desc'} }));

console.log('\n--- single raw SQL doing the whole job ---');
for (let i=0;i<2;i++) await time('one $queryRaw (products+units+cat+sup+stock)', () => p.$queryRaw`
  SELECT pr.id, pr.name, pr."costPrice", pr."baseStock", pr."minimumStock", pr."isQuickSale",
         pr."categoryId", pr."supplierId", c.name AS cat_name, s.name AS sup_name,
         COALESCE(b.qty, 0) AS batch_stock,
         COALESCE(json_agg(json_build_object('id',u.id,'name',u.name,'price',u.price,
           'conversionFactor',u."conversionFactor",'barcode',u.barcode))
           FILTER (WHERE u.id IS NOT NULL), '[]') AS units
  FROM "Product" pr
  LEFT JOIN "Category" c ON c.id = pr."categoryId"
  LEFT JOIN "Supplier" s ON s.id = pr."supplierId"
  LEFT JOIN "ProductUnit" u ON u."productId" = pr.id
  LEFT JOIN (SELECT "productId", SUM(quantity) qty FROM "ProductBatch"
             WHERE "tenantId"=${tenantId} AND "branchId"=${branchId} GROUP BY "productId") b
         ON b."productId" = pr.id
  WHERE pr."tenantId" = ${tenantId}
  GROUP BY pr.id, c.name, s.name, b.qty
  ORDER BY pr.id DESC`);
await p.$disconnect();
