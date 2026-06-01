'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { useTourContext } from '@/contexts/TourContext'

const STORAGE_KEY = 'bayan_tour_done'

interface Feature { icon: string; title: string; desc: string }

interface Step {
  icon: string
  accent: string
  glow: string
  title: string
  subtitle: string
  description: string
  features: Feature[]
}

const STEPS: Step[] = [
  {
    icon: '🎉',
    accent: '#094B9F',
    glow: 'rgba(9,75,159,0.25)',
    title: 'مرحباً بك في نظام المدقق',
    subtitle: 'نظام إدارة المتاجر المتكامل — الأذكى في فئته',
    description:
      'صُمِّم نظام المدقق خصيصاً للسوبرماركت ومتاجر التجزئة في العراق والدول العربية. يجمع بين سهولة الاستخدام وقوة التحليلات المتقدمة، ليمنحك رؤية كاملة وشاملة عن أعمالك في كل لحظة — سواء كنت في المتجر أو خارجه.',
    features: [
      { icon: '📦', title: 'مخزون ذكي', desc: 'تتبع دفعات المنتجات وتواريخ الصلاحية تلقائياً' },
      { icon: '🛒', title: 'مبيعات سريعة', desc: 'نقطة بيع احترافية مع إصدار فواتير فورية' },
      { icon: '📊', title: 'تقارير متقدمة', desc: 'رسوم بيانية وتحليلات مالية تفصيلية في ثوانٍ' },
      { icon: '🤖', title: 'ذكاء اصطناعي', desc: 'مساعد يجيب على أسئلتك بالعربية من بياناتك الحقيقية' },
      { icon: '🏢', title: 'تعدد الفروع', desc: 'إدارة جميع فروعك من لوحة تحكم واحدة مركزية' },
      { icon: '👥', title: 'فريق عمل متكامل', desc: 'صلاحيات مخصصة لكل دور: مدير، كاشير، أمين مخزن' },
    ],
  },
  {
    icon: '🏠',
    accent: '#3b82f6',
    glow: 'rgba(59,130,246,0.25)',
    title: 'لوحة التحكم الرئيسية',
    subtitle: 'نظرة شاملة على أداء متجرك في ثوانٍ',
    description:
      'بمجرد تسجيل الدخول، تستقبلك لوحة التحكم بملخص فوري وحقيقي لأداء متجرك اليومي. ستجد أمامك المبيعات، الأرباح، تنبيهات المخزون، وأكثر المنتجات مبيعاً — كل ذلك في صفحة واحدة ومنسقة بشكل احترافي.',
    features: [
      { icon: '💰', title: 'إجمالي المبيعات اليومية', desc: 'المبلغ الكلي وعدد الفواتير المنجزة خلال اليوم' },
      { icon: '📈', title: 'صافي الربح الفوري', desc: 'الإيرادات ناقص التكاليف محسوبان تلقائياً ودقيقان' },
      { icon: '⚠️', title: 'تنبيهات المخزون المنخفض', desc: 'قائمة المنتجات التي وصلت حد الطلب الحرج' },
      { icon: '🏆', title: 'أكثر المنتجات مبيعاً', desc: 'أفضل 10 منتجات مبيعاً في آخر 30 يوماً' },
      { icon: '📅', title: 'مقارنة فترات زمنية', desc: 'مقارنة أداء اليوم بالأمس وهذا الأسبوع بالماضي' },
      { icon: '🔔', title: 'مركز الإشعارات', desc: 'تنبيهات انتهاء الاشتراك والتحديثات المهمة' },
    ],
  },
  {
    icon: '📦',
    accent: '#10b981',
    glow: 'rgba(16,185,129,0.25)',
    title: 'إدارة المخزون',
    subtitle: 'سيطرة كاملة على كل منتج ودفعة في متجرك',
    description:
      'نظام المخزون يتيح لك إدارة آلاف المنتجات بدقة وسهولة. من إضافة المنتجات الجديدة بالباركود والتصنيف، إلى تتبع دفعات الاستيراد وتواريخ انتهاء الصلاحية — كل شيء منظم وفي متناول يدك مع تنبيهات تلقائية.',
    features: [
      { icon: '🏷️', title: 'بطاقة منتج متكاملة', desc: 'اسم، باركود، تصنيف، مورد، سعر البيع والتكلفة' },
      { icon: '📋', title: 'نظام الدفعات المتقدم', desc: 'كل دفعة بتاريخ الاستلام، التكلفة، وتاريخ الصلاحية' },
      { icon: '⏰', title: 'تنبيه انتهاء الصلاحية', desc: 'تحذير تلقائي للمنتجات قبل انتهاء صلاحيتها بأيام' },
      { icon: '🔢', title: 'إدارة الكميات', desc: 'تحديث يدوي أو تلقائي عبر المبيعات والمشتريات' },
      { icon: '🗂️', title: 'التصنيفات والفئات', desc: 'تنظيم المنتجات في فئات لسهولة البحث والتصفية' },
      { icon: '🔄', title: 'نقل المخزون بين الفروع', desc: 'نقل البضائع مع توثيق كامل وتحديث آني للأرصدة' },
    ],
  },
  {
    icon: '🛒',
    accent: '#f59e0b',
    glow: 'rgba(245,158,11,0.25)',
    title: 'المبيعات والفواتير',
    subtitle: 'فواتير سريعة وإدارة شاملة للعملاء',
    description:
      'يوفر نظام المبيعات تجربة بيع سلسة وسريعة للكاشيرين. من إصدار الفواتير اللحظية في نقطة البيع، إلى إدارة عملاء الدين وتتبع المدفوعات، وحتى إرجاع المبيعات — كل ذلك بضغطات قليلة.',
    features: [
      { icon: '🧾', title: 'نقطة البيع (POS)', desc: 'شاشة بيع سريعة مع بحث بالاسم أو بمسح الباركود' },
      { icon: '💳', title: 'طرق دفع متعددة', desc: 'نقداً، بطاقة، دين — مع تسجيل كل عملية بدقة' },
      { icon: '🖨️', title: 'طباعة الإيصالات', desc: 'طباعة فورية على طابعة حرارية أو تصدير PDF' },
      { icon: '👤', title: 'إدارة العملاء', desc: 'سجل كامل للعملاء مع تتبع الديون وتاريخ المشتريات' },
      { icon: '↩️', title: 'إرجاع المبيعات', desc: 'استرداد بسيط مع تحديث المخزون والحسابات تلقائياً' },
      { icon: '📑', title: 'أرشيف الفواتير', desc: 'بحث في جميع الفواتير السابقة وإعادة طباعتها' },
    ],
  },
  {
    icon: '🚚',
    accent: '#094B9F',
    glow: 'rgba(14,99,212,0.25)',
    title: 'المشتريات والموردون',
    subtitle: 'تحكم في سلسلة التوريد بذكاء واحترافية',
    description:
      'يساعدك نظام المشتريات على إدارة علاقاتك مع الموردين وضبط عمليات الشراء بكفاءة عالية. ميزة "الشراء الذكي" تحلل معدلات مبيعاتك وتقترح المنتجات التي تحتاج إعادة طلب قبل أن تنفد من المخزون.',
    features: [
      { icon: '📋', title: 'سجل الموردين الكامل', desc: 'بيانات كل مورد: الاسم، الهاتف، العنوان، وتاريخ التعامل' },
      { icon: '🔁', title: 'الشراء الذكي (AI)', desc: 'اقتراحات تلقائية للمنتجات حسب معدل البيع والمخزون الحالي' },
      { icon: '📦', title: 'تسجيل دفعات الشراء', desc: 'إضافة كل عملية شراء بالكمية والتكلفة الوحدوية' },
      { icon: '💰', title: 'مقارنة أسعار الموردين', desc: 'تتبع تكاليف كل مورد لاختيار العرض الأوفر' },
      { icon: '⚡', title: 'تحديث المخزون آلياً', desc: 'إضافة الكميات المشتراة للمخزون فور تسجيل الشراء' },
      { icon: '📊', title: 'تقرير المشتريات', desc: 'إجمالي المشتريات لكل مورد خلال أي فترة زمنية تختارها' },
    ],
  },
  {
    icon: '💰',
    accent: '#ec4899',
    glow: 'rgba(236,72,153,0.25)',
    title: 'المحاسبة والوردية',
    subtitle: 'سجلات مالية دقيقة لكل يوم عمل',
    description:
      'يوفر نظام المحاسبة رؤية كاملة ودقيقة على الوضع المالي لمتجرك. سجّل مصروفاتك اليومية، أغلق الورديات مع تقرير شامل لكل كاشير، واحصل على قوائم مالية احترافية لمعرفة صافي ربحك الحقيقي.',
    features: [
      { icon: '📝', title: 'تسجيل المصروفات', desc: 'سجّل كل مصروف يومي بتصنيفه والوصف التفصيلي' },
      { icon: '🔒', title: 'إغلاق الوردية', desc: 'تقرير شامل: المبيعات، النقد الفعلي، الفرق والمطابقة' },
      { icon: '👨‍💼', title: 'أداء الكاشيرين', desc: 'مقارنة أداء كل كاشير: مبيعات، فواتير، خصومات' },
      { icon: '📊', title: 'قائمة الدخل الشاملة', desc: 'إيرادات ناقص تكاليف البضاعة ناقص المصروفات' },
      { icon: '💹', title: 'هامش الربح التفصيلي', desc: 'نسبة ربح كل منتج، كل فئة، وإجمالي المتجر' },
      { icon: '📆', title: 'تقارير دورية مقارنة', desc: 'يومي، أسبوعي، شهري، وسنوي مع مقارنة الفترات' },
    ],
  },
  {
    icon: '📊',
    accent: '#06b6d4',
    glow: 'rgba(6,182,212,0.25)',
    title: 'التقارير والتحليلات',
    subtitle: 'بيانات دقيقة وعميقة لاتخاذ قرارات واثقة',
    description:
      'مجموعة شاملة من التقارير التفصيلية تمنحك صورة كاملة عن أداء متجرك من جميع الزوايا. رسوم بيانية تفاعلية، جداول مفصلة، ومقارنات زمنية — كل ما تحتاجه لإدارة متجرك باحترافية.',
    features: [
      { icon: '📈', title: 'تقرير المبيعات', desc: 'مبيعات يومية/أسبوعية/شهرية مع رسوم بيانية تفاعلية' },
      { icon: '📦', title: 'تقرير المخزون', desc: 'قيمة المخزون الحالية وكشف المنتجات راكدة الحركة' },
      { icon: '📉', title: 'حركة المخزون', desc: 'تفاصيل كل عملية دخول وخروج للبضاعة بالتواريخ' },
      { icon: '🏢', title: 'مقارنة أداء الفروع', desc: 'ترتيب الفروع حسب المبيعات والأرباح والكفاءة' },
      { icon: '🔍', title: 'سجل التدقيق الكامل', desc: 'تتبع كل إجراء لكل مستخدم في النظام لضمان الشفافية' },
      { icon: '📥', title: 'تصدير البيانات', desc: 'تنزيل جميع التقارير بصيغة Excel أو PDF' },
    ],
  },
  {
    icon: '🏷️',
    accent: '#f97316',
    glow: 'rgba(249,115,22,0.25)',
    title: 'التسويق والعروض',
    subtitle: 'عروض ذكية تزيد مبيعاتك وتجذب العملاء',
    description:
      'أنشئ حملات تسويقية مؤثرة بخطوات بسيطة ومرنة. حدد المنتجات، نوع الخصم، المدة الزمنية، والكمية المحدودة — وسيطبق النظام الأسعار المخفضة تلقائياً في نقطة البيع دون أي تدخل يدوي.',
    features: [
      { icon: '💯', title: 'خصومات مرنة', desc: 'بالنسبة المئوية أو بمبلغ ثابت على كل منتج تختاره' },
      { icon: '📅', title: 'عروض موقتة', desc: 'تاريخ بداية ونهاية للتفعيل والإلغاء التلقائي للعرض' },
      { icon: '🔢', title: 'عروض محدودة الكمية', desc: 'حدد عدد الوحدات التي يشملها الخصم في العرض' },
      { icon: '📦', title: 'تطبيق على فئات كاملة', desc: 'طبّق العرض على فئة بأكملها دفعة واحدة توفيراً للوقت' },
      { icon: '📊', title: 'تقرير أثر الخصومات', desc: 'إجمالي الخصومات المقدمة ومدى تأثيرها على الإيرادات' },
      { icon: '💡', title: 'تطبيق تلقائي في POS', desc: 'الأسعار المخفضة تظهر تلقائياً لكل كاشير عند البيع' },
    ],
  },
  {
    icon: '🏢',
    accent: '#14b8a6',
    glow: 'rgba(20,184,166,0.25)',
    title: 'إدارة الفروع',
    subtitle: 'متجرك موزع في أماكن متعددة — إدارتك مركزية',
    description:
      'هل تمتلك أكثر من فرع أو تخطط للتوسع؟ نظام المدقق يربط جميع فروعك في لوحة تحكم مركزية واحدة. تابع أداء كل فرع بشكل مستقل، أو قارن الفروع ببعضها لمعرفة الأفضل أداءً ولتوزيع الموارد بذكاء.',
    features: [
      { icon: '🗺️', title: 'إضافة فروع جديدة', desc: 'بيانات كل فرع: الاسم، العنوان، ساعات العمل' },
      { icon: '👔', title: 'تعيين موظفي الفرع', desc: 'حدد الكاشيرين ومديري الفرع لكل موقع بالتفصيل' },
      { icon: '📊', title: 'تقرير مقارنة الفروع', desc: 'جدول شامل: مبيعات، أرباح، تكاليف، نمو كل فرع' },
      { icon: '🔄', title: 'نقل المخزون بين الفروع', desc: 'نقل بضاعة من فرع لآخر مع توثيق كامل ومتابعة' },
      { icon: '🔍', title: 'فلترة كل بيانات بالفرع', desc: 'أي تقرير أو مخزون أو مبيعات — فلترها لفرع بعينه' },
      { icon: '⚖️', title: 'اختيار الفرع النشط', desc: 'اعمل في أي فرع تريد بسهولة من القائمة العلوية' },
    ],
  },
  {
    icon: '🤖',
    accent: '#a78bfa',
    glow: 'rgba(167,139,250,0.25)',
    title: 'المساعد الذكي (AI)',
    subtitle: 'اسأل بالعربية — احصل على تحليل فوري من بياناتك الحقيقية',
    description:
      'المساعد الذكي يستخدم أحدث تقنيات Gemini AI من Google لفهم أسئلتك بالعربية العامية والفصحى، ثم يبحث في قاعدة بيانات متجرك مباشرةً ويجيبك بتحليل احترافي مفصّل وعملي يساعدك على اتخاذ قرارات أفضل.',
    features: [
      { icon: '💬', title: 'أسئلة بلهجتك العربية', desc: 'اكتب بالعامية أو الفصحى — النظام يفهم المعنى' },
      { icon: '📊', title: 'بيانات حقيقية فقط', desc: 'الإجابات من قاعدة بياناتك المباشرة — لا بيانات وهمية' },
      { icon: '🔧', title: 'أدوات ذكية متعددة', desc: 'يستدعي: المبيعات، المخزون، الأرباح، الكاشيرين' },
      { icon: '📈', title: 'تحليل مقارن عميق', desc: '"قارن مبيعات هذا الشهر بالشهر الماضي" — مثال' },
      { icon: '📝', title: 'تقارير لحظية بالأمثلة', desc: '"أكثر 10 منتجات مبيعاً هذا الأسبوع" — مثال' },
      { icon: '💡', title: 'اقتراحات ذكية', desc: '"ما المنتجات التي أوشكت على النفاد؟" — مثال' },
    ],
  },
  {
    icon: '💬',
    accent: '#094B9F',
    glow: 'rgba(9,75,159,0.25)',
    title: 'المساعد العائم — في كل صفحة',
    subtitle: 'احصل على مساعدة ذكية دون مغادرة أي صفحة',
    description:
      'الزر العائم في أسفل يسار الشاشة يفتح نافذة محادثة مع المساعد الذكي مباشرةً من أي صفحة في النظام. أثناء عملك في المخزون أو التقارير أو المبيعات — اسأل المساعد دون مغادرة ما تعمل عليه.',
    features: [
      { icon: '📌', title: 'ثابت في جميع الصفحات', desc: 'الزر العائم موجود في أسفل يسار كل صفحة دائماً' },
      { icon: '⚡', title: 'فتح فوري بضغطة واحدة', desc: 'اضغط الزر وابدأ الاستفسار مباشرةً بدون تأخير' },
      { icon: '💾', title: 'حفظ المحادثة للجلسة', desc: 'يتذكر النظام محادثتك طوال فترة جلسة العمل' },
      { icon: '🔄', title: 'متزامن مع الفرع المختار', desc: 'الإجابات تتعلق بالفرع الذي تعمل عليه حالياً' },
      { icon: '📋', title: 'أسئلة سريعة جاهزة', desc: 'قائمة أسئلة مقترحة للبداية السريعة في الاستعلام' },
      { icon: '🗑️', title: 'مسح وإعادة المحادثة', desc: 'ابدأ محادثة جديدة في أي وقت بضغطة زر واحدة' },
    ],
  },
  {
    icon: '⚙️',
    accent: '#64748b',
    glow: 'rgba(100,116,139,0.25)',
    title: 'إعدادات النظام',
    subtitle: 'خصّص كل شيء ليناسب متجرك تماماً',
    description:
      'صفحة الإعدادات هي مركز تحكم متجرك الكامل. خصّص بيانات متجرك وفاتورتك، أضف موظفين وحدد صلاحياتهم بدقة، وتابع تفاصيل اشتراكك وسجل مدفوعاتك — كل ذلك من تبويبات واضحة ومنظمة.',
    features: [
      { icon: '🏪', title: 'معلومات المتجر الكاملة', desc: 'الاسم، الهاتف، العنوان، تذييل الفاتورة مع معاينة فورية' },
      { icon: '🖨️', title: 'إعدادات الطابعة', desc: 'اسم الطابعة الحرارية وتفعيل الطباعة التلقائية بعد البيع' },
      { icon: '💲', title: 'الإعدادات المالية', desc: 'نسبة ضريبة القيمة المضافة المطبقة على الفواتير' },
      { icon: '👥', title: 'إدارة المستخدمين', desc: 'إضافة حسابات جديدة، تعيين أدوار، وحذف الحسابات' },
      { icon: '💳', title: 'الاشتراك والفواتير', desc: 'حالة الاشتراك الحالي، تاريخ الانتهاء، وسجل الدفعات' },
      { icon: '💾', title: 'النسخ الاحتياطي', desc: 'تنزيل نسخة شاملة لجميع بياناتك في أي وقت' },
    ],
  },
  {
    icon: '🚀',
    accent: '#094B9F',
    glow: 'rgba(9,75,159,0.25)',
    title: 'أنت جاهز للانطلاق!',
    subtitle: 'ابدأ رحلتك مع نظام المدقق الآن — الإعداد بسيط وسريع',
    description:
      'لقد تعرفت على جميع ميزات نظام المدقق الأساسية. ابدأ بإعداد متجرك خطوة بخطوة باتباع التسلسل أدناه، وستكون جاهزاً للعمل الكامل في وقت قصير. يمكنك إعادة هذه الجولة دائماً من صفحة الإعدادات.',
    features: [
      { icon: '1️⃣', title: 'أضف بيانات متجرك', desc: 'من الإعدادات: اسم المتجر، الهاتف، العنوان، تذييل الفاتورة' },
      { icon: '2️⃣', title: 'أضف منتجاتك', desc: 'من المخزون: أضف الأصناف مع الأسعار والكميات والباركود' },
      { icon: '3️⃣', title: 'أضف موظفيك', desc: 'من الإعدادات: أنشئ حسابات بصلاحيات مناسبة لكل دور' },
      { icon: '4️⃣', title: 'ابدأ البيع الفعلي', desc: 'اذهب لنقطة البيع وأصدر أول فاتورة لأول عميل' },
      { icon: '5️⃣', title: 'راجع التقارير يومياً', desc: 'بعد يوم العمل راجع لوحة التحكم وأغلق الوردية' },
      { icon: '🔁', title: 'أعد الجولة في أي وقت', desc: 'من الإعدادات ← إعدادات عامة ← "إعادة الجولة"' },
    ],
  },
]

