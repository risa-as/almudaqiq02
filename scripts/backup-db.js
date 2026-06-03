/**
 * Cloud Postgres backup → ./backups/db-<timestamp>.dump  (pg_dump custom format)
 *
 * On the Neon FREE plan there is NO PITR, so these logical dumps are the ONLY
 * recovery path — treat them as critical.
 *
 * Usage:   node scripts/backup-db.js     (or: npm run backup:db)
 * Requires: PostgreSQL client tools (pg_dump) on PATH + DATABASE_URL in .env.
 *
 * Env config (no code change needed when you upgrade your plan):
 *   BACKUP_RETENTION_DAYS   how many days of dumps to keep        (default 14)
 *   BACKUP_UPLOAD_CMD       optional shell cmd run after each dump for off-site
 *                           copy. "{file}" is replaced with the dump path.
 *                           e.g.  rclone copy "{file}" gdrive:supermarket-backups
 *
 * Free-plan notes:
 *   • Neon "scale to zero" sleeps the DB; the first connection wakes it, so we
 *     retry once on a cold-start timeout.
 *   • Keep an off-site copy (BACKUP_UPLOAD_CMD or a synced cloud folder) so a
 *     disk failure doesn't lose both the DB and its backups.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/** Locate pg_dump/pg_restore even when not on PATH (common on Windows). */
function resolveBin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  // Explicit override wins.
  const override = readEnv('PG_BIN_DIR');
  if (override) {
    const p = path.join(override, exe);
    if (fs.existsSync(p)) return p;
  }
  if (process.platform === 'win32') {
    for (const base of ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL']) {
      try {
        const versions = fs.readdirSync(base).sort().reverse(); // highest version first
        for (const v of versions) {
          const p = path.join(base, v, 'bin', exe);
          if (fs.existsSync(p)) return p;
        }
      } catch { /* ignore */ }
    }
  }
  return name; // fall back to PATH
}

function readEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const env = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8');
    const m = env.match(new RegExp('^' + key + '\\s*=\\s*"?([^"\\r\\n]+)"?', 'm'));
    if (m) return m[1].trim();
  } catch { /* ignore */ }
  return null;
}

/**
 * Make a Neon URL safe for pg_dump:
 *  - use the DIRECT endpoint (strip "-pooler"); the PgBouncer pooler breaks pg_dump
 *  - drop Prisma-only query params (pgbouncer, connection_limit) that libpq rejects
 */
function toDumpUrl(raw) {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.replace('-pooler', '');
    u.searchParams.delete('pgbouncer');
    u.searchParams.delete('connection_limit');
    if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
    return u.toString();
  } catch {
    return raw;
  }
}

function runPgDump(url, outFile) {
  // pg_dump prints its own (secret-free) errors to stderr; we never echo the URL.
  execFileSync(resolveBin('pg_dump'), [toDumpUrl(url), '-Fc', '--no-owner', '--no-privileges', '-f', outFile], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

function main() {
  const url = readEnv('DATABASE_URL');
  if (!url) { console.error('❌ DATABASE_URL غير موجود (في .env أو البيئة).'); process.exit(1); }

  const retentionDays = Math.max(1, parseInt(readEnv('BACKUP_RETENTION_DAYS') || '14', 10) || 14);
  const uploadCmd = readEnv('BACKUP_UPLOAD_CMD');

  const dir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(dir, `db-${stamp}.dump`);

  console.log(`📦 جاري أخذ نسخة احتياطية → ${path.relative(process.cwd(), outFile)} ...`);
  try {
    runPgDump(url, outFile);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('❌ pg_dump غير مثبّت. ثبّت PostgreSQL client tools وأضفه إلى PATH.');
      process.exit(1);
    }
    // Neon scale-to-zero cold start: wait for the DB to wake, then retry once.
    console.warn('⚠️ المحاولة الأولى فشلت (قد تكون القاعدة نائمة على Neon). إعادة المحاولة خلال 8 ثوانٍ...');
    try { fs.existsSync(outFile) && fs.unlinkSync(outFile); } catch { /* ignore */ }
    try {
      execFileSync(process.execPath, ['-e', 'setTimeout(()=>{}, 8000)']); // portable 8s wait
      runPgDump(url, outFile);
    } catch {
      // Never echo the error message — it contains the full command + DB password.
      console.error('❌ فشل pg_dump بعد إعادة المحاولة. راجع رسالة pg_dump أعلاه.');
      process.exit(1);
    }
  }

  const sizeMB = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
  console.log(`✅ تمت النسخة (${sizeMB} MB).`);

  // ── Optional off-site upload ─────────────────────────────────────────────────
  if (uploadCmd) {
    const cmd = uploadCmd.replace(/\{file\}/g, outFile);
    console.log(`☁️  رفع خارجي: ${cmd}`);
    try {
      execFileSync(process.platform === 'win32' ? 'cmd' : 'sh',
        process.platform === 'win32' ? ['/c', cmd] : ['-c', cmd],
        { stdio: 'inherit' });
      console.log('✅ تم الرفع الخارجي.');
    } catch (err) {
      console.error('⚠️ فشل الرفع الخارجي (النسخة المحلية سليمة):', err.message);
    }
  }

  // ── Prune old backups ──────────────────────────────────────────────────────
  const cutoff = Date.now() - retentionDays * 86_400_000;
  let pruned = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith('db-') || !f.endsWith('.dump')) continue;
    const full = path.join(dir, f);
    if (fs.statSync(full).mtimeMs < cutoff) { fs.unlinkSync(full); pruned++; }
  }
  if (pruned) console.log(`🧹 حُذفت ${pruned} نسخة أقدم من ${retentionDays} يوماً.`);
}

main();
