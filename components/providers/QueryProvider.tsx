'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { restoreQueryCache, subscribeQueryCachePersist } from '@/lib/query/persist'

/**
 * مزوّد كاش البيانات الموحّد (React Query).
 *
 * السلوك المطلوب في الموقع:
 * - التنقل بين الصفحات يعرض البيانات المخزّنة فورًا (بدون سبينر إعادة تحميل).
 * - البيانات تُعتبر «طازجة» لمدة staleTime؛ بعدها يعاد جلبها بالخلفية عند زيارة
 *   الصفحة دون إخفاء المحتوى المعروض (stale-while-revalidate).
 * - إعادة التحميل العميق (F5) تُرسم أيضًا من كاش محفوظ في localStorage ثم
 *   يُصحَّح بالخلفية — انظر lib/query/persist.ts لقائمة المفاتيح المحفوظة.
 * - عمليات الإضافة/التعديل/الحذف تُبطل الكاش المرتبط بها (invalidateQueries).
 */

// useLayoutEffect يعمل قبل الرسم (فلا تظهر شاشة الانتظار ولو لإطار واحد)،
// لكنه يحذّر على السيرفر — لذا نختار البديل حسب البيئة.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // إنشاء العميل مرة واحدة لكل جلسة متصفح (وليس لكل رندر)
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // طازجة 5 دقائق — لا شبكة عند التنقل خلالها
            gcTime: 30 * 60 * 1000, // تبقى بالذاكرة 30 دقيقة بعد آخر استخدام
            refetchOnWindowFocus: false, // لا إعادة جلب عند مجرد الرجوع للنافذة
            retry: 1,
          },
        },
      })
  )

  const restored = useRef(false)

  // الاستعادة تحدث بعد تركيب الشجرة (hydration) وقبل الرسم: فلا يوجد اختلاف
  // بين مخرَج السيرفر ومخرَج أول رندر على العميل (لا hydration mismatch)،
  // ومع ذلك لا يرى المستخدم شاشة الانتظار.
  useIsomorphicLayoutEffect(() => {
    if (restored.current) return
    restored.current = true
    restoreQueryCache(client)
  }, [client])

  useEffect(() => subscribeQueryCachePersist(client), [client])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
