'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authMeQueryOptions } from '@/lib/query/auth-me'

interface Branch { id: string; name: string }

interface BranchContextValue {
  branches:         Branch[]
  selectedBranch:   Branch | null
  setSelectedBranch:(b: Branch) => void
  isOwner:          boolean
  /**
   * true فقط ريثما لا نعرف الفرع بعد. يصير false فورًا عند استرجاع الكاش
   * المحلي — الصفحات تنتظر هذه القيمة لتبدأ استعلاماتها المرتبطة بالفرع،
   * فإبقاؤها true حتى ردّ الشبكة كان يخلق شلالًا:
   * (auth/me + branches) ← ثم ← (products). صار الاثنان متوازيين.
   */
  loading:          boolean
  isSwitching:      boolean
}

const BranchContext = createContext<BranchContextValue>({
  branches: [], selectedBranch: null, setSelectedBranch: () => {}, isOwner: false, loading: true, isSwitching: false,
})

const CACHE_KEY_BRANCHES = 'branchCache_branches'
const CACHE_KEY_IS_OWNER = 'branchCache_isOwner'
const CACHE_KEY_SELECTED = 'selectedBranchId'

/** يختار الفرع المعروض من قائمة + المعرّف المحفوظ (منطق واحد للكاش والشبكة). */
function pickBranch(list: Branch[], savedId: string | null): Branch | null {
  if (list.length === 1)      return list[0]
  if (savedId === 'all')      return { id: 'all', name: 'جميع الفروع' }
  return list.find(b => b.id === savedId) ?? list[0] ?? null
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  // Always start with empty state — identical on server and client (no hydration mismatch)
  const [branches,       setBranches]          = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranchState] = useState<Branch | null>(null)
  const [isOwner,        setIsOwner]            = useState(false)
  const [loading,        setLoading]            = useState(true)
  const [isSwitching,    setIsSwitching]        = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Step 1: Restore from cache immediately (client-only, runs after hydration)
    try {
      const cachedBranches = JSON.parse(localStorage.getItem(CACHE_KEY_BRANCHES) ?? '[]') as Branch[]
      const cachedIsOwner  = localStorage.getItem(CACHE_KEY_IS_OWNER) === 'true'
      const cachedId       = localStorage.getItem(CACHE_KEY_SELECTED)

      if (cachedBranches.length > 0) {
        setBranches(cachedBranches)
        setIsOwner(cachedIsOwner)
        setSelectedBranchState(pickBranch(cachedBranches, cachedId))
        // نعرف الفرع الآن ⇒ الصفحات تبدأ استعلاماتها في هذه الدورة نفسها
        // بدل انتظار رحلتَي شبكة. الشبكة أدناه تُصحِّح إن تغيّرت الفروع.
        setLoading(false)
      }
    } catch { /* ignore */ }

    // Step 2: Fetch fresh data from API.
    // ملاحظة: /api/auth/me يمرّ عبر كاش React Query بمفتاح ['auth','me'] فيُدمج
    // مع طلب useUser وFeatureContext في طلب واحد بدل ثلاثة.
    Promise.all([
      queryClient.fetchQuery(authMeQueryOptions).catch(() => ({ user: null })),
      // عبر كاش React Query لا fetch مباشر: قياس Resource Timing على بناء
      // الإنتاج أظهر طلبَي /api/branches متتاليين (المزوّد يُركَّب مرتين، وطلبات
      // React Query تُدمج تلقائيًا بينما fetch الخام لا يُدمج). fetchQuery
      // يجعل الطلب واحدًا ويشاركه مع صفحة الفروع.
      queryClient
        .fetchQuery({
          queryKey: ['branches'],
          queryFn: () => fetch('/api/branches').then(r => r.json()),
          staleTime: 5 * 60 * 1000,
        })
        .catch(() => []),
    ]).then(([meData, branchData]) => {
      const role  = meData?.user?.role ?? ''
      const owner = role === 'ADMIN' || role === 'SUPER_ADMIN'
      setIsOwner(owner)
      localStorage.setItem(CACHE_KEY_IS_OWNER, String(owner))

      const list: Branch[] = Array.isArray(branchData)
        ? branchData
            .filter((b: { isActive?: boolean }) => b.isActive !== false)
            .map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))
        : []
      setBranches(list)
      localStorage.setItem(CACHE_KEY_BRANCHES, JSON.stringify(list))

      setSelectedBranchState(pickBranch(list, localStorage.getItem(CACHE_KEY_SELECTED)))
    }).finally(() => setLoading(false))
  }, [queryClient])

  const setSelectedBranch = useCallback((b: Branch) => {
    setSelectedBranchState(b)
    localStorage.setItem(CACHE_KEY_SELECTED, b.id)
    setIsSwitching(true)
    setTimeout(() => setIsSwitching(false), 600)
  }, [])

  return (
    <BranchContext.Provider value={{ branches, selectedBranch, setSelectedBranch, isOwner, loading, isSwitching }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  return useContext(BranchContext)
}
