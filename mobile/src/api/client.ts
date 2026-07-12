import { ar } from '@/i18n/ar'
import { useNetworkStore } from '@/stores/network'
import { clearTokens, getTokens, setAccessToken } from './tokens'

// يقبل الرابط بصيغة https://host أو https://host/api — المسارات هنا تبدأ بـ /api دائمًا
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '')

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** يُسجَّل من مخزن الجلسة — يُستدعى عند فشل تجديد التوكن نهائيًا. */
let onSessionExpired: (() => void) | null = null
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

export function apiUrl(path: string): string {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

// ── تجديد التوكن (single-flight: طلب تجديد واحد مهما تعددت الاستعلامات المرفوضة) ──
let refreshPromise: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  try {
    const { refreshToken } = await getTokens()
    if (!refreshToken) return null
    const res = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-type': 'mobile' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => null)) as { accessToken?: string } | null
    if (!data?.accessToken) return null
    await setAccessToken(data.accessToken)
    return data.accessToken
  } catch {
    return null
  }
}

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function expireSession(): Promise<never> {
  await clearTokens()
  onSessionExpired?.()
  throw new ApiError(401, ar.common.sessionExpired)
}

// ── الطلب الموحّد ─────────────────────────────────────────────────────────────
export type QueryParams = Record<string, string | number | boolean | null | undefined>

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: QueryParams
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = apiUrl(path)
  if (!query) return url
  const params = Object.entries(query)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return params.length ? `${url}?${params.join('&')}` : url
}

async function doFetch(url: string, opts: ApiOptions, accessToken: string | null): Promise<Response> {
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-type': 'mobile',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
    // وصلت استجابة من الخادم (ولو كانت خطأ HTTP) → الاتصال قائم
    useNetworkStore.getState().setOffline(false)
    return res
  } catch {
    // فشل شبكة (لا يوجد وصول للخادم إطلاقًا) → إظهار لافتة عدم الاتصال
    useNetworkStore.getState().setOffline(true)
    throw new ApiError(0, ar.common.networkError)
  }
}

/**
 * الطلب المصادق الموحّد: Bearer + تجديد صامت مرة واحدة عند 401 ثم إنهاء الجلسة.
 * يرمي ApiError دائمًا عند الفشل، برسالة عربية جاهزة للعرض.
 */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const url = buildUrl(path, opts.query)
  const { accessToken } = await getTokens()

  let res = await doFetch(url, opts, accessToken)

  if (res.status === 401) {
    const renewed = await refreshOnce()
    if (!renewed) return expireSession()
    res = await doFetch(url, opts, renewed)
    if (res.status === 401) return expireSession()
  }

  const data = (await res.json().catch(() => null)) as unknown

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null) ?? ar.common.unexpectedError
    throw new ApiError(res.status, message)
  }

  return data as T
}
