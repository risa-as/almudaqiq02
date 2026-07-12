import { QueryClient } from '@tanstack/react-query'

/**
 * أرقام المال والمخزون يجب أن تطابق الويب دائمًا (SC-004) — لذلك staleTime
 * الافتراضي صفر، والشاشات المرجعية (موردون/فروع) ترفعه محليًا عند الحاجة.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
})
