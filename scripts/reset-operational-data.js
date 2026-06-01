/**
 * reset-operational-data.js
 *
 * يحذف جميع البيانات التشغيلية مع الإبقاء على:
 *   - المستخدمين (User, SuperAdmin, RefreshToken)
 *   - المنظمات/المستأجرين (Tenant, TenantSubscription, SubscriptionPlan, PaymentRecord, LicenseLog)
 *   - الفروع (Branch)
 *   - إعدادات المتجر (StoreSettings)
 *
 * التشغيل:
 *   node scripts/reset-operational-data.js
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const prisma = new PrismaClient();

// Safety guard — must pass --confirm flag or type YES
const hasFlag = process.argv.includes('--confirm');

async function askConfirmation() {
  if (hasFlag) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    console.log('\n⛔  هذا الأمر سيحذف جميع البيانات التشغيلية نهائياً ولا يمكن التراجع!');
    rl.question('   اكتب "نعم احذف" للمتابعة: ', answer => {
      rl.close();
      resolve(answer.trim() === 'نعم احذف');
    });
  });
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║        إعادة تهيئة البيانات التشغيلية                ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('⚠️  سيتم حذف البيانات التالية نهائياً:');
  console.log('   المنتجات، المخزون، الدفعات، الموردين، العملاء،');
  console.log('   المبيعات، المصاريف، الورديات، العروض،');
  console.log('   التحويلات، السجلات، الإشعارات، الإعلانات');
  console.log('');
  console.log('✅ سيتم الاحتفاظ بـ: المستخدمين، المنظمات، الفروع، الإعدادات');
  console.log('');

  const confirmed = await askConfirmation();
  if (!confirmed) {
    console.log('\n❌ تم الإلغاء — لم يتم حذف أي بيانات.\n');
    process.exit(0);
  }
  console.log('');

  // ── 1. Announcement recipients & Announcements ──────────────────────────────
  const rec = await prisma.announcementRecipient.deleteMany({});
  console.log(`🗑️  AnnouncementRecipient  : ${rec.count}`);

  const ann = await prisma.announcement.deleteMany({});
  console.log(`🗑️  Announcement           : ${ann.count}`);

  // ── 2. Notifications ─────────────────────────────────────────────────────────
  const notif = await prisma.notification.deleteMany({});
  console.log(`🗑️  Notification           : ${notif.count}`);

  // ── 3. Audit logs ────────────────────────────────────────────────────────────
  const audit = await prisma.auditLog.deleteMany({});
  console.log(`🗑️  AuditLog               : ${audit.count}`);

  // ── 4. Sync logs ─────────────────────────────────────────────────────────────
  const sync = await prisma.syncLog.deleteMany({});
  console.log(`🗑️  SyncLog                : ${sync.count}`);

  // ── 5. Stock transfers ───────────────────────────────────────────────────────
  const transfers = await prisma.stockTransfer.deleteMany({});
  console.log(`🗑️  StockTransfer          : ${transfers.count}`);

  // ── 6. Transactions (cascades TransactionItem) ───────────────────────────────
  const tx = await prisma.transaction.deleteMany({});
  console.log(`🗑️  Transaction            : ${tx.count} (مع بنود المبيعات)`);

  // ── 7. Cashier shifts ────────────────────────────────────────────────────────
  const shifts = await prisma.cashierShift.deleteMany({});
  console.log(`🗑️  CashierShift           : ${shifts.count}`);

  // ── 8. Expenses ──────────────────────────────────────────────────────────────
  const expenses = await prisma.expense.deleteMany({});
  console.log(`🗑️  Expense                : ${expenses.count}`);

  // ── 9. Supplier ledger ───────────────────────────────────────────────────────
  const ledger = await prisma.supplierLedger.deleteMany({});
  console.log(`🗑️  SupplierLedger         : ${ledger.count}`);

  // ── 10. Offers ───────────────────────────────────────────────────────────────
  const offers = await prisma.offer.deleteMany({});
  console.log(`🗑️  Offer                  : ${offers.count}`);

  // ── 11. Product batches ──────────────────────────────────────────────────────
  const batches = await prisma.productBatch.deleteMany({});
  console.log(`🗑️  ProductBatch           : ${batches.count}`);

  // ── 12. Products (cascades ProductUnit) ─────────────────────────────────────
  const products = await prisma.product.deleteMany({});
  console.log(`🗑️  Product                : ${products.count} (مع الوحدات)`);

  // ── 13. Suppliers (now safe — ledger + products deleted) ─────────────────────
  const suppliers = await prisma.supplier.deleteMany({});
  console.log(`🗑️  Supplier               : ${suppliers.count}`);

  // ── 14. Customers ────────────────────────────────────────────────────────────
  const customers = await prisma.customer.deleteMany({});
  console.log(`🗑️  Customer               : ${customers.count}`);

  // ── 15. Categories (self-referential — clear parentId first) ─────────────────
  await prisma.category.updateMany({ data: { parentId: null } });
  const cats = await prisma.category.deleteMany({});
  console.log(`🗑️  Category               : ${cats.count}`);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ✅ تمت إعادة التهيئة بنجاح — النظام جاهز للاستخدام ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
}

main()
  .catch(e => {
    console.error('❌ خطأ أثناء إعادة التهيئة:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
