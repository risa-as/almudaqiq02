'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

/**
 * مزوّد كاش البيانات الموحّد (React Query).
 *
 * السلوك المطلوب في الموقع:
 * - التنقل بين الصفحات يعرض البيانات المخزّنة فورًا (بدون سبينر إعادة تحميل).
 * - البيانات تُعتبر «طازجة» لمدة staleTime؛ بعدها يعاد جلبها بالخلفية عند زيارة
 *   الصفحة دون إخفاء المحتوى المعروض (stale-while-revalidate).
 * - الكاش في الذاكرة فقط: إعادة التحميل العميق للصفحة (F5) تعيد الجلب من السيرفر.
 * - عمليات الإضافة/التعديل/الحذف تُبطل الكاش المرتبط بها (invalidateQueries).
 */
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

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
