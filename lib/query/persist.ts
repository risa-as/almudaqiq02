'use client'

/**
 * إدامة كاش React Query في localStorage.
 *
 * المشكلة التي يحلّها: كاش React Query يعيش في الذاكرة فقط، فإعادة التحميل
 * العميق (F5) تمحوه بالكامل — كل صفحة تعود إلى شاشة الانتظار وتنتظر الشبكة
 * من الصفر (7–10 ثوان على اتصال بطيء أو قاعدة بيانات بعيدة).
 *
 * الحل: نُفرِّغ (dehydrate) الاستعلامات المسموح بها إلى localStorage، ونعيد
 * ملأها (hydrate) قبل أول رسم بعد إعادة التحميل. النتيجة: الصفحة تُرسم فورًا
 * بالبيانات المحفوظة، ويُعاد الجلب في الخلفية لتصحيحها (stale-while-revalidate).
 *
 * لا تعتمد على حزم إضافية — dehydrate/hydrate جزء من @tanstack/react-query.
 */

import { dehydrate, hydrate, type QueryClient, type Query } from '@tanstack/react-query'

const STORAGE_KEY = 'rqCache'
/** ارفع الرقم عند أي تغيير في شكل بيانات الاستعلامات ليُهمَل الكاش القديم. */
const CACHE_VERSION = 1
/** الكاش المحفوظ يُهمل بعد هذه المدة (لا نرسم بيانات أقدم من يوم). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000
/**
 * سقف حجم الكتابة — حصة localStorage عادةً ~5MB لكل نطاق.
 *
 * حدٌّ معروف: تجاوز السقف يُلغي الكتابة بصمت، فتتوقف الإدامة عن العمل عند
 * المستأجرين الأكبر — وهم أكثر من يحتاجها. للقياس: 138 منتجًا ≈ 156KB، أي أن
 * السقف يُبلغ عند ~2000 منتج تقريبًا. عندها يكون الحل تقليم الحقول غير
 * المستخدمة من /api/products أو ترقيم الصفحات من الخادم، لا رفع السقف.
 */
const MAX_BYTES = 2_500_000
/** تأخير الكتابة بعد آخر تغيير في الكاش (لا نكتب مع كل رندر). */
const WRITE_DEBOUNCE_MS = 800

/**
 * قائمة السماح: هذه المفاتيح فقط تُكتب إلى القرص.
 *
 * المعيار: بيانات مرجعية/قوائم يملكها المستأجر ويقبل رؤيتها لحظةً قديمة قبل
 * أن يصحّحها الجلب الخلفي. مستثنى بشكل متعمّد:
 *   - 'auth' و'users' و'billing' — هوية وصلاحيات: كاش قديم قد يمنح واجهة
 *     مدير لمستخدم تغيّر دوره، أو يُظهر بيانات مستخدم سابق على نفس المتصفح.
 *   - 'report-*' و'dashboard-*' — أرقام مالية وزمنية: قيمة قديمة هنا تُقرأ
 *     كخطأ حسابي لا كتحسين سرعة.
 *   - 'sync-queue' و'backup-logs' و'ai-*' — حالة تشغيلية لحظية.
 *
 * لإضافة صفحة إلى الإدامة: أضف مفتاحها الجذري هنا فقط.
 */
const PERSISTED_KEYS = new Set([
  'products',
  'product',
  'product-history',
  'categories',
  'suppliers',
  'supplier-ledger',
  'supplier-batches',
  'batches',
  'inventory-expiry',
  'customers',
  'customer',
  'offers',
  'branches',        // قائمة الفروع — BranchContext يجلبها في كل صفحة
  'branches-admin',
  'transfers',
  'expenses',
  'orders',
  'stocktake',       // قائمة جلسات الجرد (لا 'stocktake-detail': جلسة عدٍّ جارية)
])

interface Envelope {
  v: number
  savedAt: number
  state: unknown
}

function rootKeyOf(query: Query): string | null {
  const key = query.queryKey
  const root = Array.isArray(key) ? key[0] : key
  return typeof root === 'string' ? root : null
}

/** يُقرِّر ما إذا كان استعلام ما يُكتب إلى القرص. */
function shouldPersist(query: Query): boolean {
  if (query.state.status !== 'success') return false
  if (query.state.data === undefined) return false
  const root = rootKeyOf(query)
  return root !== null && PERSISTED_KEYS.has(root)
}

