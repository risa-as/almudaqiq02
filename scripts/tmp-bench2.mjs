import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const tenantId = 'cmo8hfv8r0000w7c8mnzwwqyk';
const branchId = 'cmo8hfvt90005w7c872vxlnos';
const time = async (l, fn) => { const t=Date.now(); const r = await fn(); console.log(String(Date.now()-t).padStart(6)+'ms  '+l); return r; };
await p.$queryRaw`SELECT 1`;
await time('SELECT 1 (round-trip floor)', () => p.$queryRaw`SELECT 1`);

const q = (strategy) => p.product.findMany({
  where:{tenantId}, include:{units:true,category:true,supplier:true}, orderBy:{id:'desc'},
  ...(strategy ? { relationLoadStrategy: strategy } : {}),
});

console.log('\n--- query strategy ---');
let a, b;
for (let i=0;i<3;i++) a = await time("relationLoadStrategy: 'query' (current default)", () => q('query'));
for (let i=0;i<3;i++) b = await time("relationLoadStrategy: 'join'  (NEW)",             () => q('join'));

// correctness: identical output?
const norm = r => JSON.stringify(r.map(x=>({...x, units:[...x.units].sort((m,n)=>m.id<n.id?-1:1)})));
console.log('\nsame row count:', a.length === b.length, a.length);
console.log('IDENTICAL output:', norm(a) === norm(b));
const s = b.find(x=>x.supplier), c = b.find(x=>x.category);
console.log('sample w/ supplier:', s ? {name:s.name, cat:s.category?.name, sup:s.supplier?.name, units:s.units.length} : 'none');
await p.$disconnect();
