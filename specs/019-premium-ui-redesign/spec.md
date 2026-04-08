# Spec 019 — إعادة تصميم شاملة للواجهة: Premium SaaS UI

**Feature Branch**: `019-premium-ui-redesign`
**Created**: 2026-04-08
**Status**: Draft

---

## الهدف

إعادة بناء نظام التصميم من الصفر لنظام SaaS لإدارة السوبر ماركت يضم 40+ صفحة، مع الحفاظ على كامل الوظائف الحالية. الهدف: واجهة SaaS فاخرة تنافس أفضل المنتجات عالمياً وتكون الأولى من نوعها محلياً.

---

## الهوية البصرية

### نظام الألوان
- **Sidebar**: تدرج داكن من `indigo-950` إلى `slate-900` مع لهجات Violet/Indigo
- **Accent الرئيسي**: `indigo-500` / `indigo-600`
- **Accent الثانوي**: `amber-400` / `amber-500` (Gold) للعناصر المميزة
- **الخلفية**: تدرج خفي من `slate-50` إلى `white` مع mesh gradient شفافة
- **النص الرئيسي**: `slate-900`, الثانوي: `slate-500`, الخافت: `slate-400`

### البطاقات (Cards)
- Glassmorphism: `backdrop-blur-sm` + `bg-white/80`
- Border مضيئة: `border border-white/50` أو `border-slate-200/60`
- ظلال متعددة الطبقات: `shadow-xl shadow-slate-200/50`
- Gradient خفي في الخلفية (per-card unique gradient)

### Typography
- **Font**: Cairo (Bold للعناوين، Regular للنصوص)
- **h1**: 32px / font-bold / gradient text
- **h2**: 24px / font-semibold
- **h3**: 18px / font-semibold
- **body**: 14px / font-normal

### الأيقونات
- Lucide React (موجودة)
- خلفيات gradient دائرية ملوّنة حسب القسم

---

## User Stories

### US1 — Design System Foundation (P1)
**كمطور**، أريد نظام CSS variables شاملاً حتى تكون جميع الصفحات متسقة بدون تكرار.

**المقبول إذا**:
- `globals.css` يحتوي على جميع CSS custom properties المطلوبة
- متغيرات الألوان، الظلال، gradients، animations معرّفة
- Font Cairo محمّل ومُطبّق على `body`
- لا يكسر بناء `next build`

### US2 — Sidebar Redesign (P1)
**كمستخدم للنظام**، أريد sidebar احترافياً مع active states واضحة حتى أتنقل بسرعة وثقة.

**المقبول إذا**:
- Header: Logo + اسم النظام مع gradient
- قسم الفرع المختار مع avatar
- Nav links: أيقونة gradient + label + active glow effect
- Footer: avatar دور المستخدم + badge الدور + logout
- RTL سليم، جميع الروابط تعمل كما كانت

### US3 — Login Page Redesign (P1)
**كمستخدم جديد**، أريد صفحة دخول تبدو احترافية حتى تترك انطباعاً أولياً قوياً.

**المقبول إذا**:
- خلفية: mesh gradient متحرك (Indigo + Violet + Slate)
- بطاقة مركزية glassmorphism
- حقول input مع icons وfocus states
- Animation ناعم عند التحميل
- يعمل مع منطق `/api/auth/login` الحالي

### US4 — Shared UI Components (P1)
**كمطور**، أريد مكونات UI مشتركة جاهزة للاستخدام في جميع الصفحات.

**المقبول إذا**:
- `PageHeader`: gradient text + breadcrumb + action button
- `StatsCard`: KPI card مع trend indicator
- `DataTable` wrapper: hover states + empty state
- `FilterBar`: شريط فلترة موحد
- `LoadingSkeleton`: shimmer effect

### US5 — Dashboard Redesign (P2)
**كمدير**، أريد dashboard يعطيني نظرة فورية واضحة على أداء المتجر.

