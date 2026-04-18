# Feature Specification: إصلاح شامل للأدوار وتسجيل الدخول وعزل البيانات

**Feature Branch**: `018-roles-auth-overhaul`  
**Created**: 2026-04-08  
**Status**: Draft  

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - تسجيل الدخول الموحد بدون كود المنظمة (Priority: P1)

مستخدم عادي (مدير فرع، كاشير، أمين مخزن) يفتح النظام ويرى صفحة دخول واحدة فقط. يدخل بريده الإلكتروني وكلمة مروره دون الحاجة لمعرفة "كود المنظمة". النظام يكتشف هويته ودوره تلقائياً ويوجهه للصفحة المناسبة.

**Why this priority**: هذا هو الإزعاج الأكبر للمشتركين الحاليين — إجبارهم على حفظ كود سداسي الأحرف في كل دخول. إصلاحه يرفع رضا المستخدمين فوراً.

**Independent Test**: يمكن اختباره بالكامل عبر: فتح /login، إدخال email + password صحيحين، والتحقق من التوجيه التلقائي للصفحة المناسبة.

**Acceptance Scenarios**:

1. **Given** مستخدم بدور ADMIN مسجل ببريد admin@store.com، **When** يدخل بريده وكلمة المرور في صفحة /login، **Then** يُوجَّه مباشرةً إلى /dashboard
2. **Given** مستخدم بدور CASHIER، **When** يسجل الدخول بنجاح، **Then** يُوجَّه إلى /pos
3. **Given** مستخدم بدور STOCK_KEEPER، **When** يسجل الدخول بنجاح، **Then** يُوجَّه إلى /dashboard/inventory
4. **Given** بريد إلكتروني غير موجود، **When** يحاول تسجيل الدخول، **Then** يظهر خطأ "البريد الإلكتروني أو كلمة المرور غير صحيحة" (دون تحديد أيهما خاطئ)
5. **Given** حساب مقفل بعد 5 محاولات فاشلة، **When** يحاول الدخول، **Then** يظهر رسالة القفل مع الوقت المتبقي

---

### User Story 2 - سوبر أدمن يدخل من نفس الصفحة (Priority: P1)

مشغّل المنصة (Super Admin) يستخدم نفس صفحة /login بدلاً من مسار /super-admin/login المنفصل. بعد إدخال بياناته، يُوجَّه تلقائياً إلى /super-admin/dashboard.

**Why this priority**: يُبسّط البنية ويزيل ازدواجية الصفحات — حل المشكلة التي ذكرها صاحب النظام صراحةً.

**Independent Test**: تسجيل دخول بحساب super admin عبر /login والتحقق من التوجيه لـ /super-admin/dashboard.

**Acceptance Scenarios**:

1. **Given** حساب super admin، **When** يدخل بيانات صحيحة على /login، **Then** يُوجَّه إلى /super-admin/dashboard
2. **Given** طلب يصل إلى /super-admin/login، **When** أي مستخدم يحاول الوصول إليه، **Then** يُعاد توجيهه إلى /login
3. **Given** مستخدم عادي لديه token صالح، **When** يحاول الوصول إلى /super-admin/dashboard، **Then** يُرفض بـ 403

---

### User Story 3 - مدير يضيف أمين مخزن (Priority: P2)

مدير المنظمة (ADMIN) يفتح صفحة الإعدادات، يختار "إضافة مستخدم جديد"، ويرى في قائمة الأدوار: كاشير، أمين مخزن، مدير فرع، مدير — بأسمائها العربية وألوانها المميزة.

**Why this priority**: الدور الجديد (STOCK_KEEPER) لا قيمة له إن لم يظهر في واجهة إنشاء المستخدمين.

**Independent Test**: فتح صفحة الإعدادات كـ ADMIN، التحقق من وجود "أمين مخزن" في dropdown إنشاء المستخدم، وإنشاء مستخدم بهذا الدور بنجاح.

**Acceptance Scenarios**:

