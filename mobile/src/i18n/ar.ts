/**
 * كل نصوص الواجهة العربية المشتركة. الشاشات المتخصصة قد تضيف نصوصًا محلية
 * داخل ملفها، لكن النصوص المكررة بين الشاشات تعيش هنا فقط.
 */
export const ar = {
  appName: 'سوبرماركت كلاود',

  common: {
    loading: 'جارٍ التحميل…',
    retry: 'إعادة المحاولة',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    save: 'حفظ',
    close: 'إغلاق',
    search: 'بحث…',
    empty: 'لا توجد بيانات',
    all: 'الكل',
    signOut: 'تسجيل الخروج',
    networkError: 'تعذر الاتصال بالخادم — تحقق من اتصال الإنترنت',
    unexpectedError: 'حدث خطأ غير متوقع',
    sessionExpired: 'انتهت الجلسة، يرجى تسجيل الدخول من جديد',
    offlineNotice: 'لا يوجد اتصال بالإنترنت — العمليات تتطلب اتصالاً نشطًا',
    today: 'اليوم',
    currency: 'ر.ي',
  },

  login: {
    title: 'تسجيل الدخول',
    subtitle: 'ادخل بيانات حسابك في النظام',
    identifier: 'البريد الإلكتروني أو اسم المستخدم',
    password: 'كلمة المرور',
    submit: 'دخول',
    submitting: 'جارٍ التحقق…',
  },

  tabs: {
    // المدير
    dashboard: 'الرئيسية',
    sales: 'المبيعات',
    reports: 'التقارير',
    more: 'المزيد',
    // الكاشير
    sell: 'البيع',
    shift: 'ورديتي',
    invoices: 'فواتيري',
    profile: 'حسابي',
    // المخزون
    inventory: 'المخزون',
    stocktake: 'الجرد',
    receive: 'الاستلام',
  },

  scanner: {
    permissionTitle: 'إذن الكاميرا مطلوب',
    permissionMessage: 'فعّل إذن الكاميرا من إعدادات الهاتف لمسح الباركود، أو استخدم الإدخال اليدوي',
    grantPermission: 'السماح بالكاميرا',
    manualEntry: 'إدخال يدوي',
    manualPlaceholder: 'اكتب رقم الباركود',
    manualSubmit: 'بحث',
    torch: 'الفلاش',
    aimHint: 'وجّه الكاميرا نحو الباركود',
  },

  features: {
    locked: 'هذه الميزة غير متاحة في خطتك الحالية',
    lockedHint: 'قم بترقية الاشتراك لتفعيلها',
  },
} as const
