import type { FeatureMap } from '@/features'
import { ar } from '@/i18n/ar'
import { api, ApiError, apiUrl } from '../client'

export type Role = 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER' | 'STOCK_KEEPER'

export interface LoginResponse {
  accessToken: string
  refreshToken?: string
  user: {
    id: string
    email: string | null
    role: string
    username?: string | null
    branchId?: string | null
  }
  tenant?: { id: string; name: string }
}

export interface MeResponse {
  user: {
    id: string
    role: Role
    tenantId: string
    branchId: string | null
  } | null
  features: FeatureMap
}

/** تسجيل الدخول — طلب خام (بدون Bearer) مع ترويسة العميل المحمول. */
export async function login(email: string, password: string): Promise<LoginResponse> {
  let res: Response
  try {
    res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-type': 'mobile' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new ApiError(0, ar.common.networkError)
  }
  const data = (await res.json().catch(() => null)) as (LoginResponse & { error?: string }) | null
  if (!res.ok || !data?.accessToken) {
    throw new ApiError(res.status, data?.error ?? ar.common.unexpectedError)
  }
  return data
}

/** جلسة المستخدم الحالية + خريطة ميزات الخطة (مصدر بوابة الميزات في التطبيق). */
export async function fetchMe(): Promise<MeResponse> {
  return api<MeResponse>('/api/auth/me')
}