1. **Given** مدير مفتوح صفحة الإعدادات، **When** يفتح نموذج "مستخدم جديد"، **Then** يرى الأدوار: كاشير، أمين مخزن، مدير فرع، مدير
2. **Given** مستخدم جديد بدور أمين مخزن، **When** يسجل دخوله، **Then** يستطيع الوصول إلى /dashboard/inventory لكن لا يستطيع الوصول إلى /dashboard/sales
3. **Given** مدير فرع، **When** يحاول إضافة مستخدم بدور "مدير"، **Then** يُرفض الطلب لأن BRANCH_MANAGER لا يملك هذه الصلاحية

---

### User Story 4 - أمين مخزن يعمل في نطاق صلاحياته (Priority: P2)

موظف بدور STOCK_KEEPER يستطيع الوصول إلى المخزون والمشتريات والموردين والتحويلات، لكنه لا يستطيع الوصول إلى تقارير المبيعات أو إدارة المستخدمين أو الإعدادات المالية.

**Why this priority**: الدور لا معنى له بدون تطبيق حدود الوصول عليه في الـ middleware.

**Independent Test**: تسجيل دخول بحساب STOCK_KEEPER والتحقق من الوصول/الرفض لكل مسار من المسارات المحددة.

**Acceptance Scenarios**:

1. **Given** مستخدم STOCK_KEEPER، **When** يصل إلى /dashboard/inventory، **Then** يُسمح له
2. **Given** مستخدم STOCK_KEEPER، **When** يصل إلى /dashboard/sales، **Then** يُعاد توجيهه إلى /dashboard/inventory
3. **Given** مستخدم STOCK_KEEPER، **When** يصل إلى /dashboard/settings، **Then** يُرفض
4. **Given** مستخدم STOCK_KEEPER، **When** يصل إلى /api/inventory، **Then** يُسمح له (HTTP 200)
5. **Given** مستخدم STOCK_KEEPER، **When** يصل إلى /api/reports، **Then** يُرفض (HTTP 403)

---

### Edge Cases

- ماذا يحدث إذا كان email المستخدم null (Optional field) ويحاول تسجيل الدخول؟ → يجب رفضه برسالة "البريد الإلكتروني غير مسجل لهذا الحساب"
- ماذا لو كان نفس الـ email مسجلاً في User وفي SuperAdmin؟ → يُعطى الأولوية لـ SuperAdmin
- ماذا يحدث إذا كانت المنظمة معلقة وحاول مستخدمها الدخول؟ → خطأ "الحساب معلق، تواصل مع الدعم"
- ماذا لو حاول BRANCH_MANAGER إنشاء مستخدم بدور أعلى منه؟ → رفض 403
- ماذا يحدث لـ refresh tokens القديمة التي تحتوي TENANT_ADMIN في الـ role field بعد التحديث؟ → تُعامَل كـ ADMIN في دالة التحقق

---

## Requirements *(mandatory)*

### Functional Requirements

**مجموعة 1 — الأدوار في قاعدة البيانات**

- **FR-001**: يجب أن يحتوي schema.prisma على `enum Role` بالقيم: SUPER_ADMIN, ADMIN, BRANCH_MANAGER, CASHIER, STOCK_KEEPER
- **FR-002**: يجب أن يكون حقل `role` في model User من نوع `Role` (enum) بدل `String`
- **FR-003**: يجب إنشاء Prisma migration لتحويل قاعدة البيانات من String إلى enum مع الاحتفاظ بالبيانات الحالية
- **FR-004**: يجب استبدال كل مراجع TENANT_ADMIN في الكود بـ ADMIN (نفس المعنى، اسم موحّد)

**مجموعة 2 — الملف المركزي للأدوار**

- **FR-005**: يجب إنشاء `lib/roles.ts` كمصدر حقيقة واحد لجميع تعريفات الأدوار في الـ UI
- **FR-006**: يجب أن يحتوي `lib/roles.ts` على: ROLES constant، UserRole type، ROLE_LABELS (label/color/bg/icon)، ROLE_HIERARCHY، دالة canManage()
- **FR-007**: يجب تحديث `lib/auth.ts` و`lib/auth-edge.ts` بدوال واضحة: canAccessAdmin، canManageBranch، canManageStock، canAccessPOS، isSuperAdmin
- **FR-008**: يجب إزالة ROLE_LABELS المكررة من `app/(tenant)/settings/page.tsx` واستيرادها من lib/roles.ts

**مجموعة 3 — توحيد تسجيل الدخول**

