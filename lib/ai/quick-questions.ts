export interface QuickQuestion {
  emoji: string
  text: string
}

export interface QuestionCategory {
  id: string
  label: string
  icon: string
  accent: string
  bgFrom: string
  bgTo: string
  /** URL path prefixes that match this category */
  paths: string[]
  questions: QuickQuestion[]
}

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    icon: '🏠',
    accent: '#3b82f6',
    bgFrom: 'rgba(59,130,246,0.12)',
    bgTo: 'rgba(59,130,246,0.06)',
    paths: ['/dashboard'],
    questions: [
      { emoji: '💰', text: 'ما هي مبيعات اليوم بالتفصيل؟' },
      { emoji: '📈', text: 'ما صافي الربح هذا الأسبوع؟' },
      { emoji: '🔄', text: 'قارن أداء اليوم بالأمس' },
      { emoji: '⚠️', text: 'ما المنتجات التي وصلت للحد الأدنى في المخزون؟' },
      { emoji: '🏆', text: 'ما أكثر 5 منتجات مبيعاً اليوم؟' },
      { emoji: '🧾', text: 'كم عدد الفواتير المصدرة اليوم؟' },
      { emoji: '📊', text: 'ما متوسط قيمة الفاتورة اليوم؟' },
    ],
  },
  {
    id: 'inventory',
    label: 'المخزون',
    icon: '📦',
    accent: '#10b981',
    bgFrom: 'rgba(16,185,129,0.12)',
    bgTo: 'rgba(16,185,129,0.06)',
    paths: ['/inventory', '/transfers'],
    questions: [
      { emoji: '📉', text: 'ما المنتجات التي تنفد من المخزون؟' },
      { emoji: '💎', text: 'ما قيمة المخزون الإجمالية الحالية؟' },
      { emoji: '⏰', text: 'ما المنتجات التي توشك على انتهاء صلاحيتها خلال 30 يوم؟' },
      { emoji: '😴', text: 'ما المنتجات التي لم تُباع منذ 30 يوماً؟' },
      { emoji: '🔢', text: 'كم إجمالي عدد الأصناف في المخزون؟' },
      { emoji: '💰', text: 'ما أغلى 10 منتجات في المخزون قيمةً؟' },
      { emoji: '🔁', text: 'ما المنتجات التي تحتاج إعادة طلب من الموردين؟' },
      { emoji: '🚫', text: 'ما المنتجات التي نفدت كلياً من المخزون؟' },
      { emoji: '📋', text: 'ما حركة المخزون (وارد وصادر) هذا الأسبوع؟' },
    ],
  },
  {
    id: 'sales',
    label: 'المبيعات',
    icon: '🛒',
    accent: '#f59e0b',
    bgFrom: 'rgba(245,158,11,0.12)',
    bgTo: 'rgba(245,158,11,0.06)',
    paths: ['/sales'],
    questions: [
      { emoji: '💵', text: 'ما إجمالي مبيعات هذا الشهر؟' },
      { emoji: '👑', text: 'من هو أفضل كاشير هذا الأسبوع؟' },
      { emoji: '🏆', text: 'ما أكثر 10 منتجات مبيعاً هذا الشهر؟' },
      { emoji: '📋', text: 'ما متوسط قيمة الفاتورة هذا الشهر؟' },
      { emoji: '💳', text: 'ما العملاء الذين لديهم ديون متأخرة ولم يسددوا؟' },
      { emoji: '🏷️', text: 'ما إجمالي الخصومات المقدمة هذا الشهر؟' },
      { emoji: '↩️', text: 'كم عدد عمليات الإرجاع هذا الأسبوع؟' },
      { emoji: '⏰', text: 'ما أكثر ساعة ازدحاماً في اليوم؟' },
    ],
  },
  {
    id: 'purchases',
    label: 'المشتريات',
    icon: '🚚',
    accent: '#094B9F',
    bgFrom: 'rgba(14,99,212,0.12)',
    bgTo: 'rgba(14,99,212,0.06)',
    paths: ['/purchases'],
    questions: [
      { emoji: '🔁', text: 'ما المنتجات التي تحتاج إعادة طلب الآن؟' },
      { emoji: '💰', text: 'ما إجمالي المشتريات هذا الشهر؟' },
      { emoji: '🥇', text: 'من هو المورد الأكثر توريداً هذا الشهر؟' },
      { emoji: '📋', text: 'ما آخر عمليات الشراء المسجلة بالتفصيل؟' },
      { emoji: '📊', text: 'ما تكلفة المشتريات مقارنة بالشهر الماضي؟' },
      { emoji: '⚖️', text: 'قارن أسعار الموردين وهوامش ربح منتجاتهم' },
    ],
  },
  {
    id: 'accounting',
    label: 'المحاسبة',
    icon: '💰',
    accent: '#ec4899',
    bgFrom: 'rgba(236,72,153,0.12)',
    bgTo: 'rgba(236,72,153,0.06)',
    paths: ['/accounting'],
    questions: [
      { emoji: '📈', text: 'ما صافي الربح هذا الشهر؟' },
      { emoji: '📝', text: 'ما إجمالي المصروفات هذا الأسبوع؟' },
      { emoji: '💹', text: 'ما هامش الربح الإجمالي للمتجر؟' },
      { emoji: '⚖️', text: 'قارن الإيرادات بالتكاليف هذا الشهر' },
      { emoji: '🔒', text: 'ما الوردية الأكثر إيراداً هذا الأسبوع؟' },
      { emoji: '👨‍💼', text: 'ما أداء الكاشيرين هذا الأسبوع؟' },
      { emoji: '🏦', text: 'ما إجمالي الضرائب المحصلة هذا الشهر؟' },
      { emoji: '📉', text: 'ما هامش الربح لكل منتج هذا الشهر؟' },
    ],
  },
  {
    id: 'reports',
    label: 'التقارير',
    icon: '📊',
    accent: '#06b6d4',
    bgFrom: 'rgba(6,182,212,0.12)',
    bgTo: 'rgba(6,182,212,0.06)',
    paths: ['/reports'],
    questions: [
      { emoji: '🔄', text: 'قارن مبيعات هذا الشهر بالشهر الماضي' },
      { emoji: '📈', text: 'ما نسبة نمو المبيعات هذا الشهر؟' },
      { emoji: '🏢', text: 'ما أداء الفروع المختلفة هذا الأسبوع؟' },
      { emoji: '📦', text: 'ما حركة المخزون خلال الأسبوع الماضي؟' },
      { emoji: '📋', text: 'أعطني ملخصاً مالياً شاملاً لهذا الشهر' },
      { emoji: '💹', text: 'ما المنتجات ذات أعلى هامش ربح هذا الشهر؟' },
      { emoji: '🏷️', text: 'ما أكثر التصنيفات مبيعاً هذا الشهر؟' },
    ],
  },
  {
    id: 'branches',
    label: 'الفروع',
    icon: '🏢',
    accent: '#14b8a6',
    bgFrom: 'rgba(20,184,166,0.12)',
    bgTo: 'rgba(20,184,166,0.06)',
    paths: ['/branches'],
    questions: [
      { emoji: '📊', text: 'ما أداء كل فرع هذا الأسبوع؟' },
      { emoji: '🥇', text: 'أي فرع الأكثر مبيعاً هذا الشهر؟' },
      { emoji: '⚖️', text: 'قارن إيرادات الفروع المختلفة' },
      { emoji: '💹', text: 'ما الفرع الذي يحقق أعلى هامش ربح صافٍ؟' },
      { emoji: '🏆', text: 'ما المنتجات الأكثر مبيعاً في كل فرع؟' },
    ],
  },
  {
    id: 'marketing',
    label: 'التسويق',
    icon: '🏷️',
    accent: '#f97316',
    bgFrom: 'rgba(249,115,22,0.12)',
    bgTo: 'rgba(249,115,22,0.06)',
    paths: ['/marketing'],
    questions: [
      { emoji: '💯', text: 'ما إجمالي الخصومات المقدمة هذا الشهر؟' },
      { emoji: '📉', text: 'كم خسرنا على العروض الترويجية؟' },
      { emoji: '🔥', text: 'ما العروض الأكثر استخداماً من العملاء هذا الشهر؟' },
      { emoji: '📈', text: 'كم مرة استُخدم كل عرض ترويجي هذا الشهر؟' },
      { emoji: '🎯', text: 'ما إجمالي الخصومات الناتجة عن العروض هذا الشهر؟' },
    ],
  },
  {
    id: 'general',
    label: 'عام',
    icon: '🤖',
    accent: '#094B9F',
    bgFrom: 'rgba(9,75,159,0.12)',
    bgTo: 'rgba(9,75,159,0.06)',
    paths: [],
    questions: [
      { emoji: '📋', text: 'اعطني ملخصاً شاملاً عن وضع المتجر اليوم' },
      { emoji: '💡', text: 'ما التوصيات لتحسين الأداء هذا الأسبوع؟' },
      { emoji: '🏆', text: 'ما أكثر 10 منتجات مبيعاً هذا الشهر؟' },
      { emoji: '🔔', text: 'ما المشاكل التي تحتاج انتباهاً الآن؟' },
      { emoji: '📊', text: 'اعطني تقريراً كاملاً عن أداء المتجر هذا الأسبوع' },
    ],
  },
]

/** Returns the best-matching category questions for a given pathname (3 questions). */
export function getContextQuestions(pathname: string): { category: QuestionCategory; questions: QuickQuestion[] } {
  const matched = QUESTION_CATEGORIES.find(cat =>
    cat.paths.some(p => pathname === p || pathname.startsWith(p + '/'))
  ) ?? QUESTION_CATEGORIES.find(c => c.id === 'general')!
  return { category: matched, questions: matched.questions.slice(0, 3) }
}
