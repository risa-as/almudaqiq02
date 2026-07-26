import { SuppliersView, SUPPLIERS_SUBTITLE } from '@/components/SuppliersView'
import { useBranchSelection } from '@/stores/branch'

/**
 * «الموردون» للمدير — الشاشة نفسها المشتركة مع أمين المخزن، والفرق الوحيد أن
 * المدير يختار الفرع (وقد يكون «جميع الفروع» فيكون الرصيد عامًّا).
 */
export default function PayablesReportScreen() {
  const { selectedBranchId, selectedBranchName } = useBranchSelection()

  return (
    <SuppliersView
      branchId={selectedBranchId}
      subtitle={`${SUPPLIERS_SUBTITLE} — ${selectedBranchName}`}
    />
  )
}
