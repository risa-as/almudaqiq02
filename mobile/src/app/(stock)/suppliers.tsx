import { SuppliersView } from '@/components/SuppliersView'
import { useAuthStore } from '@/stores/auth'

/**
 * «الموردون» لأمين المخزن — الشاشة نفسها المشتركة مع المدير، لكن الفرع مثبّت على
 * فرع المستخدم فتكون الأرصدة مقصورة عليه.
 */
export default function SuppliersScreen() {
  const branchId = useAuthStore(s => s.user?.branchId ?? null)

  return <SuppliersView branchId={branchId} />
}
