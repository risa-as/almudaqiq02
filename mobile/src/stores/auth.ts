import { create } from 'zustand'
import { fetchMe, login, type Role } from '@/api/endpoints/auth'
import { ApiError, setSessionExpiredHandler } from '@/api/client'
import { queryClient } from '@/api/queryClient'
import { clearTokens, getTokens, setTokens } from '@/api/tokens'
import type { FeatureMap } from '@/features'

export interface AuthUser {
  id: string
  role: Role
  tenantId: string
  branchId: string | null
  username?: string | null
  email?: string | null
  tenantName?: string
}

export type AuthStatus = 'booting' | 'signedOut' | 'signedIn'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  features: FeatureMap
  signIn: (email: string, password: string) => Promise<void>
  restore: () => Promise<void>
  refreshFeatures: () => Promise<void>
  signOut: () => Promise<void>
  /** إنهاء فوري (يُستدعى من عميل API عند فشل تجديد التوكن). */
  forceSignOut: () => void
}

const MOBILE_ROLES: Role[] = ['ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'STOCK_KEEPER']

/** المسار الرئيسي لكل دور — يستخدمه index.tsx وحُرّاس المجموعات. */
export function homePathForRole(role: Role): string {
  switch (role) {
    case 'CASHIER':
      return '/(cashier)/sell'
    case 'STOCK_KEEPER':
      return '/(stock)/inventory'
    default:
      return '/(admin)/dashboard'
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  user: null,
  features: {},

  signIn: async (email, password) => {
    const data = await login(email.trim(), password)
    const role = data.user.role as Role
    if (!MOBILE_ROLES.includes(role) || !data.refreshToken) {
      // SUPER_ADMIN يُرفض خادميًا برسالة عربية؛ هذا احتياط لأي حالة أخرى
      throw new ApiError(403, 'هذا الحساب لا يدعم تطبيق الهاتف')
    }
    await setTokens(data.accessToken, data.refreshToken)
    const me = await fetchMe()
    if (!me.user) {
      await clearTokens()
      throw new ApiError(401, 'تعذر التحقق من الجلسة، حاول مجددًا')
    }
    set({
      status: 'signedIn',
      user: {
        id: me.user.id,
        role: me.user.role,
        tenantId: me.user.tenantId,
        branchId: me.user.branchId ?? null,
        username: data.user.username ?? null,
        email: data.user.email,
        tenantName: data.tenant?.name,
      },
      features: me.features ?? {},
    })
  },

  restore: async () => {
    try {
      const { accessToken, refreshToken } = await getTokens()
      if (!accessToken && !refreshToken) {
        set({ status: 'signedOut', user: null, features: {} })
        return
      }
      const me = await fetchMe()
      if (!me.user || !MOBILE_ROLES.includes(me.user.role)) {
        await clearTokens()
        set({ status: 'signedOut', user: null, features: {} })
        return
      }
      set({
        status: 'signedIn',
        user: {
          id: me.user.id,
          role: me.user.role,
          tenantId: me.user.tenantId,
          branchId: me.user.branchId ?? null,
          // نحافظ على بيانات العرض السابقة إن وُجدت (الاسم لا يعود من /me)
          username: get().user?.username ?? null,
          email: get().user?.email ?? null,
          tenantName: get().user?.tenantName,
        },
        features: me.features ?? {},
      })
    } catch (err) {
      // فشل شبكة أثناء الإقلاع: لا نمسح التوكنات — نسمح بالمحاولة عند أول طلب
      if (err instanceof ApiError && err.status === 0) {
        const { refreshToken } = await getTokens()
        set(refreshToken ? { status: 'signedOut' } : { status: 'signedOut', user: null })
        return
      }
      set({ status: 'signedOut', user: null, features: {} })
    }
  },

  refreshFeatures: async () => {
    if (get().status !== 'signedIn') return
    try {
      const me = await fetchMe()
      if (me.user) {
        set(state => ({
          features: me.features ?? {},
          user: state.user ? { ...state.user, role: me.user!.role, branchId: me.user!.branchId ?? null } : state.user,
        }))
      }
    } catch {
      // صامت — تحديث الميزات ليس حرجًا
    }
  },

  signOut: async () => {
    await clearTokens()
    queryClient.clear()
    set({ status: 'signedOut', user: null, features: {} })
  },

  forceSignOut: () => {
    queryClient.clear()
    set({ status: 'signedOut', user: null, features: {} })
  },
}))

// ربط انتهاء الجلسة من عميل الـ API بالمخزن (مرة واحدة عند تحميل الوحدة)
setSessionExpiredHandler(() => useAuthStore.getState().forceSignOut())
