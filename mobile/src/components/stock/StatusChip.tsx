import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, radius, spacing } from '@/theme'

export interface ChipStyle {
  label: string
  tint: string
  soft: string
}

/** شارة حالة صغيرة ملوّنة (جلسات الجرد / أوامر الشراء / التحويلات). */
export function StatusChip({ label, tint, soft }: ChipStyle) {
  return (
    <View style={[styles.chip, { backgroundColor: soft }]}>
      <Text style={[styles.text, { color: tint }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: { fontSize: fontSize.xs, fontWeight: '700' },
})

// خرائط الحالات المشتركة بين شاشات أمين المخزن
export const STOCKTAKE_STATUS: Record<string, ChipStyle> = {
  DRAFT:     { label: 'جارٍ العد',  tint: colors.info,    soft: colors.infoSoft },
  COMPLETED: { label: 'معتمَد',     tint: colors.success, soft: colors.successSoft },
  CANCELLED: { label: 'ملغى',       tint: colors.danger,  soft: colors.dangerSoft },
}

export const ORDER_STATUS: Record<string, ChipStyle> = {
  DRAFT:     { label: 'مسودة',        tint: colors.textSecondary, soft: colors.border },
  ORDERED:   { label: 'بانتظار الاستلام', tint: colors.warning,   soft: colors.warningSoft },
  RECEIVED:  { label: 'مستلَم',        tint: colors.success,      soft: colors.successSoft },
  CANCELLED: { label: 'ملغى',          tint: colors.danger,       soft: colors.dangerSoft },
}

export const TRANSFER_STATUS: Record<string, ChipStyle> = {
  PENDING:   { label: 'بانتظار الموافقة', tint: colors.warning,  soft: colors.warningSoft },
  APPROVED:  { label: 'معتمَد',           tint: colors.info,     soft: colors.infoSoft },
  COMPLETED: { label: 'مكتمل',            tint: colors.success,  soft: colors.successSoft },
  CANCELLED: { label: 'ملغى',             tint: colors.danger,   soft: colors.dangerSoft },
}

export function chipFor(map: Record<string, ChipStyle>, status: string): ChipStyle {
  return map[status] ?? { label: status, tint: colors.textSecondary, soft: colors.border }
}
