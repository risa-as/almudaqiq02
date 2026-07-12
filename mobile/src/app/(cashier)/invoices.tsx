import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ApiError } from '@/api/client'
import { fetchActiveShift, shiftKeys } from '@/api/endpoints/shifts'
import {
  fetchTransaction,
  fetchTransactions,
  invoiceDetailKey,
  refundTransaction,
  returnItems,
  shiftInvoicesKey,
  type TransactionDetail,
  type TransactionListItem,
} from '@/api/endpoints/transactions'
import { paymentLabel, typeLabel } from '@/components/cashier/constants'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

// نصوص خاصة بشاشة الفواتير
const t = {
  title: 'فواتيري',
  noShift: 'لا توجد وردية مفتوحة — تعرض هذه الشاشة فواتير الوردية الحالية فقط',
  empty: 'لا توجد فواتير في هذه الوردية بعد',
  receiptNo: 'فاتورة',
  detailTitle: 'تفاصيل الفاتورة',
  linesTitle: 'البنود',
  qty: 'الكمية',
  returnQty: 'كمية الإرجاع',
  total: 'الإجمالي',
  discount: 'الخصم',
  method: 'طريقة الدفع',
  customer: 'العميل',
  returnSelected: 'إرجاع المحدد',
  fullRefund: 'استرداد كامل',
  confirmReturnTitle: 'تأكيد الإرجاع',
  confirmReturnMessage: (amount: string) => `سيتم إرجاع بنود بقيمة ${amount}. هل أنت متأكد؟`,
  confirmRefundTitle: 'تأكيد الاسترداد الكامل',
  confirmRefundMessage: (amount: string) =>
    `سيتم استرداد الفاتورة كاملة بقيمة ${amount} وإعادة المنتجات للمخزون. هل أنت متأكد؟`,
  returnSuccess: 'تم تسجيل الإرجاع وإعادة الكميات للمخزون',
  refundSuccess: 'تم استرداد الفاتورة وإعادة المنتجات للمخزون',
  failTitle: 'فشلت العملية',
  successTitle: 'تمت العملية',
  processing: 'جارٍ التنفيذ…',
}

