const sharp = require('sharp');
const fs = require('fs');

(async () => {
  const lensSrc = fs.readFileSync('_ico_largest.png'); // current production lens (256, fills frame)
  const base = 256;
  // Grow the canvas by 20% → the lens keeps its size, the extra area is pure white.
  const C = 308; // 256 * 1.20 ≈ 307 → even
  const lens256 = await sharp(lensSrc).resize(base, base, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' }).png().toBuffer();

  // White master canvas with the lens centered (≈26px white margin added each side)
  const master = await sharp({ create: { width: C, height: C, channels: 3, background: '#ffffff' } })
    .composite([{ input: lens256, gravity: 'center' }])
    .png().toBuffer();

  const sizes = [256, 128, 64, 48, 32, 16];
  const pngs = [];
  for (const s of sizes) {
    const buf = await sharp(master).resize(s, s, { fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' }).png({ compressionLevel: 9 }).toBuffer();
    pngs.push({ size: s, buf });
  }

  // ── Pack PNG entries into a single .ico ──
  const N = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(N, 4);
  const dir = Buffer.alloc(16 * N);
  let off = 6 + 16 * N;
  pngs.forEach((p, i) => {
    const o = i * 16;
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, o);
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(p.buf.length, o + 8);
    dir.writeUInt32LE(off, o + 12);
    off += p.buf.length;
  });
  const ico = Buffer.concat([header, dir, ...pngs.map(p => p.buf)]);

  fs.copyFileSync('public/logo.ico', 'public/logo.prev.ico'); // backup
  fs.writeFileSync('public/logo.ico', ico);
  fs.writeFileSync('_preview256.png', pngs[0].buf);
  console.log('Done. logo.ico', Math.round(ico.length/1024)+'KB, canvas '+C+'px, sizes', sizes.join(','));
})();