export function AppTour() {
  const { triggerCount } = useTourContext()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [fading, setFading] = useState(false)
  const prevTrigger = useRef(0)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) { setStep(0); setActive(true) }
  }, [])

  useEffect(() => {
    if (triggerCount > 0 && triggerCount !== prevTrigger.current) {
      prevTrigger.current = triggerCount
      setStep(0)
      setActive(true)
    }
  }, [triggerCount])

  const close = useCallback(() => {
    setActive(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }, [])

  const goTo = useCallback((idx: number) => {
    setFading(true)
    setTimeout(() => { setStep(idx); setFading(false) }, 160)
  }, [])

  const next = useCallback(() => {
    if (step < STEPS.length - 1) goTo(step + 1); else close()
  }, [step, goTo, close])

  const prev = useCallback(() => { if (step > 0) goTo(step - 1) }, [step, goTo])

  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') next()
      if (e.key === 'ArrowRight') prev()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [active, next, prev, close])

  if (!active) return null

  const cur = STEPS[step]
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      dir="rtl"
      style={{ background: 'linear-gradient(145deg, #06040f 0%, #0a0720 40%, #050b18 100%)' }}
    >
      {/* ═══ Top bar ═══ */}
      <header
        className="flex items-center justify-between px-6 py-3.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 4px 12px rgba(9,75,159,0.35)' }}>
            <span className="text-white text-sm font-black">ب</span>
          </div>
          <div>
            <p className="text-sm font-black text-white leading-tight">نظام المدقق</p>
            <p className="text-[10px] font-bold tracking-widest" style={{ color: '#818cf8' }}>الجولة التعريفية</p>
          </div>
        </div>

        {/* Step label */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{ background: `${cur.accent}15`, border: `1px solid ${cur.accent}30` }}>
          <span className="text-base">{cur.icon}</span>
          <span className="text-xs font-bold" style={{ color: cur.accent }}>
            خطوة {step + 1} من {STEPS.length}
          </span>
        </div>

        {/* Close */}
        <button onClick={close}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all hover:bg-white/8"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <X className="w-3.5 h-3.5" />
          تخطي الجولة
        </button>
      </header>

      {/* ═══ Progress bar ═══ */}
      <div className="h-[3px] shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, background: `linear-gradient(90deg, #094B9F, ${cur.accent})` }} />
      </div>

      {/* ═══ Body ═══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── Sidebar (RIGHT in RTL) ─── */}
        <aside
          className="w-64 shrink-0 overflow-y-auto py-5 px-3 hidden md:block"
          style={{
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.2)',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.05) transparent',
          }}
        >
          <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest px-3 mb-3">
            محتويات الجولة
          </p>
          <nav className="space-y-0.5">
            {STEPS.map((s, i) => (
              <button key={i} onClick={() => goTo(i)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right transition-all duration-150"
                style={{
                  background: i === step ? `linear-gradient(90deg, ${s.accent}20, ${s.accent}06)` : 'transparent',
                  border: i === step ? `1px solid ${s.accent}30` : '1px solid transparent',
                }}>
                {/* Indicator */}
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: i < step
                      ? 'rgba(16,185,129,0.15)'
                      : i === step
                        ? `linear-gradient(135deg, ${s.accent}, ${s.accent}bb)`
                        : 'rgba(255,255,255,0.04)',
                    border: i < step ? '1px solid rgba(16,185,129,0.25)' : i === step ? `1px solid ${s.accent}60` : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  {i < step
                    ? <Check className="w-3 h-3 text-emerald-400" />
                    : <span className={`text-[10px] font-black ${i === step ? 'text-white' : 'text-slate-700'}`}>{i + 1}</span>
                  }
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm shrink-0">{s.icon}</span>
                  <p className={`text-[12px] font-bold truncate ${
                    i === step ? 'text-white' : i < step ? 'text-emerald-500/60' : 'text-slate-600'
                  }`}>
                    {s.title}
                  </p>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        {/* ─── Main content (LEFT in RTL) ─── */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.05) transparent' }}
        >
          <div
            className="min-h-full p-6 lg:p-10 xl:p-12 transition-opacity duration-150"
            style={{ opacity: fading ? 0 : 1 }}
          >
            {/* ─ Hero ─ */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-8">
              {/* Big icon */}
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${cur.accent}22, ${cur.accent}0a)`,
                  border: `1.5px solid ${cur.accent}35`,
                  boxShadow: `0 0 40px ${cur.glow}, 0 8px 32px rgba(0,0,0,0.4)`,
                }}>
                <div className="absolute inset-0 opacity-30"
                  style={{ background: `radial-gradient(circle at 30% 30%, ${cur.accent}50, transparent 70%)` }} />
                <span className="text-4xl relative z-10">{cur.icon}</span>
              </div>

              {/* Title block */}
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-1.5"
                  style={{ color: cur.accent }}>
                  <span className="w-4 h-0.5 inline-block rounded-full" style={{ background: cur.accent }} />
                  خطوة {step + 1} من {STEPS.length}
                </p>
                <h2 className="text-2xl lg:text-3xl xl:text-4xl font-black text-white leading-tight mb-2">
                  {cur.title}
                </h2>
                <p className="text-sm lg:text-base font-semibold" style={{ color: `${cur.accent}cc` }}>
                  {cur.subtitle}
                </p>
              </div>
            </div>

            {/* ─ Divider ─ */}
            <div className="mb-6 h-px" style={{ background: `linear-gradient(90deg, ${cur.accent}30, transparent)` }} />

            {/* ─ Description ─ */}
            <p className="text-[15px] lg:text-base text-slate-300 leading-relaxed mb-8 max-w-3xl">
              {cur.description}
            </p>

            {/* ─ Features ─ */}
            <div className="mb-2">
              <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: `${cur.accent}40` }} />
                الميزات الرئيسية
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {cur.features.map((f, i) => (
                  <div key={i}
                    className="group flex items-start gap-3.5 p-4 rounded-2xl transition-all duration-200 hover:scale-[1.01]"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: `${cur.accent}12`,
                        border: `1px solid ${cur.accent}20`,
                      }}>
                      <span className="text-xl">{f.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-white mb-0.5 leading-tight">{f.title}</p>
                      <p className="text-[12px] text-slate-500 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ═══ Footer ═══ */}
      <footer
        className="shrink-0 px-6 py-4 flex items-center justify-between gap-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.25)' }}
      >
        {/* Prev */}
        <div className="w-28 flex justify-start">
          {step > 0 && (
            <button onClick={prev}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-white/5"
              style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
              <ChevronRight className="w-4 h-4" />
              السابق
            </button>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className="rounded-full transition-all duration-300 hover:opacity-80"
              style={{
                width: i === step ? 28 : 7,
                height: 7,
                background: i === step
                  ? `linear-gradient(90deg, #094B9F, ${cur.accent})`
                  : i < step
                    ? 'rgba(16,185,129,0.45)'
                    : 'rgba(255,255,255,0.1)',
              }} />
          ))}
        </div>

        {/* Next */}
        <div className="w-28 flex justify-end">
          <button onClick={next}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-95"
            style={{
              background: isLast
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : `linear-gradient(135deg, #094B9F, ${cur.accent})`,
              boxShadow: isLast
                ? '0 4px 18px rgba(16,185,129,0.45)'
                : `0 4px 18px ${cur.glow}`,
            }}>
            {isLast ? '🚀 ابدأ الآن' : 'التالي'}
            {!isLast && <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </footer>
    </div>
  )
}
