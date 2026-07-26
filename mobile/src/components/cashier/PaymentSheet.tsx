import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { createCustomer, customersKey, fetchCustomers, type CustomerDto } from '@/api/endpoints/customers'
import { ApiError } from '@/api/client'
import { useCartStore, type CartPaymentMethod } from '@/stores/cart'
import { formatMoney } from '@/utils/format'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'

// نصوص خاصة بورقة الدفع
const t = {
  title: 'إتمام الدفع',
  total: 'الإجمالي المطلوب',
  method: 'طريقة الدفع',
  cash: 'نقدي',
  card: 'شبكة',
  credit: 'آجل',
  received: 'المبلغ المستلم (اختياري لحساب الباقي)',
  change: 'الباقي',
  customer: 'العميل (إلزامي للبيع الآجل)',
  customerSearch: 'ابحث بالاسم أو الهاتف…',
  customerBalance: 'الرصيد',
  customerLimit: 'حد الدين',
  noLimit: 'بلا حد',
  changeCustomer: 'تغيير العميل',
  needCustomer: 'يجب اختيار عميل لتسجيل بيع آجل',
  confirm: 'تأكيد الدفع',
  submitting: 'جارٍ تسجيل الفاتورة…',
  verifying: 'جارٍ التحقق من فواتير الوردية…',
  noCustomers: 'لا يوجد عملاء مطابقون',
  addCustomer: 'إضافة عميل جديد',
  newCustomerName: 'اسم العميل',
  newCustomerPhone: 'رقم الهاتف (اختياري)',
  saveCustomer: 'حفظ واختيار العميل',
  customerNameRequired: 'أدخل اسم العميل',
}

const DEBOUNCE_MS = 300

const METHODS: { key: CartPaymentMethod; label: string; icon: 'cash-outline' | 'card-outline' | 'time-outline' }[] = [
  { key: 'CASH', label: t.cash, icon: 'cash-outline' },
  { key: 'CARD', label: t.card, icon: 'card-outline' },
  { key: 'CREDIT', label: t.credit, icon: 'time-outline' },
]

interface PaymentSheetProps {
  visible: boolean
  onClose: () => void
  total: number
  branchId?: string | null
  /** رسالة خطأ من محاولة الدفع السابقة (تبقى السلة كما هي) */
  error: string | null
  /** جارٍ إعادة جلب فواتير الوردية بعد فشل غامض — يمنع إعادة المحاولة مؤقتًا */
  verifying: boolean
  /** receivedAmount: المبلغ المستلم نقدًا (لحساب الباقي في الإيصال) أو null */
  onConfirm: (receivedAmount: number | null) => void
}

/**
 * ورقة الدفع: نقدي/شبكة/آجل. البيع الآجل يتطلب اختيار عميل (بحث خادمي بالرصيد
 * وحد الدين). زر التأكيد محمي بحارس أحادي الإرسال في مخزن السلة.
 */
