import { useEffect } from 'react'
import { create } from 'zustand'
import { fetchBranches } from '@/api/endpoints/branches'
import { useAuthStore } from '@/stores/auth'

/**
 * مخزن الفروع (واجهة المدير فقط) — data-model.md BranchState.
 *
 * قاعدة الفرع في كل نداءات المدير (تحاكي BranchContext في الويب):
 *  - ADMIN: يبدّل بحرية؛ الافتراضي "جميع الفروع" ('all') — وعند الإرسال للخادم
 *    نحذف بارامتر branchId كليًا (بعض المسارات لا تفهم القيمة 'all').
 *  - BRANCH_MANAGER: مثبّت على فرعه من التوكن، بلا واجهة تبديل إطلاقًا.
 *
 * كل استعلام React Query للمدير يجب أن يتضمن selectedBranchId في مفتاحه
 * حتى يُعاد الجلب عند تبديل الفرع (US4-AS2).
 */

export interface BranchOption {
  id: string
  name: string
}

/** قيمة "جميع الفروع" — تُحذف من الطلبات عبر normalizeBranchId. */
export const ALL_BRANCHES = 'all'

export const ALL_BRANCHES_LABEL = 'جميع الفروع'

interface BranchState {
  branches: BranchOption[]
  /** اختيار المدير المالك ('all' أو معرف فرع). مدير الفرع لا يقرأ هذه القيمة. */
  selectedBranchId: string | null
  loaded: boolean
  loading: boolean
  load: () => Promise<void>
  select: (id: string) => void
  reset: () => void
}

export const useBranchStore = create<BranchState>((set, get) => ({
  branches: [],
  selectedBranchId: ALL_BRANCHES,
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const rows = await fetchBranches()
      const branches: BranchOption[] = rows
        .filter(b => b.isActive !== false)
        .map(b => ({ id: b.id, name: b.name }))
      set(state => ({
        branches,
        loaded: true,
        // فرع واحد فقط → اختره مباشرة (كما يفعل BranchContext في الويب)؛
        // وإلا حافظ على اختيار صالح أو ارجع إلى "جميع الفروع".
        selectedBranchId:
          branches.length === 1
            ? branches[0].id
            : state.selectedBranchId === ALL_BRANCHES ||
                branches.some(b => b.id === state.selectedBranchId)
              ? state.selectedBranchId
              : ALL_BRANCHES,
      }))
    } catch {
      // صامت — تبقى الشاشات تعمل بوضع "جميع الفروع" ويعاد الجلب لاحقًا
    } finally {
      set({ loading: false })
    }
  },

  select: id => set({ selectedBranchId: id }),

  reset: () => set({ branches: [], selectedBranchId: ALL_BRANCHES, loaded: false, loading: false }),
}))

// تسجيل الخروج يمسح حالة الفروع (FR-005) — دون تعديل مخزن الجلسة نفسه.
useAuthStore.subscribe((state, prev) => {
  if (prev.status === 'signedIn' && state.status !== 'signedIn') {
    useBranchStore.getState().reset()
  }
})

/**
 * تطبيع بارامتر الفرع قبل إرساله للخادم: null أو 'all' → undefined (يُحذف من
 * الاستعلام). هذا ما تفعله صفحة لوحة تحكم الويب، وبعض المسارات (تقرير المبيعات،
 * التحويلات) لا تتعامل مع القيمة 'all' أصلًا.
 */
export function normalizeBranchId(id: string | null | undefined): string | undefined {
  return id && id !== ALL_BRANCHES ? id : undefined
}

export interface BranchSelection {
  branches: BranchOption[]
  /** القيمة التي تدخل مفاتيح الاستعلامات وتُمرَّر للنداءات ('all' | id | null). */
  selectedBranchId: string | null
  /** اسم الفرع المعروض حاليًا (أو "جميع الفروع"). */
  selectedBranchName: string
  /** ADMIN فقط يرى مبدّل الفروع (US4-AS3). */
  canSwitch: boolean
  select: (id: string) => void
}

/** الخطاف الموحّد لشاشات المدير: يحمّل الفروع مرة واحدة ويطبّق قاعدة التثبيت. */
export function useBranchSelection(): BranchSelection {
  const user = useAuthStore(s => s.user)
  const branches = useBranchStore(s => s.branches)
  const stored = useBranchStore(s => s.selectedBranchId)
  const loaded = useBranchStore(s => s.loaded)
  const loading = useBranchStore(s => s.loading)
  const load = useBranchStore(s => s.load)
  const select = useBranchStore(s => s.select)

  useEffect(() => {
    if (!loaded && !loading) void load()
  }, [loaded, loading, load])

  const canSwitch = user?.role === 'ADMIN'
  // مدير الفرع مثبّت على فرعه من التوكن — الخادم يفرض ذلك أيضًا (FR-014).
  const selectedBranchId = canSwitch ? stored : (user?.branchId ?? null)

  const selectedBranchName =
    !selectedBranchId || selectedBranchId === ALL_BRANCHES
      ? ALL_BRANCHES_LABEL
      : (branches.find(b => b.id === selectedBranchId)?.name ?? '—')

  return { branches, selectedBranchId, selectedBranchName, canSwitch, select }
}