- **FR-009**: يجب أن تقبل صفحة /login حقلَي email وpassword فقط (حذف orgCode)
- **FR-010**: يجب أن يبحث POST /api/auth/login بالـ email أولاً في SuperAdmin ثم في User
- **FR-011**: يجب أن يُرجع /api/auth/login قيمة `redirectTo` تعكس الدور المكتشف
- **FR-012**: يجب حذف endpoint /api/auth/super-admin/login أو تحويله لـ redirect لـ /api/auth/login
- **FR-013**: يجب حذف صفحة /super-admin/login أو تحويلها لـ redirect لـ /login
- **FR-014**: يجب تحديث middleware.ts لإزالة /super-admin/login من PUBLIC_PATHS وإضافة توجيه للـ /login

**مجموعة 4 — صلاحيات Middleware للأدوار**

- **FR-015**: يجب تعريف مسارات مسموح بها لكل دور في middleware.ts بشكل منفصل وواضح
- **FR-016**: STOCK_KEEPER يُسمح له بـ: /dashboard/inventory, /dashboard/purchases, /dashboard/suppliers, /dashboard/transfers, وما يقابلها من API routes
- **FR-017**: CASHIER يُسمح له بـ: /pos, /customer-screen وما يقابلها من API routes فقط
- **FR-018**: BRANCH_MANAGER يُسمح له بكل ما يسمح به STOCK_KEEPER + CASHIER + /dashboard/reports + /dashboard/expenses

**مجموعة 5 — تحديث UI الإعدادات**

- **FR-019**: يجب أن تعرض قائمة إنشاء المستخدم في settings جميع الأدوار الخمسة بأسمائها العربية
- **FR-020**: يجب أن يعرض Sidebar.tsx اسم الدور الصحيح لجميع الأدوار الخمسة
- **FR-021**: يجب أن يتحقق النظام من أن المنشئ لا يستطيع إنشاء مستخدم بدور أعلى منه

### Key Entities

- **Role Enum**: تعداد ثابت بالقيم الخمسة — مصدر الحقيقة الوحيد في قاعدة البيانات
- **User**: يرتبط بـ Branch (عبر branchId) وبالتالي بالـ Tenant/Organization
- **SuperAdmin**: جدول منفصل — لا tenantId، لا branchId
- **RefreshToken**: يربط بـ User أو SuperAdmin — يحتاج تحديث للتعامل مع ADMIN بدل TENANT_ADMIN

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: مستخدم يسجل دخوله في أقل من 30 ثانية دون الحاجة لمعرفة أي كود إضافي
- **SC-002**: صفر صفحات تسجيل دخول متكررة — صفحة /login واحدة تخدم جميع أنواع المستخدمين
- **SC-003**: صفر أماكن في الكود تستخدم "TENANT_ADMIN" كقيمة role بعد التطبيق
- **SC-004**: جميع الأدوار الخمسة تظهر في واجهة إنشاء المستخدمين باللغة العربية
- **SC-005**: مستخدم STOCK_KEEPER لا يستطيع الوصول إلى أي مسار خارج نطاق صلاحياته (اختبار يدوي لكل مسار)
- **SC-006**: قاعدة البيانات تحتوي على enum Role صريح — رفض قاعدة البيانات لأي قيمة غير معرّفة في الـ enum

---

## Assumptions

- البريد الإلكتروني في User model هو `String?` (اختياري حالياً) — سيُجعل إلزامياً لمستخدمي ADMIN وما فوق، وموصى به لبقية الأدوار
- SuperAdmin يبقى في جدول منفصل (لا ندمجه مع User) — البحث يكون في الجدولين عند تسجيل الدخول
- refresh tokens القديمة التي تحتوي TENANT_ADMIN ستُعامَل كـ ADMIN في منطق التحقق (backward compatibility في الـ verifyToken function)
- مستخدمو النظام الحاليون الذين لم يُسجَّل لهم email سيحتاجون تحديث بياناتهم عبر super admin قبل تطبيق login الجديد — هذا خارج نطاق هذه المهمة
- نطاق هذا الإصلاح: الكود فقط (schema + API + UI) — لا يشمل إعادة كتابة نظام التراخيص أو نظام الاشتراكات
