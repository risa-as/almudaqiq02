/**
 * scripts/make-clean-db.js
 *
 * ينشئ قاعدة بيانات "شحن" نظيفة لتضمينها داخل المُثبِّت: نفس بنية الجداول
 * الموجودة في قاعدة بيانات المطوّر (prisma/dev.db) لكن بصفر صفوف في كل جدول.
 *
 * لماذا: scripts/prepare-standalone.js كان ينسخ prisma/dev.db كما هي إلى داخل
 * المُثبِّت. أي أن كل عميل كان سيستلم قاعدة بيانات المطوّر بما فيها:
 *   - User و RefreshToken → حسابات ورموز تحديث صالحة (تسجيل دخول فعلي)
 *   - Tenant / Branch / Transaction / AuditLog → بيانات مستأجر آخر
 *   - SyncQueue → عمليات مزامنة معلّقة تُدفع إلى السحابة عند أول اتصال، فتلوّث
 *     بيانات الفرع الجديد ببيانات جهاز المطوّر
 *
 * لماذا صفر صفوف في كل مكان: تطبيق سطح المكتب في هذا المشروع لا يحتاج أي بذور
 * محلية إطلاقاً — أول تسجيل دخول يتحقق من السحابة ويكتب Tenant/Branch/User
 * محلياً (app/api/auth/login/route.ts)، وعامل المزامنة يسحب باقي البيانات.
 * وكل جدول "مرجعي" ظاهرياً (Category مثلاً) مرتبط بـ tenantId، فلا معنى لشحنه
 * بلا مستأجر.
 *
 * قاعدة بيانات المطوّر تُقرأ فقط ولا تُعدَّل أبداً — النسخ يتم إلى ملف منفصل.
 *
 * الاستخدام يدوياً:
 *   node scripts/make-clean-db.js [outputPath]
 *
 * ويُستدعى برمجياً من scripts/prepare-standalone.js أثناء npm run dist.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const DEFAULT_SOURCE_DB = path.join(projectRoot, 'prisma', 'dev.db');

// خارج prisma/ عمداً: تتبّع الملفات في Next يكنس مجلد prisma/ كاملاً إلى
// standalone، فأي ملف بناء يُترك هناك يُشحن كفوضى إضافية. ومجلد البناء يُحذف
// ويُعاد إنشاؤه مع كل بناء، فينظّف نفسه.
const DEFAULT_OUTPUT_DB = path.join(projectRoot, process.env.NEXT_DIST_DIR || '.next', 'clean-build.db');

/**
 * نسخ ملف SQLite مع ملفاته الجانبية.
 * وضع WAL يُبقي آخر الالتزامات في ملف `-wal` منفصل، فنسخ الملف الرئيسي وحده
 * قد ينتج بنية ناقصة.
 */
function copySqliteFileSet(srcDbPath, destDbPath) {
  fs.copyFileSync(srcDbPath, destDbPath);
  for (const suffix of ['-wal', '-shm']) {
    const src = srcDbPath + suffix;
    if (fs.existsSync(src)) fs.copyFileSync(src, destDbPath + suffix);
  }
}

/**
 * `?connection_limit=1` إلزامي: عميل SQLite يفتح مجمّع اتصالات، وبدون هذا القيد
 * قد تُنفَّذ `PRAGMA foreign_keys = OFF` على اتصال والحذف على اتصال آخر، فتفشل
 * عمليات الحذف بخطأ مفتاح أجنبي رغم تعطيل القيد ظاهرياً.
 */
function getClient(dbFilePath) {
  // تحميل كسول: يبقى نسخ الملفات صالحاً دون اشتراط توليد العميل المحلي.
  const { PrismaClient } = require('@prisma/client-local');
  return new PrismaClient({
    datasources: { db: { url: `file:${dbFilePath}?connection_limit=1` } },
    log: ['error'],
  });
}

