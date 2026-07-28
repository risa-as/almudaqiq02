# نظام إدارة المتاجر SaaS — SuperMarket POS

منصة SaaS متكاملة لإدارة المتاجر (غذائية، منزلية، منظفات) مع دعم الفروع المتعددة وواجهة Super Admin.

## الميزات الرئيسية

- **Multi-Tenant**: كل مستأجر = شركة/سلسلة متاجر بعزل بيانات كامل
- **Multi-Branch**: فروع متعددة مع كتالوج مشترك ومخزون منفصل
- **Offline-First**: تطبيق Electron يعمل بدون إنترنت مع مزامنة تلقائية
- **Super Admin**: لوحة تحكم شاملة للمنصة بأكملها
- **خطط اشتراك**: Basic (فرع واحد) · Pro (5 فروع) · Enterprise (غير محدود)

## التقنيات المستخدمة

- **Frontend/Backend**: Next.js 15 (App Router)
- **قاعدة بيانات السحابة**: PostgreSQL (Neon/Supabase) عبر Prisma
- **قاعدة بيانات المكتب**: SQLite (Prisma local schema)
- **المصادقة**: JWT + bcrypt
- **الإشعارات**: داخل النظام فقط (جدول `Notification` + الإعلانات). لا يوجد بريد إلكتروني — التواصل مع العميل يتم عبر واتساب خارج النظام
- **التطبيق المكتبي**: Electron

---

## الإعداد السريع (Development)

### 1. المتطلبات الأساسية

- Node.js 18+
- PostgreSQL (أو حساب Neon/Supabase مجاني)

### 2. تثبيت التبعيات

```bash
npm install
```

### 3. إعداد متغيرات البيئة

```bash
cp .env.production .env
# عدّل .env وأضف قيم DATABASE_URL وبقية المتغيرات
```

### 4. تهجير قاعدة البيانات

```bash
npx prisma migrate dev
```

### 5. إنشاء Super Admin والخطط الافتراضية

```bash
SUPER_ADMIN_EMAIL=admin@example.com \
SUPER_ADMIN_PASSWORD=Admin@1234 \
npx tsx scripts/seed-super-admin.ts
```

### 6. تشغيل الخادم

```bash
npm run dev
```

---

## إنشاء مستأجر جديد

```bash
npx tsx scripts/create-tenant.ts \
  --name "سلسلة مارت" \
  --slug "mart" \
  --adminEmail "admin@mart.com" \
  --adminUsername "mart_admin" \
  --adminPassword "Pass@1234" \
  --plan "Pro"
```

---

## النشر على Vercel

1. ادفع الكود إلى GitHub
2. اربط المشروع بـ Vercel
3. أضف جميع متغيرات `.env.production` في لوحة Vercel (Settings → Environment Variables)
4. أضف النطاق الرئيسي + wildcard `*.your-domain.com` في Vercel → Domains
5. شغّل migrations: `npx prisma migrate deploy`
6. شغّل seed: `npx tsx scripts/seed-super-admin.ts`

### Cron Jobs (على Vercel أو GitHub Actions)

```bash
# يومياً — تحقق من الاشتراكات المنتهية
npx tsx scripts/cron/check-expiring-subscriptions.ts
```

---

## النشر Self-Hosted (Docker)

```bash
# بناء وتشغيل
docker-compose up -d

# تهجير قاعدة البيانات
docker exec <container_name> npx prisma migrate deploy

# إنشاء Super Admin
docker exec <container_name> npx tsx scripts/seed-super-admin.ts
```

قم بإعداد nginx أو Caddy مع شهادة SSL wildcard لـ `*.your-domain.com`.

---

## تطبيق سطح المكتب (Electron)

### بناء التطبيق

```bash
npm run build
npx electron-builder --win
```

### أول تشغيل

عند تشغيل التطبيق لأول مرة، يُعرض له صفحة **تفعيل الفرع**. أدخل:
- **رمز التفعيل** (من صفحة الفروع في لوحة التحكم)
- **عنوان الخادم** السحابي

بعد التفعيل يبدأ التطبيق مباشرةً في نقطة البيع مع مزامنة تلقائية.

---

## هيكل المشروع

```
app/
  (super-admin)/       # واجهة Super Admin
  api/
    auth/              # تسجيل دخول، تجديد token
    super-admin/       # APIs الـ Super Admin
    sync/              # APIs المزامنة (pull/push/status)
    branches/          # إدارة الفروع
    transfers/         # نقل المخزون
    notifications/     # الإشعارات
electron/
  main.js              # نقطة دخول Electron
  preload.js           # IPC bridge
  sync-worker.js       # عملية المزامنة الخلفية
  offline-queue.js     # طابور العمليات غير المتزامنة
lib/
  auth.ts              # JWT + bcrypt
  audit.ts             # سجل التدقيق
  rate-limit.ts        # حد الطلبات
  multi-tenant/        # Prisma scoped clients
  sync-engine/         # conflict resolver
  notifications/       # email + in-app
prisma/
  schema.prisma        # Cloud schema (PostgreSQL)
  schema.local.prisma  # Local schema (SQLite)
scripts/
  seed-super-admin.ts  # إنشاء أول Super Admin
  create-tenant.ts     # إنشاء مستأجر جديد
  migrate-to-multitenant.ts  # هجرة من النظام القديم
  cron/
    check-expiring-subscriptions.ts  # cron job يومي
```

---

## الأدوار والصلاحيات

| الدور | الوصول |
|-------|--------|
| `SUPER_ADMIN` | كل شيء — لوحة `/super-admin` |
| `TENANT_ADMIN` | كل فروعه + تقارير مجمعة |
| `BRANCH_MANAGER` | فرعه فقط + المخزون + التقارير |
| `CASHIER` | نقطة البيع فقط (`/pos`) |
