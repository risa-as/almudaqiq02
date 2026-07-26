import { memo } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import type { StocktakeItem } from '@/api/endpoints/stocktake'
import { ar } from '@/i18n/ar'
import { formatMoney } from '@/utils/format'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { ROW } from '@/utils/rtl'

/** لون الفرق: صفر أخضر / نقص أحمر / زيادة كهرماني */
export function diffColor(diff: number): string {
  if (diff === 0) return colors.success
  return diff < 0 ? colors.danger : colors.warning
}

/** خلفية ناعمة مطابقة للون الفرق */
export function diffSoft(diff: number): string {
  if (diff === 0) return colors.successSoft
  return diff < 0 ? colors.dangerSoft : colors.warningSoft
}

interface StocktakeCountRowProps {
  item: StocktakeItem
  /** نص الحقل لهذا البند فقط — '' يعني لم يُعدّ بعد */
  value: string
  editable: boolean
  onChange: (itemId: string, text: string) => void
}

/**
 * صفّ ورقة الجرد: الاسم والسعر ↔ المسجّل ↔ حقل المعدود ↔ الفرق.
 *
 * الأداء: مغلّف بـ memo ويستقبل قيمته وحدها، فالكتابة في صفّ واحد لا تعيد رسم
 * بقية الصفوف. لا تمرّر إليه دوال سهمية مضمّنة وإلا بطل أثر memo.
 */
export const StocktakeCountRow = memo(function StocktakeCountRow({
  item,
  value,
  editable,
  onChange,
}: StocktakeCountRowProps) {
  // '' = غير معدود؛ '0' عدّة حقيقية (رفّ فارغ) ولها فرق سالب
  const counted = value === '' ? null : Number(value)
  const diff = counted === null ? null : counted - item.expectedQty

  return (
    <View style={[styles.row, counted !== null && styles.rowCounted]}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.productName}</Text>
        <Text style={styles.price}>{formatMoney(item.unitPrice)} {ar.common.currency}</Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.cellLabel}>المسجّل</Text>
        <Text style={styles.expected}>{formatMoney(item.expectedQty)}</Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.cellLabel}>المعدود</Text>
        <TextInput
          style={[styles.input, !editable && styles.inputDisabled]}
          value={value}
          onChangeText={text => onChange(item.id, text)}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.textMuted}
          textAlign="center"
          editable={editable}
          selectTextOnFocus
        />
      </View>

      <View style={styles.cell}>
        <Text style={styles.cellLabel}>الفرق</Text>
        {diff === null ? (
          <Text style={styles.noDiff}>—</Text>
        ) : (
          <View style={[styles.diffPill, { backgroundColor: diffSoft(diff) }]}>
            <Text style={[styles.diffText, { color: diffColor(diff) }]}>
              {diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff)}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadow.card,
  },
  rowCounted: { borderColor: colors.primary },
  info: { flex: 1, alignItems: 'flex-end', gap: 2 },
  name: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700', textAlign: 'right' },
  price: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '600' },
  cell: { width: 58, alignItems: 'center', gap: 2 },
  cellLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  expected: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  input: {
    width: 54,
    height: 38,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 0,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  inputDisabled: { opacity: 0.6 },
  noDiff: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  diffPill: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    minWidth: 46,
    alignItems: 'center',
  },
  diffText: { fontSize: fontSize.xs, fontWeight: '800' },
})