/** يحذف كل صف من كل جدول فعلي في نسخة العمل (لا في قاعدة بيانات المطوّر). */
async function wipeAllTables(dbFilePath) {
  const client = getClient(dbFilePath);
  try {
    await client.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');

    const tables = await client.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%';`,
    );

    for (const { name } of tables) {
      await client.$executeRawUnsafe(`DELETE FROM "${name}";`);
    }

    const seqTable = await client.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence';`,
    );
    if (seqTable.length > 0) await client.$executeRawUnsafe('DELETE FROM sqlite_sequence;');

    await client.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    await client.$executeRawUnsafe('VACUUM;');

    // يعيد صفاً واحداً — لذلك $queryRawUnsafe لا $executeRawUnsafe.
    // وضع DELETE يجعل الناتج ملفاً واحداً مستقلاً بلا `-wal`/`-shm` جانبي.
    await client.$queryRawUnsafe('PRAGMA journal_mode = DELETE;');

    return tables.map(t => t.name);
  } finally {
    await client.$disconnect();
  }
}

/**
 * خط دفاع ثانٍ: يفشل بصوت عالٍ إن بقي أي صف خطِر. يُستدعى أيضاً من
 * prepare-standalone.js على الملف الذي سيُشحن فعلاً بعد نسخه.
 *
 * SyncQueue مُدرَجة هنا لأنها الأخطر تحديداً في هذا المشروع: صفوفها تُدفع إلى
 * السحابة تلقائياً عند أول مزامنة.
 */
async function assertCleanForShipping(dbFilePath) {
  const client = getClient(dbFilePath);
  try {
    const [userCount, superAdminCount, refreshTokenCount, syncQueueCount] = await Promise.all([
      client.user.count(),
      client.superAdmin.count(),
      client.refreshToken.count(),
      client.syncQueue.count(),
    ]);

    const problems = [];
    if (userCount > 0)         problems.push(`User=${userCount}`);
    if (superAdminCount > 0)   problems.push(`SuperAdmin=${superAdminCount}`);
    if (refreshTokenCount > 0) problems.push(`RefreshToken=${refreshTokenCount}`);
    if (syncQueueCount > 0)    problems.push(`SyncQueue=${syncQueueCount}`);

    if (problems.length > 0) {
      throw new Error(
        `قاعدة البيانات المُراد شحنها ليست نظيفة: ${problems.join(' ')} — أُوقف البناء.`,
      );
    }
    return { userCount, superAdminCount, refreshTokenCount, syncQueueCount };
  } finally {
    await client.$disconnect();
  }
}

/** ينشئ قاعدة شحن نظيفة عند outputDb مستنسخة البنية من sourceDb. */
async function buildCleanDatabase(options = {}) {
  const sourceDb = options.sourceDb || DEFAULT_SOURCE_DB;
  const outputDb = options.outputDb || DEFAULT_OUTPUT_DB;

  if (!fs.existsSync(sourceDb)) {
    throw new Error(`قاعدة بيانات المصدر غير موجودة (تُستنسخ منها البنية): ${sourceDb}`);
  }

  fs.mkdirSync(path.dirname(outputDb), { recursive: true });
  copySqliteFileSet(sourceDb, outputDb);

  const tableNames = await wipeAllTables(outputDb);
  await assertCleanForShipping(outputDb);

  console.log(`[make-clean-db] قاعدة بيانات شحن نظيفة جاهزة (${tableNames.length} جدول، صفر صفوف): ${outputDb}`);
  return outputDb;
}

module.exports = {
  buildCleanDatabase,
  assertCleanForShipping,
  wipeAllTables,
  copySqliteFileSet,
  DEFAULT_SOURCE_DB,
  DEFAULT_OUTPUT_DB,
};

// ─── CLI ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const outputArg = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
  buildCleanDatabase(outputArg ? { outputDb: outputArg } : undefined)
    .then(outPath => console.log('تم بنجاح:', outPath))
    .catch(err => {
      console.error('فشل إنشاء قاعدة البيانات النظيفة:', err.message || err);
      process.exit(1);
    });
}
