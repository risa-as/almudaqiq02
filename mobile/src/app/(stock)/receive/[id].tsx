import { useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { checkBarcode } from '@/api/endpoints/inventory'
import {
  fetchPurchaseOrder,
  receivePurchaseOrder,
  type PurchaseOrderLine,
  type ReceiveLine,
} from '@/api/endpoints/purchaseOrders'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { CollapsibleScanner } from '@/components/stock/CollapsibleScanner'
import { chipFor, ORDER_STATUS, StatusChip } from '@/components/stock/StatusChip'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime, formatMoney } from '@/utils/format'

const S = {
  title: 'استلام أمر شراء',
  supplier: 'المورد',
  scan: 'مسح منتج لتحديد سطره',
  notOnOrder: 'هذا المنتج ليس ضمن أمر الشراء',
  notFound: 'المنتج غير موجود',
  ordered: 'المطلوب',
  received: 'المستلَم',
  receivedQty: 'الكمية المستلمة',
  expiry: 'الصلاحية (YYYY-MM-DD)',
  invalidExpiry: 'تاريخ صلاحية غير صالح — استخدم الصيغة YYYY-MM-DD',
  invalidQty: 'كمية مستلمة غير صالحة',
  paidAmount: 'المبلغ المدفوع الآن (اختياري)',
  submit: 'تأكيد استلام الأمر',
  submitting: 'جارٍ الاستلام…',
  confirmTitle: 'تأكيد الاستلام؟',
  confirmMsg: 'سيُستلم الأمر كاملًا بالكميات المدخلة وتُضاف دفعات للمخزون — لا يمكن التراجع',
  successMsg: 'تم استلام الأمر وإضافة الكميات للمخزون',
  readOnly: 'هذا الأمر مُغلق — عرض فقط',
}

const EXPIRY_RE = /^\d{4}-\d{2}-\d{2}$/

interface LineDraft {
  qty: string
  expiry: string
}

