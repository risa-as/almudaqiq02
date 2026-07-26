import { useState } from 'react'
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
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import {
  createSupplier,
  fetchSupplier,
  updateSupplier,
  type AdminSupplier,
} from '@/api/endpoints/suppliersAdmin'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'

const t = {
  addTitle: 'إضافة مورد',
  editTitle: 'تعديل المورد',
  name: 'اسم المورد',
  namePlaceholder: 'الاسم التجاري للمورد',
  nameRequired: 'اسم المورد مطلوب',
  phone: 'رقم الهاتف',
  phonePlaceholder: 'اختياري',
  creditLimit: 'حد الائتمان',
  creditPlaceholder: 'اختياري',
  address: 'العنوان',
  addressPlaceholder: 'اختياري',
  notes: 'ملاحظات',
  notesPlaceholder: 'اختياري',
  openingBalance: 'رصيد افتتاحي',
  openingHint: 'موجب = مستحق للمورد علينا • يُسجَّل حركة دفترية عند الحفظ',
  create: 'إضافة',
  saveEdit: 'حفظ التعديل',
  loadError: 'تعذر تحميل بيانات المورد',
}

/** القيم الأوّلية لحقول النموذج (نصوص — كما تُعرض في الإدخال). */
interface FormInitial {
  name: string
  phone: string
  creditLimit: string
  address: string
  notes: string
}

const EMPTY: FormInitial = { name: '', phone: '', creditLimit: '', address: '', notes: '' }

function toInitial(s: AdminSupplier): FormInitial {
  return {
    name: s.name ?? '',
    phone: s.phone ?? '',
    creditLimit: s.creditLimit === null || s.creditLimit === undefined ? '' : String(s.creditLimit),
    address: s.address ?? '',
    notes: s.notes ?? '',
  }
}

interface SupplierFormProps {
  /** وجود المعرّف ⇐ وضع التعديل؛ غيابه ⇐ وضع الإضافة. */
  supplierId?: string | null
  initial: FormInitial
  onClose: () => void
  onSaved: (mode: 'create' | 'edit') => void
}

/**
 * حقول النموذج وأزراره. لا يُركَّب إلا بعد جهوز القيم الأوّلية، فتُهيَّأ الحالة منها
 * مباشرةً عبر useState — دون useEffect للتعبئة أو للتصفير.
 */
function SupplierForm({ supplierId, initial, onClose, onSaved }: SupplierFormProps) {
  const isEdit = !!supplierId

  const [name, setName] = useState(initial.name)
  const [phone, setPhone] = useState(initial.phone)
  const [creditLimit, setCreditLimit] = useState(initial.creditLimit)
  const [address, setAddress] = useState(initial.address)
  const [notes, setNotes] = useState(initial.notes)
  const [balance, setBalance] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return updateSupplier(supplierId as string, { name, phone, address, creditLimit, notes })
      }
      return createSupplier({ name, phone, address, creditLimit, notes, balance })
    },
    onSuccess: () => {
      onSaved(isEdit ? 'edit' : 'create')
      onClose()
    },
    onError: err => {
      setApiError(err instanceof ApiError ? err.message : ar.common.unexpectedError)
    },
  })

  const submit = () => {
    if (mutation.isPending) return
    if (!name.trim()) {
      setNameError(t.nameRequired)
      return
    }
    setNameError(null)
    setApiError(null)
    mutation.mutate()
  }

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
        <View style={styles.field}>
          <Text style={styles.label}>{t.name}</Text>
          <TextInput
            style={[styles.input, nameError ? styles.inputError : null]}
            value={name}
            onChangeText={v => {
              setName(v)
              if (nameError) setNameError(null)
            }}
            placeholder={t.namePlaceholder}
            placeholderTextColor={colors.textMuted}
          />
          {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t.phone}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={t.phonePlaceholder}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t.creditLimit}</Text>
          <TextInput
            style={styles.input}
            value={creditLimit}
            onChangeText={setCreditLimit}
            keyboardType="numeric"
            placeholder={t.creditPlaceholder}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t.address}</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder={t.addressPlaceholder}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t.notes}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.notesPlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </View>

        {/* حقل الرصيد الافتتاحي يظهر عند الإضافة فقط — لا يُرسَل عند التعديل إطلاقًا. */}
        {!isEdit ? (
          <View style={styles.field}>
            <Text style={styles.label}>{t.openingBalance}</Text>
            <TextInput
              style={styles.input}
              value={balance}
              onChangeText={setBalance}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.hint}>{t.openingHint}</Text>
          </View>
        ) : null}

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
          style={[styles.submitBtn, mutation.isPending && styles.disabled]}
          onPress={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.submitText}>{isEdit ? t.saveEdit : t.create}</Text>
          )}
        </Pressable>
      </View>
    </>
  )
}

interface SupplierFormModalProps {
  visible: boolean
  /** وجود المعرّف ⇐ وضع التعديل؛ غيابه ⇐ وضع الإضافة. */
  supplierId?: string | null
  onClose: () => void
  /** يُستدعى بعد نجاح الحفظ — على الأب إبطال الاستعلامات وإظهار التأكيد. */
  onSaved: (mode: 'create' | 'edit') => void
}

/**
 * نموذج إضافة/تعديل مورد. الغلاف يتولّى جلب تفاصيل المورد ثم يُركّب النموذج
 * الداخلي بعد جهوز القيم — فلا حاجة لأي useEffect لتعبئة الحقول أو تصفيرها.
 */
export function SupplierFormModal({ visible, supplierId, onClose, onSaved }: SupplierFormModalProps) {
  const isEdit = !!supplierId

  // تفاصيل المورد لتعبئة نموذج التعديل. gcTime:0 ⇒ لا يبقى في الكاش بعد الإغلاق،
  // فكل فتح جلبٌ بارد بأحدث بيانات الخادم — يمنع تعبئة النموذج بقيم قديمة وإعادة إرسالها.
  // refetchOnWindowFocus:false يمنع الجلب أثناء الكتابة.
  const detailQ = useQuery({
    queryKey: ['supplier-detail', supplierId],
    queryFn: () => fetchSupplier(supplierId as string),
    enabled: visible && isEdit,
    refetchOnWindowFocus: false,
    gcTime: 0,
  })

  const loading = isEdit && detailQ.isPending
  const initial: FormInitial | null = isEdit
    ? detailQ.data
      ? toInitial(detailQ.data)
      : null
    : EMPTY

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{isEdit ? t.editTitle : t.addTitle}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {loading ? (
            <>
              <View style={styles.centerBox}>
                <ActivityIndicator color={colors.primary} />
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>{ar.common.cancel}</Text>
                </Pressable>
              </View>
            </>
          ) : !initial ? (
            <>
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.errorText}>{t.loadError}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>{ar.common.cancel}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <SupplierForm
              key={supplierId ?? 'new'}
              supplierId={supplierId}
              initial={initial}
              onClose={onClose}
              onSaved={onSaved}
            />
          )}
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
  centerBox: { paddingVertical: spacing.xl, alignItems: 'center' },
  field: { gap: spacing.xs, marginBottom: spacing.md },
  label: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, textAlign: 'right' },
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
  inputError: { borderColor: colors.danger },
  multiline: { height: 84, paddingTop: spacing.sm, textAlignVertical: 'top' },
  fieldError: { fontSize: fontSize.xs, color: colors.danger, textAlign: 'right' },
  hint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right', lineHeight: 18 },
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
    flex: 1,
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
