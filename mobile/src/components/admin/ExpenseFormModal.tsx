import { useEffect, useState } from 'react'
import {
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
import { format } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { createExpense, updateExpense, type ExpenseRow } from '@/api/endpoints/expenses'
import { appAlert } from '@/components/AppAlert'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

const t = {
  addTitle: 'إضافة مصروف',
  editTitle: 'تعديل مصروف',
  title: 'العنوان',
  titlePlaceholder: 'مثال: فاتورة كهرباء',
  amount: 'المبلغ',
  amountPlaceholder: '0',
  category: 'التصنيف',
  categoryPlaceholder: 'اختياري — اختر أو اكتب تصنيفًا',
  description: 'الوصف',
  descriptionPlaceholder: 'اختياري — تفاصيل إضافية',
  date: 'التاريخ',
  datePlaceholder: 'YYYY-MM-DD',
  dateHint: 'اتركه فارغًا لاستخدام تاريخ اليوم — أدخل أرقامًا فقط (سنة-شهر-يوم)',
  save: 'حفظ',
  saving: 'جارٍ الحفظ…',
  createdOk: 'تمت إضافة المصروف',
  updatedOk: 'تم تعديل المصروف',
  done: 'تم',
  errTitle: 'العنوان مطلوب',
  errAmount: 'أدخل مبلغًا صحيحًا أكبر من صفر',
  errDate: 'صيغة التاريخ غير صحيحة — استخدم سنة-شهر-يوم (مثال: 2026-07-01)',
}

const PRESET_CATEGORIES = ['رواتب', 'إيجار', 'كهرباء', 'صيانة', 'أخرى'] as const

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

/** ISO أو أي تاريخ → YYYY-MM-DD (للتعبئة المسبقة عند التعديل). */
function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd')
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : ar.common.unexpectedError
}

interface ExpenseFormModalProps {
  visible: boolean
  /** عند تمريره تعمل النافذة بوضع التعديل مع تعبئة الحقول. */
  expense?: ExpenseRow | null
  /** فرع الإنشاء (مطبّع) — عند الغياب يستخدم الخادم فرع المستخدم. */
  branchId?: string | null
  onClose: () => void
}

/** نافذة إضافة/تعديل مصروف — نموذج واحد يعمل للحالتين حسب وجود `expense`. */
export function ExpenseFormModal({ visible, expense, branchId, onClose }: ExpenseFormModalProps) {
  const isEdit = !!expense
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  // إعادة ضبط الحقول عند الفتح (تعبئة مسبقة في وضع التعديل).
  useEffect(() => {
    if (!visible) return
    setTitle(expense?.title ?? '')
    setAmount(expense ? String(expense.amount ?? '') : '')
    setCategory(expense?.category ?? '')
    setDescription(expense?.description ?? '')
    setDate(toDateInput(expense?.date))
    setError(null)
  }, [visible, expense])

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        amount: Number(amount),
        category: category.trim() ? category.trim() : null,
        description: description.trim() ? description.trim() : null,
        date: date ? date : null,
      }
      return expense
        ? updateExpense({ id: expense.id, ...payload })
        : createExpense({ ...payload, branchId })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['report-expenses'] })
      onClose()
      appAlert.success(t.done, isEdit ? t.updatedOk : t.createdOk)
    },
    onError: err => setError(errorMessage(err)),
  })

  const submit = () => {
    if (mutation.isPending) return // منع الإرسال المزدوج (single-flight)
    if (!title.trim()) {
      setError(t.errTitle)
      return
    }
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) {
      setError(t.errAmount)
      return
    }
    if (date && !isValidDate(date)) {
      setError(t.errDate)
      return
    }
    setError(null)
    mutation.mutate()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{isEdit ? t.editTitle : t.addTitle}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* العنوان (مطلوب) */}
            <View style={styles.field}>
              <Text style={styles.label}>{t.title}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t.titlePlaceholder}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* المبلغ (مطلوب، رقمي) */}
            <View style={styles.field}>
              <Text style={styles.label}>
                {t.amount} <Text style={styles.currency}>({ar.common.currency})</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.inputNumeric]}
                value={amount}
                onChangeText={v => setAmount(v.replace(/[^\d.]/g, ''))}
                keyboardType="number-pad"
                placeholder={t.amountPlaceholder}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* التصنيف (اختياري) — شرائح جاهزة + إدخال حر */}
            <View style={styles.field}>
              <Text style={styles.label}>{t.category}</Text>
              <View style={styles.chipsRow}>
                {PRESET_CATEGORIES.map(c => {
                  const active = category.trim() === c
                  return (
                    <Pressable
                      key={c}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCategory(active ? '' : c)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder={t.categoryPlaceholder}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* الوصف (اختياري، متعدد الأسطر) */}
            <View style={styles.field}>
              <Text style={styles.label}>{t.description}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder={t.descriptionPlaceholder}
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* التاريخ (اختياري، مقنّع) */}
            <View style={styles.field}>
              <Text style={styles.label}>{t.date}</Text>
              <TextInput
                style={[styles.input, styles.inputDate]}
                value={date}
                onChangeText={v => setDate(maskDate(v))}
                keyboardType="number-pad"
                maxLength={10}
                placeholder={t.datePlaceholder}
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.hint}>{t.dateHint}</Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{ar.common.cancel}</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, mutation.isPending && styles.saveBtnDisabled]}
              onPress={submit}
              disabled={mutation.isPending}
            >
              <Text style={styles.saveText}>{mutation.isPending ? t.saving : t.save}</Text>
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
  cardTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'right' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollBody: { gap: spacing.md, paddingBottom: spacing.xs },
  field: { gap: spacing.xs },
  label: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, textAlign: 'right' },
  currency: { color: colors.textMuted, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'right',
    backgroundColor: colors.background,
  },
  inputNumeric: { textAlign: 'right', writingDirection: 'ltr' },
  inputDate: { textAlign: 'center', writingDirection: 'ltr' },
  inputMultiline: { minHeight: 76, paddingTop: spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.button },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
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
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm },
  saveBtn: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...shadow.button,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.sm },
})
