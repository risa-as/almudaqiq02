# SuperMarket Cloud — تطبيق الهاتف (Mobile)

تطبيق React Native (Expo) بثلاث واجهات حسب الدور، يستهلك نفس Next.js API الخاص بالنظام السحابي:

| الدور | الواجهة | الشاشة الرئيسية |
|---|---|---|
| `ADMIN` / `BRANCH_MANAGER` | `(admin)` | لوحة التحكم والتقارير والموافقات والمساعد الذكي |
| `CASHIER` | `(cashier)` | شاشة البيع بمسح الباركود بالكاميرا + الوردية |
| `STOCK_KEEPER` | `(stock)` | المخزون والجرد واستلام أوامر الشراء والتحويلات |

## التشغيل للتطوير

```bash
cd mobile
npm install

# اضبط عنوان الخادم في .env (انسخ من .env.example):
# EXPO_PUBLIC_API_URL=https://app.faramace.com/api        ← السيرفر الأصلي
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api         ← سيرفر محلي (IP الجهاز وليس localhost)

npx expo start          # امسح QR بتطبيق Expo Go على أندرويد
```

> ملاحظة RTL: عند أول تشغيل قد تظهر الواجهة LTR — أعد تشغيل التطبيق مرة واحدة ليُفعَّل الاتجاه العربي بالكامل.

## بوابات الجودة

```bash
npx tsc --noEmit        # فحص الأنواع — يجب أن يمر بدون أخطاء
npx expo-doctor         # سلامة الإعدادات والاعتماديات
```

## بناء APK للتوزيع المباشر

```bash
npx eas build --profile preview --platform android
```

بروفايل `preview` في `eas.json` يُخرج ملف `.apk` قابلاً للتثبيت مباشرة، وعنوان الخادم فيه مضبوط على السيرفر الأصلي.

## البنية

```text
src/
├── app/                 # expo-router: login + (admin) + (cashier) + (stock)
├── api/
│   ├── client.ts        # Bearer + تجديد تلقائي للتوكن (single-flight)
│   ├── tokens.ts        # expo-secure-store
│   └── endpoints/       # مستدعيات مخططة لكل مورد API
├── stores/              # zustand: auth / cart / branch
├── components/          # Screen, StatCard, BarcodeScannerView, …
├── hooks/useFeature.ts  # بوابة ميزات الخطة (مرآة lib/features.ts في الويب)
├── i18n/ar.ts           # كل نصوص الواجهة
└── theme/               # ألوان Indigo/Violet المطابقة للويب
```

- المصادقة: نفس حسابات الويب؛ التوكن عبر `Authorization: Bearer` مع ترويسة `x-client-type: mobile`.
- التطبيق **يتطلب اتصالاً** (لا وضع أوفلاين في v1) — الخادم هو مصدر الحقيقة الوحيد.
- عند إضافة ميزة خطة جديدة في الويب (`lib/features.ts`) حدّث نسختها هنا: `src/features.ts`.
