import { format } from 'date-fns'

/** تنسيق مبلغ مالي بأرقام لاتينية مع فواصل الآلاف (متوافق مع عرض الويب). */
export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** تاريخ قصير: 2026/07/11 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'yyyy/MM/dd')
}

/** وقت فقط: 14:05 */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'HH:mm')
}

/** تاريخ + وقت: 2026/07/11 14:05 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'yyyy/MM/dd HH:mm')
}
