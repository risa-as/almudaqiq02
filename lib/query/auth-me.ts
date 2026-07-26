'use client'

/**
 * تعريف واحد لاستعلام «من أنا» (/api/auth/me).
 *
 * لماذا: كان هذا المسار يُطلب ثلاث مرات متزامنة في كل تحميل صفحة —
 * BranchContext وFeatureContext وuseUser — وكل طلب يفتح رحلة إلى قاعدة
 * البيانات (getTenantFeatures) لجلب البيانات ذاتها. توحيد المفتاح ودالة
 * الجلب يجعل React Query يجمعها في طلب واحد.
 *
 * المستهلكون: useUser (useQuery)، BranchContext وFeatureContext
 * (queryClient.fetchQuery — يعيد الكاش الطازج بلا شبكة).
 */

import type { FeatureMap } from '@/lib/features'

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER' | 'STOCK_KEEPER'

export interface MeResponse {
  user: {
    id?: string
    role?: Role | null
    username?: string | null
    tenantId?: string
    branchId?: string | null
  } | null
  features?: FeatureMap
  isElectron?: boolean
}

const EMPTY_ME: MeResponse = { user: null, features: {}, isElectron: false }

export const AUTH_ME_KEY = ['auth', 'me'] as const

export const authMeQueryOptions = {
  queryKey: AUTH_ME_KEY,
  queryFn: async (): Promise<MeResponse> => {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return EMPTY_ME
    return (await res.json()) as MeResponse
  },
  // الهوية والصلاحيات لا تتغير خلال تنقّل عادي — لا نُعيد جلبها لكل صفحة.
  staleTime: 5 * 60 * 1000,
} as const
