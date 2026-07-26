import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { paySupplier } from '@/api/endpoints/suppliersAdmin'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { formatMoney } from '@/utils/format'

const t = {
  title: 'تسديد دفعة',
  supplier: 'المورد',
  currentDue: 'المستحق الحالي',
  amount: 'مبلغ التسديد',
  amountPlaceholder: '0',
  amountRequired: 'أدخل مبلغًا صحيحًا أكبر من صفر',
  payFull: 'تسديد كامل المستحق',
  remaining: 'المتبقي بعد التسديد',
  note: 'ملاحظة',
  notePlaceholder: 'اختياري — مثل رقم الوصل أو وسيلة الدفع',
  submit: 'تأكيد التسديد',
  overpayHint: 'المبلغ يفوق المستحق — سيتحوّل الفائض إلى رصيد لصالحنا.',
}

/** حدّ تسامح صغير لتفادي أخطاء الكسور العشرية عند مقارنة الرصيد بالصفر. */
const EPS = 0.004

interface PaySupplierTarget {
  id: string
  name: string
  /** الرصيد الحالي (موجب = مستحق علينا للمورد). */
  balance: number
}

interface SupplierPaymentModalProps {
  visible: boolean
  supplier: PaySupplierTarget | null
  /** الفرع المُختار حاليًا — تُسجَّل عليه الحركة الدفترية. */
  branchId: string | null
  onClose: () => void
  /** يُستدعى بعد نجاح التسديد — على الأب إبطال الاستعلامات وإظهار التأكيد. */
  onPaid: () => void
}

/**
 * نافذة تسجيل تسديد دفعة لمورد: مبلغ + ملاحظة، مع اختصار «تسديد كامل المستحق».
 *
 * ملاحظة: الحالة الداخلية تُصفَّر بإعادة التركيب عبر `key` من الأب (مفتاح المورد)،
 * لا عبر useEffect — فلا تبقى قيم دفعة سابقة عند فتح مورد آخر.
 */
export function SupplierPaymentModal({
  visible,
  supplier,
  branchId,
  onClose,
  onPaid,
}: SupplierPaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const due = supplier?.balance ?? 0
  const parsed = Number(amount)
  const amountValid = Number.isFinite(parsed) && parsed > 0
  const remaining = useMemo(() => (amountValid ? due - parsed : due), [amountValid, due, parsed])
  const overpaying = amountValid && parsed > due + EPS

  const mutation = useMutation({
    mutationFn: () =>
      paySupplier(supplier!.id, { amount: parsed, description: note, branchId }),
    onSuccess: () => {
      onPaid()
      onClose()
    },
    onError: err => {
      setApiError(err instanceof ApiError ? err.message : ar.common.unexpectedError)
    },
  })

  const submit = () => {
    if (mutation.isPending || !supplier) return
    if (!amountValid) {
      setAmountError(t.amountRequired)
      return
    }
    setAmountError(null)
    setApiError(null)
    mutation.mutate()
  }

  const fillFull = () => {
    if (due <= EPS) return
    setAmount(String(due))
    setAmountError(null)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerIcon}>
                <Ionicons name="cash-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>{t.title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            {/* ملخص المورد والمستحق الحالي */}
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t.supplier}</Text>
                <Text style={styles.summaryName} numberOfLines={1}>
                  {supplier?.name ?? '—'}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t.currentDue}</Text>
                <Text style={styles.summaryDue}>
                  {formatMoney(due)} <Text style={styles.summaryCurrency}>{ar.common.currency}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.field}>
              <View style={styles.fieldHeader}>
                <Text style={styles.label}>{t.amount}</Text>
                {due > EPS ? (
                  <Pressable onPress={fillFull} hitSlop={6}>
                    <Text style={styles.payFull}>{t.payFull}</Text>
                  </Pressable>
                ) : null}
              </View>
              <TextInput
                style={[styles.input, styles.amountInput, amountError ? styles.inputError : null]}
                value={amount}
                onChangeText={v => {
                  setAmount(v)
                  if (amountError) setAmountError(null)
                }}
                keyboardType="numeric"
                placeholder={t.amountPlaceholder}
                placeholderTextColor={colors.textMuted}
              />
              {amountError ? <Text style={styles.fieldError}>{amountError}</Text> : null}
              {overpaying ? <Text style={styles.hint}>{t.overpayHint}</Text> : null}
              {amountValid && !overpaying && due > EPS ? (
                <View style={styles.remainingRow}>
                  <Text style={styles.remainingLabel}>{t.remaining}</Text>
                  <Text style={styles.remainingValue}>
                    {formatMoney(Math.max(0, remaining))} {ar.common.currency}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t.note}</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={note}
                onChangeText={setNote}
                placeholder={t.notePlaceholder}
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

            {apiError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.errorText}>{apiError}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{ar.common.cancel}</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, (mutation.isPending || !amountValid) && styles.disabled]}
              onPress={submit}
              disabled={mutation.isPending || !amountValid}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={17} color={colors.onPrimary} />
                  <Text style={styles.submitText}>{t.submit}</Text>
                </>
              )}
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
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.elevated,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'right' },
  scroll: { flexGrow: 0, flexShrink: 1 },

  // ── ملخص المورد ──
  summary: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  summaryName: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'left' },
  summaryDue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.danger },
  summaryCurrency: { fontSize: fontSize.xs, fontWeight: '700', color: colors.danger },

  field: { gap: spacing.xs, marginBottom: spacing.md },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, textAlign: 'right' },
  payFull: { fontSize: fontSize.xs, fontWeight: '800', color: colors.primary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: control.inputHeight,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'right',
    backgroundColor: colors.background,
  },
  amountInput: { fontSize: fontSize.lg, fontWeight: '800' },
  inputError: { borderColor: colors.danger },
  multiline: { height: 72, paddingTop: spacing.sm, textAlignVertical: 'top' },
  fieldError: { fontSize: fontSize.xs, color: colors.danger, textAlign: 'right' },
  hint: { fontSize: fontSize.xs, color: colors.warning, textAlign: 'right', lineHeight: 18 },
  remainingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  remainingLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  remainingValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSize.xs, textAlign: 'right', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    height: control.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.md },
  submitBtn: {
    flex: 1.4,
    flexDirection: 'row',
    gap: spacing.xs,
    height: control.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.button,
  },
  submitText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },
  disabled: { opacity: 0.5 },
})
