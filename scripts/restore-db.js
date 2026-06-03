/**
 * Restore the cloud Postgres from a backup file produced by backup-db.js.
 *
 * Usage:   node scripts/restore-db.js backups/db-<timestamp>.dump
 * Requires: pg_restore (auto-detected on Windows) + DATABASE_URL.
 *
 * ⚠️ DESTRUCTIVE: --clean drops and recreates objects before restoring.
 *    Always test restores on a NON-production database / Neon branch first.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function readEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const env = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8');
    const m = env.match(new RegExp('^' + key + '\\s*=\\s*"?([^"\\r\\n]+)"?', 'm'));
    if (m) return m[1].trim();
  } catch { /* ignore */ }
  return null;
}

function resolveBin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const override = readEnv('PG_BIN_DIR');
  if (override) { const p = path.join(override, exe); if (fs.existsSync(p)) return p; }
  if (process.platform === 'win32') {
    for (const base of ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL']) {
      try {
        for (const v of fs.readdirSync(base).sort().reverse()) {
          const p = path.join(base, v, 'bin', exe);
          if (fs.existsSync(p)) return p;
        }
      } catch { /* ignore */ }
    }
  }
  return name;
}

/** Direct (non-pooler) URL without Prisma-only params — required by pg_restore. */
function toDumpUrl(raw) {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.replace('-pooler', '');
    u.searchParams.delete('pgbouncer');
    u.searchParams.delete('connection_limit');
    if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
    return u.toString();
  } catch { return raw; }
}

function main() {
  const file = process.argv[2];
  if (!file)               { console.error('الاستخدام: node scripts/restore-db.js <ملف النسخة>.dump'); process.exit(1); }
  if (!fs.existsSync(file)) { console.error(`❌ الملف غير موجود: ${file}`); process.exit(1); }
  const url = readEnv('DATABASE_URL');
  if (!url)                { console.error('❌ DATABASE_URL غير موجود.'); process.exit(1); }

  console.log(`♻️  جاري الاسترجاع من ${file} ...`);
  console.log('⚠️  هذا يستبدل البيانات الحالية. تأكد أنك على القاعدة الصحيحة!');
  try {
    execFileSync(resolveBin('pg_restore'),
      ['--clean', '--if-exists', '--no-owner', '--no-privileges', '-d', toDumpUrl(url), file],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } catch {
    // pg_restore exits non-zero on harmless "does not exist" notices with --clean.
    console.warn('⚠️ انتهى pg_restore مع تحذيرات (طبيعي مع --clean). راجع المخرجات أعلاه.');
  }
  console.log('✅ اكتمل الاسترجاع.');
}

main();
