'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface Branch { id: string; name: string }

interface BranchContextValue {
  branches:         Branch[]
  selectedBranch:   Branch | null
  setSelectedBranch:(b: Branch) => void
  isOwner:          boolean
  loading:          boolean
  isSwitching:      boolean
}

const BranchContext = createContext<BranchContextValue>({
  branches: [], selectedBranch: null, setSelectedBranch: () => {}, isOwner: false, loading: true, isSwitching: false,
})

const CACHE_KEY_BRANCHES = 'branchCache_branches'
const CACHE_KEY_IS_OWNER = 'branchCache_isOwner'
const CACHE_KEY_SELECTED = 'selectedBranchId'

export function BranchProvider({ children }: { children: React.ReactNode }) {
  // Always start with empty state — identical on server and client (no hydration mismatch)
  const [branches,       setBranches]          = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranchState] = useState<Branch | null>(null)
  const [isOwner,        setIsOwner]            = useState(false)
  const [loading,        setLoading]            = useState(true)
  const [isSwitching,    setIsSwitching]        = useState(false)

  useEffect(() => {
    // Step 1: Restore from cache immediately (client-only, runs after hydration)
    try {
      const cachedBranches = JSON.parse(localStorage.getItem(CACHE_KEY_BRANCHES) ?? '[]') as Branch[]
      const cachedIsOwner  = localStorage.getItem(CACHE_KEY_IS_OWNER) === 'true'
      const cachedId       = localStorage.getItem(CACHE_KEY_SELECTED)

      if (cachedBranches.length > 0) {
        setBranches(cachedBranches)
        setIsOwner(cachedIsOwner)
        let restored: Branch | null
        if (cachedBranches.length === 1)  restored = cachedBranches[0]
        else if (cachedId === 'all')      restored = { id: 'all', name: 'جميع الفروع' }
        else                              restored = cachedBranches.find(b => b.id === cachedId) ?? cachedBranches[0]
        setSelectedBranchState(restored ?? null)
      }
    } catch { /* ignore */ }

    // Step 2: Fetch fresh data from API
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).catch(() => ({ user: null })),
      fetch('/api/branches').then(r => r.json()).catch(() => []),
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

      const savedId = localStorage.getItem(CACHE_KEY_SELECTED)
      let saved: Branch | null
      if (list.length === 1)      saved = list[0]
      else if (savedId === 'all') saved = { id: 'all', name: 'جميع الفروع' }
      else                        saved = list.find(b => b.id === savedId) ?? list[0] ?? null
      setSelectedBranchState(saved)
    }).finally(() => setLoading(false))
  }, [])

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
