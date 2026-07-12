import { create } from 'zustand'

/**
 * حالة الاتصال بالخادم — تُضبط من مسار خطأ الشبكة في src/api/client.ts:
 * أي طلب يفشل بـ ApiError(status 0) → offline، وأي استجابة ناجحة → online.
 * تستهلكها لافتة OfflineBanner أعلى التطبيق (T047).
 */
interface NetworkState {
  isOffline: boolean
  setOffline: (offline: boolean) => void
}

export const useNetworkStore = create<NetworkState>(set => ({
  isOffline: false,
  setOffline: offline => set(state => (state.isOffline === offline ? state : { isOffline: offline })),
}))
