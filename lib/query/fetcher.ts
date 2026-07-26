/**
 * جالب JSON موحّد لاستعلامات React Query (طلبات GET فقط).
 * يرمي خطأً عند فشل الاستجابة كي يظهر في حالة error الخاصة بالاستعلام؛
 * عمليات الكتابة (POST/PUT/DELETE) تبقى fetch عادية داخل الصفحات
 * متبوعة بـ invalidateQueries.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      /* الجسم ليس JSON — نكتفي برمز الحالة */
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

/**
 * نسخة متسامحة: تعيد قيمة افتراضية بدل رمي الخطأ — تحاكي نمط
 * `.catch(() => default)` المستخدم سابقًا في بعض الصفحات التي
 * تتعمد تجاهل فشل جزء من البيانات (مثل لوحة التحكم).
 */
export async function fetchJsonOr<T>(url: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    return await fetchJson<T>(url, init)
  } catch {
    return fallback
  }
}
