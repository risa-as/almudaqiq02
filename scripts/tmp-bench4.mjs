import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const tenantId = 'cmo8hfv8r0000w7c8mnzwwqyk';
const N = 9;
const med = a => { const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
const run = async fn => { const t=Date.now(); await fn(); return Date.now()-t; };

await p.$queryRaw`SELECT 1`;
const q = s => () => p.product.findMany({ where:{tenantId}, include:{units:true,category:true,supplier:true}, orderBy:{id:'desc'}, relationLoadStrategy:s });
const rt = () => p.$queryRaw`SELECT 1`;

const res = { floor:[], query:[], join:[] };
// interleave so network drift hits all three equally
for (let i=0;i<N;i++) {
  res.floor.push(await run(rt));
  res.query.push(await run(q('query')));
  res.join .push(await run(q('join')));
}
const fmt = a => `median ${String(med(a)).padStart(5)}ms   min ${String(Math.min(...a)).padStart(5)}   max ${String(Math.max(...a)).padStart(5)}`;
console.log('round-trip floor (SELECT 1) :', fmt(res.floor));
console.log("include, strategy 'query'   :", fmt(res.query));
console.log("include, strategy 'join'    :", fmt(res.join));
const g = med(res.query) - med(res.join);
console.log(`\n=> join saves ~${g}ms per /api/products call (median), ` +
  `${(med(res.query)/med(res.join)).toFixed(2)}x faster`);
console.log(`=> query costs ${(med(res.query)/med(res.floor)).toFixed(1)} round trips, join costs ${(med(res.join)/med(res.floor)).toFixed(1)}`);
await p.$disconnect();