export default function InvoicesScreen() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})

  // ── وردية الكاشير الحالية ────────────────────────────────────────────────
  const shiftQuery = useQuery({ queryKey: shiftKeys.active, queryFn: fetchActiveShift })
  const activeShift = shiftQuery.data?.activeShift ?? null
  const branchId = activeShift?.branchId ?? user?.branchId ?? null

  // ── فواتير الفرع → تصفية محلية على (المستخدم + وقت فتح الوردية) ──────────
  const invoicesQuery = useQuery({
    queryKey: shiftInvoicesKey(branchId),
    queryFn: () => fetchTransactions({ limit: 100, branchId }),
    enabled: !!activeShift,
  })

  const shiftInvoices = useMemo(() => {
    if (!activeShift || !invoicesQuery.data) return []
    const openedAt = new Date(activeShift.openedAt).getTime()
    return invoicesQuery.data.filter(
      tx =>
        tx.userId === user?.id &&
        (tx.type === 'SALE' || tx.type === 'RETURN' || tx.type === 'REFUND') &&
        new Date(tx.date).getTime() >= openedAt,
    )
  }, [activeShift, invoicesQuery.data, user?.id])

  // ── تفاصيل الفاتورة المختارة ─────────────────────────────────────────────
  const detailQuery = useQuery({
    queryKey: invoiceDetailKey(selectedId ?? 'none'),
    queryFn: () => fetchTransaction(selectedId as string, branchId),
    enabled: !!selectedId,
  })
  const detail: TransactionDetail | undefined = detailQuery.data

  const closeDetail = () => {
    setSelectedId(null)
    setReturnQty({})
  }

  const afterWriteSuccess = (message: string) => {
    setReturnQty({})
    queryClient.invalidateQueries({ queryKey: shiftInvoicesKey(branchId) })
    queryClient.invalidateQueries({ queryKey: shiftKeys.summary })
    if (selectedId) queryClient.invalidateQueries({ queryKey: invoiceDetailKey(selectedId) })
    Alert.alert(t.successTitle, message)
  }

  const onWriteError = (err: unknown) => {
    Alert.alert(t.failTitle, err instanceof ApiError ? err.message : ar.common.unexpectedError)
  }

  // ── إرجاع جزئي/كامل لبنود محددة (POST /api/transactions/return) ──────────
  const returnMutation = useMutation({
    mutationFn: (params: { originalTransactionId: string; items: { productId: string; unitId: string; quantity: number; price: number }[] }) =>
      returnItems({ ...params, branchId }),
    onSuccess: () => afterWriteSuccess(t.returnSuccess),
    onError: onWriteError,
  })

  // ── استرداد كامل (POST /api/transactions/refund) ─────────────────────────
  const refundMutation = useMutation({
    mutationFn: (params: {
      originalTxId: string
      items: { productId: string; unitId: string; quantity: number; price: number; cost: number }[]
      totalAmount: number
    }) => refundTransaction(params),
    onSuccess: () => afterWriteSuccess(t.refundSuccess),
    onError: onWriteError,
  })

  const mutating = returnMutation.isPending || refundMutation.isPending

  const submitReturn = () => {
    if (!detail) return
    const items = detail.items
      .filter(item => (returnQty[item.id] ?? 0) > 0)
      .map(item => ({
        productId: item.productId,
        unitId: item.unitId,
        quantity: returnQty[item.id] ?? 0,
        price: Number(item.price),
      }))
    if (items.length === 0) return
    const amount = items.reduce((sum, it) => sum + it.price * it.quantity, 0)
    Alert.alert(t.confirmReturnTitle, t.confirmReturnMessage(`${formatMoney(amount)} ${ar.common.currency}`), [
      { text: ar.common.cancel, style: 'cancel' },
      {
        text: ar.common.confirm,
        style: 'destructive',
        onPress: () => returnMutation.mutate({ originalTransactionId: detail.id, items }),
      },
    ])
  }

  const submitRefund = () => {
    if (!detail) return
    const items = detail.items.map(item => ({
      productId: item.productId,
      unitId: item.unitId,
      quantity: Number(item.quantity),
      price: Number(item.price),
      cost: Number(item.cost || 0),
    }))
    const amount = items.reduce((sum, it) => sum + it.price * it.quantity, 0)
    Alert.alert(t.confirmRefundTitle, t.confirmRefundMessage(`${formatMoney(amount)} ${ar.common.currency}`), [
      { text: ar.common.cancel, style: 'cancel' },
      {
        text: ar.common.confirm,
        style: 'destructive',
        onPress: () => refundMutation.mutate({ originalTxId: detail.id, items, totalAmount: amount }),
      },
    ])
  }

  // ── صف فاتورة في القائمة ─────────────────────────────────────────────────
  const renderInvoice = ({ item }: { item: TransactionListItem }) => {
    const isSale = item.type === 'SALE'
    return (
      <Pressable
        style={styles.invoiceRow}
        onPress={isSale ? () => setSelectedId(item.id) : undefined}
        disabled={!isSale}
      >
        <Ionicons
          name={isSale ? 'chevron-back' : 'return-down-back-outline'}
          size={16}
          color={isSale ? colors.textMuted : colors.danger}
        />
        <View style={styles.invoiceAmountWrap}>
          <Text style={[styles.invoiceAmount, !isSale && styles.invoiceAmountNegative]}>
            {formatMoney(item.totalAmount)}
          </Text>
          <Text style={styles.invoiceMethod}>{paymentLabel(item.paymentMethod)}</Text>
        </View>
        <View style={styles.invoiceInfo}>
          <View style={styles.invoiceTitleRow}>
            <View style={[styles.typeBadge, !isSale && styles.typeBadgeDanger]}>
              <Text style={[styles.typeBadgeText, !isSale && styles.typeBadgeTextDanger]}>{typeLabel(item.type)}</Text>
            </View>
            <Text style={styles.invoiceNumber}>
              {t.receiptNo} #{item.receiptNumber}
            </Text>
          </View>
          <Text style={styles.invoiceDate}>{formatDateTime(item.date)}</Text>
        </View>
      </Pressable>
    )
  }

  const listBody = () => {
    if (shiftQuery.isPending) return <LoadingView />
    if (shiftQuery.isError) return <ErrorState error={shiftQuery.error} onRetry={() => shiftQuery.refetch()} />
    if (!activeShift) {
      return (
        <View style={styles.noShiftBox}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.warning} />
          <Text style={styles.noShiftText}>{t.noShift}</Text>
        </View>
      )
    }
    if (invoicesQuery.isPending) return <LoadingView />
    if (invoicesQuery.isError) return <ErrorState error={invoicesQuery.error} onRetry={() => invoicesQuery.refetch()} />
    if (shiftInvoices.length === 0) return <EmptyState message={t.empty} icon="receipt-outline" />
    return (
      <FlatList
        data={shiftInvoices}
        keyExtractor={item => item.id}
        renderItem={renderInvoice}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={invoicesQuery.isRefetching}
            onRefresh={() => invoicesQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      />
    )
  }

  return (
    <Screen title={t.title} scroll={false}>
      {listBody()}

      {/* ── تفاصيل الفاتورة + الإرجاع والاسترداد ── */}
      <Modal visible={!!selectedId} animationType="slide" transparent onRequestClose={closeDetail}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t.detailTitle}</Text>
              <Pressable style={styles.closeButton} onPress={closeDetail} hitSlop={8} disabled={mutating}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {detailQuery.isPending ? (
              <LoadingView />
            ) : detailQuery.isError ? (
              <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />
            ) : detail ? (
              <>
                <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
                  <View style={styles.metaCard}>
                    <MetaRow label={t.receiptNo} value={`#${detail.receiptNumber}`} />
                    <MetaRow label={ar.common.today} value={formatDateTime(detail.date)} />
                    <MetaRow label={t.method} value={paymentLabel(detail.paymentMethod)} />
                    {detail.customer?.name ? <MetaRow label={t.customer} value={detail.customer.name} /> : null}
                    {Number(detail.discount ?? 0) > 0 ? (
                      <MetaRow label={t.discount} value={formatMoney(detail.discount)} />
                    ) : null}
                    <MetaRow label={t.total} value={`${formatMoney(detail.totalAmount)} ${ar.common.currency}`} bold />
                  </View>

                  <Text style={styles.linesTitle}>{t.linesTitle}</Text>
                  {detail.items.map(item => {
                    const soldQty = Number(item.quantity)
                    const selected = returnQty[item.id] ?? 0
                    return (
                      <View key={item.id} style={styles.lineCard}>
                        <View style={styles.lineTop}>
                          <Text style={styles.lineTotalText}>{formatMoney(Number(item.price) * soldQty)}</Text>
                          <View style={styles.lineNameWrap}>
                            <Text style={styles.lineName} numberOfLines={1}>
                              {item.product?.name ?? '—'}
                            </Text>
                            <Text style={styles.lineMeta}>
                              {item.unit?.name ?? ''} · {t.qty}: {formatMoney(soldQty)} × {formatMoney(item.price)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.returnRow}>
                          <Text style={styles.returnLabel}>{t.returnQty}</Text>
                          <View style={styles.stepper}>
                            <Pressable
                              style={styles.stepButton}
                              onPress={() =>
                                setReturnQty(prev => ({ ...prev, [item.id]: Math.min(soldQty, (prev[item.id] ?? 0) + 1) }))
                              }
                              disabled={mutating}
                            >
                              <Ionicons name="add" size={16} color={colors.primary} />
                            </Pressable>
                            <Text style={styles.stepQty}>{selected}</Text>
                            <Pressable
                              style={styles.stepButton}
                              onPress={() =>
                                setReturnQty(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1) }))
                              }
                              disabled={mutating}
                            >
                              <Ionicons name="remove" size={16} color={colors.primary} />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    )
                  })}
                </ScrollView>

                <View style={styles.actions}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.returnButton,
                      (mutating || !Object.values(returnQty).some(q => q > 0)) && styles.actionDisabled,
                    ]}
                    onPress={submitReturn}
                    disabled={mutating || !Object.values(returnQty).some(q => q > 0)}
                  >
                    {returnMutation.isPending ? (
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                      <Ionicons name="return-down-back-outline" size={18} color={colors.onPrimary} />
                    )}
                    <Text style={styles.actionText}>{t.returnSelected}</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.actionButton, styles.refundButton, mutating && styles.actionDisabled]}
                    onPress={submitRefund}
                    disabled={mutating}
                  >
                    {refundMutation.isPending ? (
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                      <Ionicons name="cash-outline" size={18} color={colors.onPrimary} />
                    )}
                    <Text style={styles.actionText}>{t.fullRefund}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

function MetaRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, bold && styles.metaBold]}>{label}</Text>
      <Text style={[styles.metaValue, bold && styles.metaBold]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  invoiceAmountWrap: { alignItems: 'center', gap: 2, minWidth: 76 },
  invoiceAmount: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary },
  invoiceAmountNegative: { color: colors.danger },
  invoiceMethod: { fontSize: fontSize.xs, color: colors.textSecondary },
  invoiceInfo: { flex: 1, gap: 2 },
  invoiceTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  invoiceNumber: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'right' },
  invoiceDate: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  typeBadge: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  typeBadgeDanger: { backgroundColor: colors.dangerSoft },
  typeBadgeText: { fontSize: fontSize.xs, color: colors.success, fontWeight: '600' },
  typeBadgeTextDanger: { color: colors.danger },
  noShiftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noShiftText: { flex: 1, color: colors.warning, fontSize: fontSize.sm, textAlign: 'right', lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    height: '88%',
    gap: spacing.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
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
  sheetScroll: { flex: 1 },
  sheetContent: { gap: spacing.sm, paddingBottom: spacing.lg },
  metaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  metaValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  metaBold: { fontSize: fontSize.md, fontWeight: '800', color: colors.text },
  linesTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  lineCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lineTotalText: { fontSize: fontSize.sm, fontWeight: '800', color: colors.primary },
  lineNameWrap: { flex: 1, gap: 2 },
  lineName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'right' },
  lineMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  returnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  returnLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  stepButton: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  stepQty: { minWidth: 24, textAlign: 'center', fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  returnButton: { backgroundColor: colors.warning },
  refundButton: { backgroundColor: colors.danger },
  actionDisabled: { opacity: 0.5 },
  actionText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '700' },
})