function isValidExpiry(value: string): boolean {
  if (!value) return true // اختياري
  if (!EXPIRY_RE.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

export default function ReceiveOrder() {
  const params = useLocalSearchParams<{ id: string }>()
  const orderId = typeof params.id === 'string' ? params.id : ''
  const queryClient = useQueryClient()

  // مدخلات السطور تعيش محليًا وتنجو من أي فشل إرسال (FR-015)
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({})
  const [paidAmount, setPaidAmount] = useState('')
  const [banner, setBanner] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [scanBusy, setScanBusy] = useState(false)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const orderQuery = useQuery({
    queryKey: ['purchase-order', orderId],
    queryFn: () => fetchPurchaseOrder(orderId),
    enabled: !!orderId,
  })

  const order = orderQuery.data
  const editable = order ? ['DRAFT', 'ORDERED'].includes(order.status) : false

  const draftOf = (line: PurchaseOrderLine): LineDraft =>
    drafts[line.id] ?? { qty: String(line.quantity), expiry: '' }

  const setDraft = (itemId: string, patch: Partial<LineDraft>, line: PurchaseOrderLine) => {
    setDrafts(prev => ({ ...prev, [itemId]: { ...(prev[itemId] ?? { qty: String(line.quantity), expiry: '' }), ...patch } }))
  }

  const receiveMutation = useMutation({
    mutationFn: () => {
      if (!order) throw new ApiError(0, ar.common.unexpectedError)
      const received: ReceiveLine[] = order.items.map(line => {
        const d = draftOf(line)
        return {
          itemId: line.id,
          receivedQty: Math.max(0, Math.round(Number(d.qty) || 0)),
          ...(d.expiry ? { expiryDate: d.expiry } : {}),
        }
      })
      const paid = Number(paidAmount)
      return receivePurchaseOrder(orderId, received, Number.isFinite(paid) && paid > 0 ? paid : undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      Alert.alert(ar.common.confirm, S.successMsg, [{ text: ar.common.close, onPress: () => router.back() }])
    },
    onError: err => {
      // كل المدخلات تبقى كما هي — فقط نعرض الخطأ
      setBanner({ kind: 'error', text: err instanceof ApiError ? err.message : ar.common.unexpectedError })
    },
  })

  const onScanned = async (code: string) => {
    if (scanBusy || !order || !editable) return
    setScanBusy(true)
    setBanner(null)
    try {
      const res = await checkBarcode(code)
      if (!res.found || !res.product) {
        setBanner({ kind: 'error', text: S.notFound })
        return
      }
      const line = order.items.find(i => i.productId === res.product!.id)
      if (!line) {
        // منتج ليس على الأمر: تحذير فقط — لا يُضاف شيء (US3-AS3)
        setBanner({ kind: 'warning', text: S.notOnOrder })
        return
      }
      setHighlightId(line.id)
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
      highlightTimer.current = setTimeout(() => setHighlightId(null), 4000)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setBanner({ kind: 'error', text: S.notFound })
      else setBanner({ kind: 'error', text: err instanceof ApiError ? err.message : ar.common.unexpectedError })
    } finally {
      setScanBusy(false)
    }
  }

  const submit = () => {
    if (!order) return
    // تحقق محلي قبل الإرسال
    for (const line of order.items) {
      const d = draftOf(line)
      const qty = Number(d.qty)
      if (d.qty.trim() === '' || !Number.isFinite(qty) || qty < 0) {
        setBanner({ kind: 'error', text: `${S.invalidQty}: ${line.productName}` })
        return
      }
      if (!isValidExpiry(d.expiry.trim())) {
        setBanner({ kind: 'error', text: `${S.invalidExpiry} — ${line.productName}` })
        return
      }
    }
    setBanner(null)
    Alert.alert(S.confirmTitle, S.confirmMsg, [
      { text: ar.common.cancel, style: 'cancel' },
      { text: ar.common.confirm, onPress: () => receiveMutation.mutate() },
    ])
  }

  if (orderQuery.isLoading) {
    return (
      <Screen title={S.title} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (orderQuery.isError || !order) {
    return (
      <Screen title={S.title} scroll={false}>
        <ErrorState error={orderQuery.error} onRetry={() => orderQuery.refetch()} />
      </Screen>
    )
  }

  const chip = chipFor(ORDER_STATUS, order.status)

  return (
    <Screen
      title={S.title}
      scroll={false}
      headerAction={
        <View style={styles.headerAction}>
          <StatusChip {...chip} />
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      }
    >
      <FlatList
        data={order.items}
        keyExtractor={i => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.supplierRow}>
              <Text style={styles.supplierLabel}>{S.supplier}</Text>
              <Text style={styles.supplierName} numberOfLines={1}>{order.supplierName ?? 'غير محدد'}</Text>
            </View>
            <Text style={styles.date}>{formatDateTime(order.createdAt)}</Text>
            {editable ? <CollapsibleScanner onScanned={onScanned} paused={scanBusy} openLabel={S.scan} /> : (
              <Text style={styles.readOnly}>{S.readOnly}</Text>
            )}
            {banner ? (
              <View style={[styles.banner, banner.kind === 'error' ? styles.bannerError : styles.bannerWarning]}>
                <Ionicons
                  name={banner.kind === 'error' ? 'alert-circle' : 'warning'}
                  size={16}
                  color={banner.kind === 'error' ? colors.danger : colors.warning}
                />
                <Text style={[styles.bannerText, { color: banner.kind === 'error' ? colors.danger : colors.warning }]}>
                  {banner.text}
                </Text>
                <Pressable onPress={() => setBanner(null)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const d = draftOf(item)
          const highlighted = highlightId === item.id
          const expiryInvalid = !isValidExpiry(d.expiry.trim())
          return (
            <View style={[styles.lineCard, highlighted && styles.lineHighlighted]}>
              <View style={styles.lineTop}>
                <Text style={styles.lineName} numberOfLines={2}>{item.productName}</Text>
                {highlighted ? <Ionicons name="locate" size={18} color={colors.primary} /> : null}
              </View>
              <View style={styles.lineMeta}>
                <Text style={styles.metaText}>
                  {S.ordered}: <Text style={styles.metaStrong}>{item.quantity}</Text>
                </Text>
                <Text style={styles.metaText}>
                  {formatMoney(item.costPrice)} {ar.common.currency}
                </Text>
                {!editable ? (
                  <Text style={[styles.metaText, { color: colors.success }]}>
                    {S.received}: <Text style={[styles.metaStrong, { color: colors.success }]}>{item.receivedQty ?? '—'}</Text>
                  </Text>
                ) : null}
              </View>
              {editable ? (
                <View style={styles.inputsRow}>
                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>{S.receivedQty}</Text>
                    <TextInput
                      style={styles.input}
                      value={d.qty}
                      onChangeText={v => setDraft(item.id, { qty: v }, item)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={[styles.inputWrap, { flex: 1.4 }]}>
                    <Text style={styles.inputLabel}>{S.expiry}</Text>
                    <TextInput
                      style={[styles.input, expiryInvalid && styles.inputInvalid]}
                      value={d.expiry}
                      onChangeText={v => setDraft(item.id, { expiry: v }, item)}
                      placeholder="2027-01-31"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          )
        }}
        ListFooterComponent={
          editable ? (
            <View style={styles.footer}>
              {order.supplierId ? (
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>{S.paidAmount}</Text>
                  <TextInput
                    style={styles.input}
                    value={paidAmount}
                    onChangeText={setPaidAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              ) : null}
              <Pressable
                style={[styles.submitButton, receiveMutation.isPending && styles.disabled]}
                onPress={submit}
                disabled={receiveMutation.isPending}
              >
                <Ionicons name="download" size={18} color={colors.onPrimary} />
                <Text style={styles.submitText}>{receiveMutation.isPending ? S.submitting : S.submit}</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listContent: { paddingBottom: spacing.xxl, gap: spacing.sm },
  header: { gap: spacing.sm, paddingBottom: spacing.sm },
  supplierRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  supplierLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  supplierName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', textAlign: 'right' },
  date: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right' },
  readOnly: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerError: { backgroundColor: colors.dangerSoft },
  bannerWarning: { backgroundColor: colors.warningSoft },
  bannerText: { flex: 1, fontSize: fontSize.sm, textAlign: 'right' },
  lineCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  lineHighlighted: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lineName: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: '700', textAlign: 'right' },
  lineMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  metaText: { color: colors.textSecondary, fontSize: fontSize.sm },
  metaStrong: { color: colors.text, fontWeight: '800' },
  inputsRow: { flexDirection: 'row', gap: spacing.sm },
  inputWrap: { flex: 1, gap: 4 },
  inputLabel: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'center',
    backgroundColor: colors.background,
  },
  inputInvalid: { borderColor: colors.danger },
  footer: { gap: spacing.md, paddingTop: spacing.sm },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    ...shadow.button,
  },
  submitText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },
  disabled: { opacity: 0.6 },
})
