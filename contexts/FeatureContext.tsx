'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authMeQueryOptions } from '@/lib/query/auth-me'
import { hasFeature as hasFeatureFn, type FeatureKey, type FeatureMap } from '@/lib/features'

interface FeatureContextValue {
  features: FeatureMap
  hasFeature: (key: FeatureKey) => boolean
  loading: boolean
  /** True once features are known (from cache or network) — safe to gate on. */
  ready: boolean
}

const FeatureContext = createContext<FeatureContextValue>({
  features: {},
  hasFeature: () => false,
  loading: true,
  ready: false,
})

const CACHE_KEY = 'planFeaturesCache'

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  // Start empty for identical server/client render (no hydration mismatch).
  const [features, setFeatures] = useState<FeatureMap>({})
  const [loading, setLoading]   = useState(true)
  const [ready, setReady]       = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Step 1: hydrate from cache immediately. If we have it, we can gate right
    // away (mark ready) without waiting for the network — no 7s spinner.
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        setFeatures(JSON.parse(cached) as FeatureMap)
        setReady(true)
      }
    } catch { /* ignore */ }

    // Step 2: refresh from the canonical "who am I" endpoint in the background.
    // يمرّ عبر كاش React Query بمفتاح ['auth','me'] فيُدمج مع طلب BranchContext
    // وuseUser في رحلة شبكة واحدة بدل ثلاث.
    queryClient.fetchQuery(authMeQueryOptions)
      .then(data => {
        const f: FeatureMap = data?.features ?? {}
        setFeatures(f)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(f)) } catch { /* ignore */ }
      })
      .catch(() => { /* keep cached/empty */ })
      .finally(() => { setReady(true); setLoading(false) })
  }, [queryClient])

  return (
    <FeatureContext.Provider value={{ features, hasFeature: (k) => hasFeatureFn(features, k), loading, ready }}>
      {children}
    </FeatureContext.Provider>
  )
}

export function useFeatures() {
  return useContext(FeatureContext)
}
