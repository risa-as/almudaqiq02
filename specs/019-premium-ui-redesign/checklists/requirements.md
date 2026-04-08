# Checklist: متطلبات إعادة التصميم

## نظام التصميم (Design System)
- [x] CSS Variables شاملة معرّفة في globals.css
- [x] Font Cairo محمّل من Google Fonts
- [x] نظام ألوان Indigo/Violet/Amber موثّق
- [x] متغيرات الظلال والـ gradients معرّفة
- [x] لا تغيير في API routes أو منطق الأعمال

## الوظائف المحفوظة
- [x] جميع روابط التنقل في Sidebar تعمل
- [x] منطق تسجيل الدخول (email+password) يعمل
- [x] RBAC — صلاحيات الأدوار محفوظة
- [x] RTL عربي سليم في جميع الصفحات
- [x] Recharts تعمل في صفحات التقارير

## المتطلبات التقنية
- [x] Tailwind CSS v4 — لا config منفصل
- [x] لا مكتبات UI جديدة (Lucide + Recharts فقط)
- [x] Next.js App Router متوافق
- [x] `next build` ينجح بلا أخطاء TypeScript