**المقبول إذا**:
- KPI cards بـ gradient فريد لكل بطاقة + trend indicator
- تنبيهات منتجات منتهية/ناقصة بتصميم واضح
- جدول آخر المبيعات premium
- Quick Actions بـ gradient ملون
- البيانات هي نفسها — تغيير بصري فقط

### US6 — Inventory & Products Pages (P2)
**كأمين مخزن**، أريد صفحات المنتجات والمخزون بتصميم يسهّل القراءة السريعة.

**المقبول إذا**:
- صفحة قائمة المنتجات بـ PageHeader + FilterBar + DataTable
- صفحة الفئات بنفس النمط
- صفحة الدُفعات (Batches)
- صفحة Stock-In
- جميع الروابط والـ actions تعمل كما كانت

### US7 — Sales Pages (P2)
**ككاشير/مدير**، أريد صفحات المبيعات والعملاء بتصميم premium.

**المقبول إذا**:
- صفحة الفواتير بـ DataTable premium
- صفحة العملاء + صفحة تفاصيل عميل
- تصميم متسق مع بقية الصفحات

### US8 — Purchases & Suppliers Pages (P2)
**كمدير مشتريات**، أريد صفحات الموردين والمشتريات بتصميم موحد.

**المقبول إذا**:
- صفحة الموردين + دفتر الأستاذ
- صفحة Smart Buy
- تصميم متسق

### US9 — Reports Pages (P2)
**كمدير**، أريد صفحات التقارير بتصميم واضح يسهّل القراءة وتصدير البيانات.

**المقبول إذا**:
- KPI Cards أكبر وأوضح في جميع صفحات التقارير
- Charts بألوان متناسقة مع النظام الجديد
- Export buttons موحدة التصميم
- الصفحات: sales, inventory, analytics, stock-movement, audit, branches, financials

### US10 — Accounting & Settings Pages (P2)
**كمحاسب/مدير**، أريد صفحات المحاسبة والإعدادات بتصميم موحد.

**المقبول إذا**:
- صفحة الشيفتات (Shifts)
- صفحة المصاريف (Expenses)
- صفحة الإعدادات (Settings)
- صفحة الفروع (Branches)

### US11 — Super Admin Dashboard Redesign (P2)
**كـ Super Admin**، أريد واجهة إدارية مختلفة ومحترفة.

**المقبول إذا**:
- نظام ألوان أكثر عمقاً (slate-800 للـ sidebar)
- Dashboard بـ KPI cards وإحصائيات المستأجرين
- صفحة المستأجرين: بطاقات مع status badges + progress bars
- صفحات Plans, Monitoring, Announcements, Licenses بتصميم موحد

### US12 — POS Page Polish (P3)
**ككاشير**، أريد واجهة POS نظيفة بألوان متناسقة مع النظام الجديد.

**المقبول إذا**:
- الألوان تتوافق مع نظام indigo الجديد
- زر الدفع بـ gradient واضح
- لا يكسر أي منطق POS موجود

---

## المتطلبات التقنية

1. **Tailwind CSS v4** — لا `tailwind.config.ts` منفصل، utilities فقط
2. **CSS Custom Properties** كـ design tokens رئيسية في `globals.css`
3. **لا مكتبات UI جديدة** — Lucide + Recharts فقط (موجودتان)
4. **Next.js App Router** متوافق — `'use client'` حيث لزم
5. **RTL عربي كامل** — `dir="rtl"` على `html`، spacing محلوب
6. **Responsive**: Desktop-first، ثم Mobile (md breakpoint)
7. **لا يكسر أي وظيفة موجودة** — تغيير بصري بحت
8. **لا تغيير في API routes أو منطق الأعمال**

---

## القيود

- لا dark mode في المرحلة الأولى
- لا تغيير في Prisma schema
- لا تغيير في middleware أو auth
- POS تُعالَج بشكل محدود (polish فقط)
