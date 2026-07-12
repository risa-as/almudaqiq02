import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { DateRange } from '@/api/endpoints/reports'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

const t = {
  modalTitle: 'تحديد فترة مخصصة',
  from: 'من تاريخ',
  to: 'إلى تاريخ',
  placeholder: 'YYYY-MM-DD',
  hint: 'أدخل التاريخ أرقامًا فقط — تُضاف الشرطات تلقائيًا (سنة-شهر-يوم)',
  apply: 'تطبيق',
  invalidFormat: 'صيغة التاريخ غير صحيحة — استخدم سنة-شهر-يوم (مثال: 2026-07-01)',
  reversedRange: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
}

/** يقيّد الإدخال بأرقام فقط ويُدرج الشرطات تلقائيًا: 20260701 → 2026-07-01 */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

/** يتحقق أن النص تاريخ ميلادي فعلي بصيغة YYYY-MM-DD (يرفض 2026-02-31 مثلًا). */
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

interface DateRangeModalProps {
  visible: boolean
  initial: DateRange | null
  onApply: (range: DateRange) => void
  onClose: () => void
}

/** نافذة إدخال فترة مخصصة (من → إلى) بحقول رقمية مقنّعة وتحقق كامل ورسائل عربية. */
export function DateRangeModal({ visible, initial, onApply, onClose }: DateRangeModalProps) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setStart(initial?.startDate ?? '')
      setEnd(initial?.endDate ?? '')
      setError(null)
    }
  }, [visible, initial])

  const apply = () => {
    if (!isValidDate(start) || !isValidDate(end)) {
      setError(t.invalidFormat)
      return
    }
    if (start > end) {
      setError(t.reversedRange)
      return
    }
    setError(null)
    onApply({ startDate: start, endDate: end })
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t.modalTitle}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.fieldsRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t.from}</Text>
              <TextInput
                style={styles.input}
                value={start}
                onChangeText={v => setStart(maskDate(v))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder={t.placeholder}
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t.to}</Text>
              <TextInput
                style={styles.input}
                value={end}
                onChangeText={v => setEnd(maskDate(v))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder={t.placeholder}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <Text style={styles.hint}>{t.hint}</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{ar.common.cancel}</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={apply}>
              <Text style={styles.applyText}>{t.apply}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.elevated,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, textAlign: 'right' },
  fieldsRow: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1, gap: spacing.xs },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'center',
    backgroundColor: colors.background,
    writingDirection: 'ltr',
  },
  hint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right', lineHeight: 18 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSize.xs, textAlign: 'right', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm },
  applyBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadow.button,
  },
  applyText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.sm },
})