/**
 * عمر مُصطنع يُمنح للاستعلامات المستعادة من القرص.
 *
 * لماذا: staleTime في المزوّد خمس دقائق. بلا هذا التعديل قد يُستعاد استعلام
 * كُتب قبل دقيقتين فيُعدّه React Query «طازجًا» ولا يُعيد جلبه — فيرى المستخدم
 * كميات مخزون أو أرصدة من جلسةٍ سابقة دون أي تحديث. البيانات المستعادة من
 * جلسة أخرى لا يمكن الوثوق بطزاجتها مهما كان عمرها.
 *
 * الحل: نُقدّم طابعها الزمني ليتجاوز staleTime، فتُعدّ قديمة ويُعاد جلبها في
 * الخلفية فور التركيب — مع بقائها معروضة (لا شاشة انتظار). لا نستعمل صفرًا لأن
 * hydrate لا يكتب إلا إذا كان الطابع أحدث من الموجود، والاستعلام الجديد يبدأ
 * بصفر، فيُلغى الاستيراد كليًا. أي قيمة موجبة قديمة تحقّق الأمرين.
 *
 * ملاحظة: هذا يحفظ سلوك التنقّل داخل الجلسة كما هو — استعلامات الجلسة الحالية
 * تحتفظ بطابعها الحقيقي فلا شبكة خلال الخمس دقائق.
 */
const RESTORED_AGE_MS = 6 * 60 * 1000

/**
 * يُعيد ملء الكاش من localStorage. يُنادى مرة واحدة قبل أول رسم.
 *
 * hydrate لا يطمس بيانات أحدث: الاستعلامات التي بدأ جلبها فعلًا ستُحدَّث
 * بنتيجة الشبكة عند وصولها لأن طابعها الزمني أحدث.
 */
export function restoreQueryCache(client: QueryClient): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    const envelope = JSON.parse(raw) as Envelope
    if (envelope?.v !== CACHE_VERSION) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }
    if (!envelope.savedAt || Date.now() - envelope.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }

    // وسم كل استعلام مستعاد بأنه قديم ⇒ يُعرض فورًا ثم يُصحَّح من الشبكة
    const staleAt = Date.now() - RESTORED_AGE_MS
    const state = envelope.state as { queries?: { state?: { dataUpdatedAt?: number } }[] }
    if (Array.isArray(state?.queries)) {
      for (const q of state.queries) {
        if (q?.state) q.state.dataUpdatedAt = staleAt
      }
    }

    hydrate(client, envelope.state)
  } catch {
    // كاش تالف أو localStorage محجوب — نبدأ نظيفين بلا ضرر
    try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }
}

/**
 * يراقب الكاش ويكتبه (مؤجَّلًا) إلى localStorage.
 * يُعيد دالة لإلغاء الاشتراك.
 */
export function subscribeQueryCachePersist(client: QueryClient): () => void {
  if (typeof window === 'undefined') return () => {}

  let timer: ReturnType<typeof setTimeout> | null = null

  const write = () => {
    timer = null
    try {
      const state = dehydrate(client, { shouldDehydrateQuery: shouldPersist })
      if (state.queries.length === 0) return

      const payload = JSON.stringify({ v: CACHE_VERSION, savedAt: Date.now(), state } satisfies Envelope)
      // تجاوز الحجم: نتجاهل الكتابة بدل رمي QuotaExceededError وإفساد الكاش القائم
      if (payload.length > MAX_BYTES) return

      window.localStorage.setItem(STORAGE_KEY, payload)
    } catch {
      // حصة ممتلئة أو تخزين محجوب (تصفّح خاص) — الإدامة تحسين لا شرط
      try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }
  }

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(write, WRITE_DEBOUNCE_MS)
  }

  const unsubscribe = client.getQueryCache().subscribe(schedule)

  // إن أُغلقت الصفحة قبل انتهاء التأجيل، نكتب فورًا حتى لا تُفقد آخر بيانات
  const flush = () => { if (timer) { clearTimeout(timer); write() } }
  window.addEventListener('pagehide', flush)

  return () => {
    if (timer) clearTimeout(timer)
    unsubscribe()
    window.removeEventListener('pagehide', flush)
  }
}

/**
 * يمحو الكاش المحفوظ. يجب أن يُنادى عند تسجيل الخروج حتى لا يرى المستخدم
 * التالي على نفس المتصفح بيانات المستأجر السابق.
 */
export function clearPersistedQueryCache(): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}