export function PaymentSheet({ visible, onClose, total, branchId, error, verifying, onConfirm }: PaymentSheetProps) {
  const queryClient = useQueryClient()
  const paymentMethod = useCartStore(s => s.paymentMethod)
  const setPaymentMethod = useCartStore(s => s.setPaymentMethod)
  const customerId = useCartStore(s => s.customerId)
  const customerName = useCartStore(s => s.customerName)
  const setCustomer = useCartStore(s => s.setCustomer)
  const submitting = useCartStore(s => s.submitting)

  const [received, setReceived] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [customerFormError, setCustomerFormError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(customerQuery.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [customerQuery])

  const closeSheet = () => {
    if (submitting) return
    setReceived('')
    setCustomerQuery('')
    setDebouncedQuery('')
    setAddingCustomer(false)
    setNewCustomerName('')
    setNewCustomerPhone('')
    setCustomerFormError(null)
    onClose()
  }

  const needCustomerPicker = paymentMethod === 'CREDIT' && !customerId
  const customers = useQuery({
    queryKey: customersKey(debouncedQuery, branchId),
    queryFn: () => fetchCustomers(debouncedQuery, branchId),
    enabled: visible && needCustomerPicker,
    staleTime: 60_000,
  })

  const addCustomerMutation = useMutation({
    mutationFn: () => createCustomer({ name: newCustomerName, phone: newCustomerPhone, branchId }),
    onSuccess: customer => {
      setCustomer(customer.id, customer.name)
      setAddingCustomer(false)
      setNewCustomerName('')
      setNewCustomerPhone('')
      setCustomerFormError(null)
      queryClient.invalidateQueries({ queryKey: customersKey(debouncedQuery, branchId) })
    },
    onError: (err: unknown) => setCustomerFormError(err instanceof ApiError ? err.message : ar.common.unexpectedError),
  })

  const submitNewCustomer = () => {
    if (!newCustomerName.trim()) {
      setCustomerFormError(t.customerNameRequired)
      return
    }
    setCustomerFormError(null)
    addCustomerMutation.mutate()
  }

  const receivedNum = Number(received)
  const change = paymentMethod === 'CASH' && received !== '' && Number.isFinite(receivedNum)
    ? receivedNum - total
    : null

  const confirmDisabled = submitting || verifying || (paymentMethod === 'CREDIT' && !customerId)

  const renderCustomer = ({ item }: { item: CustomerDto }) => {
    const limit = Number(item.creditLimit)
    return (
      <Pressable style={styles.customerRow} onPress={() => setCustomer(item.id, item.name)}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.phone ? <Text style={styles.customerPhone}>{item.phone}</Text> : null}
        </View>
        <View style={styles.customerNumbers}>
          <Text style={styles.customerBalance}>
            {t.customerBalance}: {formatMoney(item.balance)}
          </Text>
          <Text style={styles.customerLimit}>
            {t.customerLimit}: {limit > 0 ? formatMoney(limit) : t.noLimit}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={closeSheet}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView style={styles.flexEnd} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>{t.title}</Text>
              <Pressable style={styles.closeButton} onPress={closeSheet} hitSlop={8} disabled={submitting}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>{t.total}</Text>
              <Text style={styles.totalValue}>
                {formatMoney(total)} {ar.common.currency}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>{t.method}</Text>
            <View style={styles.methodsRow}>
              {METHODS.map(m => {
                const active = paymentMethod === m.key
                return (
                  <Pressable
                    key={m.key}
                    style={[styles.methodButton, active && styles.methodButtonActive]}
                    onPress={() => setPaymentMethod(m.key)}
                    disabled={submitting}
                  >
                    <Ionicons name={m.icon} size={20} color={active ? colors.onPrimary : colors.textSecondary} />
                    <Text style={[styles.methodText, active && styles.methodTextActive]}>{m.label}</Text>
                  </Pressable>
                )
              })}
            </View>

            {paymentMethod === 'CASH' ? (
              <View style={styles.cashBox}>
                <Text style={styles.sectionLabel}>{t.received}</Text>
                <TextInput
                  style={styles.input}
                  value={received}
                  onChangeText={setReceived}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  textAlign="right"
                  editable={!submitting}
                />
                {change !== null ? (
                  <Text style={[styles.changeText, change < 0 && styles.changeNegative]}>
                    {t.change}: {formatMoney(change)} {ar.common.currency}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {paymentMethod === 'CREDIT' ? (
              <View style={styles.creditBox}>
                <Text style={styles.sectionLabel}>{t.customer}</Text>
                {customerId ? (
                  <View style={styles.selectedCustomer}>
                    <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
                    <Text style={styles.selectedCustomerName} numberOfLines={1}>
                      {customerName}
                    </Text>
                    <Pressable onPress={() => setCustomer(null, null)} disabled={submitting}>
                      <Text style={styles.changeCustomerText}>{t.changeCustomer}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.customerPicker}>
                    {addingCustomer ? (
                      <View style={styles.newCustomerForm}>
                        <TextInput
                          style={styles.input}
                          value={newCustomerName}
                          onChangeText={setNewCustomerName}
                          placeholder={t.newCustomerName}
                          placeholderTextColor={colors.textMuted}
                          textAlign="right"
                          editable={!addCustomerMutation.isPending}
                        />
                        <TextInput
                          style={styles.input}
                          value={newCustomerPhone}
                          onChangeText={setNewCustomerPhone}
                          placeholder={t.newCustomerPhone}
                          placeholderTextColor={colors.textMuted}
                          textAlign="right"
                          keyboardType="phone-pad"
                          editable={!addCustomerMutation.isPending}
                        />
                        {customerFormError ? <Text style={styles.customerFormError}>{customerFormError}</Text> : null}
                        <View style={styles.newCustomerActions}>
                          <Pressable style={styles.cancelCustomerButton} onPress={() => setAddingCustomer(false)} disabled={addCustomerMutation.isPending}>
                            <Text style={styles.cancelCustomerText}>{ar.common.cancel}</Text>
                          </Pressable>
                          <Pressable style={styles.saveCustomerButton} onPress={submitNewCustomer} disabled={addCustomerMutation.isPending}>
                            {addCustomerMutation.isPending ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={styles.saveCustomerText}>{t.saveCustomer}</Text>}
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <>
                        <TextInput
                          style={styles.input}
                          value={customerQuery}
                          onChangeText={setCustomerQuery}
                          placeholder={t.customerSearch}
                          placeholderTextColor={colors.textMuted}
                          textAlign="right"
                          editable={!submitting}
                        />
                        <Pressable style={styles.addCustomerButton} onPress={() => setAddingCustomer(true)} disabled={submitting}>
                          <Ionicons name="person-add-outline" size={18} color={colors.primary} />
                          <Text style={styles.addCustomerText}>{t.addCustomer}</Text>
                        </Pressable>
                        <View style={styles.customerList}>
                          {customers.isPending && customers.isFetching ? (
                            <ActivityIndicator color={colors.primary} style={styles.customerLoading} />
                          ) : customers.data && customers.data.length > 0 ? (
                            <FlatList
                              data={customers.data}
                              keyExtractor={item => item.id}
                              renderItem={renderCustomer}
                              keyboardShouldPersistTaps="handled"
                            />
                          ) : (
                            <Text style={styles.noCustomers}>{t.noCustomers}</Text>
                          )}
                        </View>
                      </>
                    )}
                    <Text style={styles.needCustomerHint}>{t.needCustomer}</Text>
                  </View>
                )}
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {verifying ? (
              <View style={styles.verifyingBox}>
                <ActivityIndicator size="small" color={colors.warning} />
                <Text style={styles.verifyingText}>{t.verifying}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.confirmButton, confirmDisabled && styles.confirmDisabled]}
              onPress={() =>
                onConfirm(
                  paymentMethod === 'CASH' && received !== '' && Number.isFinite(receivedNum) ? receivedNum : null,
                )
              }
              disabled={confirmDisabled}
            >
              {submitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator color={colors.onPrimary} />
                  <Text style={styles.confirmText}>{t.submitting}</Text>
                </View>
              ) : (
                <Text style={styles.confirmText}>{t.confirm}</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  flexEnd: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  totalLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  totalValue: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.primary },
  sectionLabel: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right' },
  methodsRow: { flexDirection: 'row', gap: spacing.sm },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  methodButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.button },
  methodText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  methodTextActive: { color: colors.onPrimary, fontWeight: '700' },
  cashBox: { gap: spacing.sm },
  creditBox: { gap: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  changeText: { fontSize: fontSize.md, fontWeight: '700', color: colors.success, textAlign: 'right' },
  changeNegative: { color: colors.danger },
  selectedCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  selectedCustomerName: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  changeCustomerText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  customerPicker: { gap: spacing.sm },
  addCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  addCustomerText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800' },
  newCustomerForm: { gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md },
  customerFormError: { color: colors.danger, fontSize: fontSize.xs, textAlign: 'right' },
  newCustomerActions: { flexDirection: 'row', gap: spacing.sm },
  cancelCustomerButton: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.background },
  cancelCustomerText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  saveCustomerButton: { flex: 2, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary },
  saveCustomerText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '800' },
  customerList: {
    maxHeight: 180,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  customerLoading: { padding: spacing.lg },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  customerInfo: { flex: 1, gap: 2 },
  customerName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'right' },
  customerPhone: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  customerNumbers: { alignItems: 'flex-start', gap: 2 },
  customerBalance: { fontSize: fontSize.xs, color: colors.danger },
  customerLimit: { fontSize: fontSize.xs, color: colors.textSecondary },
  noCustomers: { padding: spacing.lg, textAlign: 'center', color: colors.textMuted, fontSize: fontSize.sm },
  needCustomerHint: { fontSize: fontSize.xs, color: colors.warning, textAlign: 'right' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSize.sm, textAlign: 'right', lineHeight: 20 },
  verifyingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  verifyingText: { flex: 1, color: colors.warning, fontSize: fontSize.sm, textAlign: 'right' },
  confirmButton: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
    shadowColor: colors.success,
  },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: '800' },
  submittingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
})
