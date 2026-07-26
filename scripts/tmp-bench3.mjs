import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const tenantId = 'cmo8hfv8r0000w7c8mnzwwqyk';
const time = async (l, fn) => { const t=Date.now(); try { const r = await fn(); console.log(String(Date.now()-t).padStart(6)+'ms  '+l); return r; } catch(e){ console.log('  FAIL  '+l+' :: '+String(e.message).split('\n')[0].slice(0,90)); return null; } };
await p.$queryRaw`SELECT 1`;

const branches = s => p.branch.findMany({ where:{tenantId}, orderBy:{createdAt:'asc'},
  include:{ _count:{select:{transactions:true,users:true}}, storeSettings:{select:{storeName:true}} }, ...(s?{relationLoadStrategy:s}:{}) });
const cats = s => p.category.findMany({ where:{tenantId}, orderBy:[{sortOrder:'asc'},{name:'asc'}],
  include:{ parent:{select:{name:true}}, _count:{select:{products:true}} }, ...(s?{relationLoadStrategy:s}:{}) });
const sups = s => p.supplier.findMany({ where:{tenantId}, orderBy:{createdAt:'desc'},
  include:{ _count:{select:{products:true,ledger:true}} }, ...(s?{relationLoadStrategy:s}:{}) });

console.log('--- /api/branches ---');
const b1 = await time("query", ()=>branches('query')); await time("query", ()=>branches('query'));
const b2 = await time("join ", ()=>branches('join'));  await time("join ", ()=>branches('join'));
console.log('  identical:', b1&&b2 ? JSON.stringify(b1)===JSON.stringify(b2) : 'n/a');

console.log('--- /api/categories ---');
const c1 = await time("query", ()=>cats('query')); await time("query", ()=>cats('query'));
const c2 = await time("join ", ()=>cats('join'));  await time("join ", ()=>cats('join'));
console.log('  identical:', c1&&c2 ? JSON.stringify(c1)===JSON.stringify(c2) : 'n/a');

console.log('--- /api/suppliers ---');
const s1 = await time("query", ()=>sups('query')); await time("query", ()=>sups('query'));
const s2 = await time("join ", ()=>sups('join'));  await time("join ", ()=>sups('join'));
console.log('  identical:', s1&&s2 ? JSON.stringify(s1)===JSON.stringify(s2) : 'n/a');

console.log('--- getTenantFeatures (on /api/auth/me critical path) ---');
await time("tenantSubscription.findUnique+include plan", ()=>p.tenantSubscription.findUnique({where:{tenantId},include:{plan:{select:{features:true}}}}));
await time("same, join                                ", ()=>p.tenantSubscription.findUnique({where:{tenantId},include:{plan:{select:{features:true}}},relationLoadStrategy:'join'}));
await p.$disconnect();
