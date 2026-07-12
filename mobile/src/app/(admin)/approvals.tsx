import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  fetchPurchaseOrders,
  type PurchaseOrderRow,
} from '@/api/endpoints/managerPurchaseOrders'
import {
  fetchTransfers,
  transferItemsCount,
  updateTransferStatus,
  type TransferRow,
} from '@/api/endpoints/managerTransfers'
import { Card, SectionTitle } from '@/components/admin/Card'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { useFeature } from '@/hooks/useFeature'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime, formatMoney } from '@/utils/format'

const t = {
  title: 'الموافقات',
  transfers: 'تحويلات معلقة',
  noTransfers: 'لا توجد تحويلات بانتظار الموافقة',
  transferLine: (from: string, to: string) => `${from} ← ${to}`,
  items: 'صنف',
  approve: 'موافقة',
  reject: 'رفض',
  approveTransferTitle: 'الموافقة على التحويل',
  approveTransferMsg: 'هل تريد الموافقة على هذا التحويل بين الفروع؟',
  rejectTransferTitle: 'رفض التحويل',
  rejectTransferMsg: 'سيتم إلغاء طلب التحويل نهائيًا. هل أنت متأكد؟',
  transferApproved: 'تمت الموافقة على التحويل',
  transferRejected: 'تم رفض التحويل',
  transferPendingChip: 'بانتظار الموافقة',
  orderDraftChip: 'مسودة',
  orders: 'أوامر شراء بانتظار المراجعة',
  noOrders: 'لا توجد أوامر شراء بانتظار المراجعة',
  supplier: 'المورد',
  approveOrder: 'اعتماد وإرسال',
  cancelOrder: 'إلغاء',
  approveOrderTitle: 'اعتماد أمر الشراء',
  approveOrderMsg: 'سيتم اعتماد الأمر وإرساله للمورد (يستلمه أمين المخزن لاحقًا). متابعة؟',
  cancelOrderTitle: 'إلغاء أمر الشراء',
  cancelOrderMsg: 'سيتم إلغاء أمر الشراء نهائيًا. هل أنت متأكد؟',
  orderApproved: 'تم اعتماد أمر الشراء',
  orderCancelled: 'تم إلغاء أمر الشراء',
  done: 'تم',
  error: 'تعذر التنفيذ',
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : ar.common.unexpectedError
}

function confirm(title: string, message: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: ar.common.cancel, style: 'cancel' },
    { text: ar.common.confirm, style: 'default', onPress: onConfirm },
  ])
}

// ── قسم التحويلات المعلقة (ميزة stock_transfers) ─────────────────────────────
function TransfersSection({ bid }: { bid: string | null }) {
  const queryClient = useQueryClient()

  const q = useQuery({
    queryKey: ['admin-transfers', 'PENDING', bid],
    queryFn: () => fetchTransfers({ status: 'PENDING', selectedBranchId: bid }),
  })

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'CANCELLED' }) =>
      updateTransferStatus(id, status),
    onSuccess: (_data, vars) => {
      // إعادة الجلب بعد كل تنفيذ ناجح (FR-015: القائمة هي مصدر الحقيقة)
      void queryClient.invalidateQueries({ queryKey: ['admin-transfers'] })
      Alert.alert(t.done, vars.status === 'APPROVED' ? t.transferApproved : t.transferRejected)
    },
    onError: err => {
      void queryClient.invalidateQueries({ queryKey: ['admin-transfers'] })
      Alert.alert(t.error, errorMessage(err))
    },
  })

  const act = (transfer: TransferRow, status: 'APPROVED' | 'CANCELLED') => {
    if (mutation.isPending) return
    const [title, msg] =
      status === 'APPROVED'
        ? [t.approveTransferTitle, t.approveTransferMsg]
        : [t.rejectTransferTitle, t.rejectTransferMsg]
    confirm(title, msg, () => mutation.mutate({ id: transfer.id, status }))
  }

  return (
    <>
      <SectionTitle>{t.transfers}</SectionTitle>
      {q.isPending ? (
        <Card>
          <LoadingView />
        </Card>
      ) : q.isError ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </Card>
      ) : q.data.length === 0 ? (
        <Card>
          <EmptyState message={t.noTransfers} icon="swap-horizontal-outline" />
        </Card>
      ) : (
        <View style={styles.itemList}>
          {q.data.map(tr => (
            <View key={tr.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>
                    {t.transferLine(tr.fromBranch.name, tr.toBranch.name)}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {transferItemsCount(tr.items)} {t.items} • {formatDateTime(tr.createdAt)}
                  </Text>
                  {tr.notes ? <Text style={styles.itemMeta}>{tr.notes}</Text> : null}
                </View>
                <View style={[styles.statusChip, { backgroundColor: colors.warningSoft }]}>
                  <Text style={[styles.statusChipText, { color: colors.warning }]}>{t.transferPendingChip}</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.actionBtn, styles.approveBtn, mutation.isPending && styles.btnDisabled]}
                  onPress={() => act(tr, 'APPROVED')}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.onPrimary} />
                  <Text style={styles.approveBtnText}>{t.approve}</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.rejectBtn, mutation.isPending && styles.btnDisabled]}
                  onPress={() => act(tr, 'CANCELLED')}
                >
                  <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
                  <Text style={styles.rejectBtnText}>{t.reject}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  )
}

// ── قسم أوامر الشراء بانتظار المراجعة (مسودات) ───────────────────────────────
function OrdersSection({ bid }: { bid: string | null }) {
  const queryClient = useQueryClient()

  const q = useQuery({
    queryKey: ['admin-purchase-orders', bid],
    queryFn: () => fetchPurchaseOrders(bid),
  })

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'order' | 'cancel' }) =>
      action === 'order' ? approvePurchaseOrder(id) : cancelPurchaseOrder(id),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-purchase-orders'] })
      Alert.alert(t.done, vars.action === 'order' ? t.orderApproved : t.orderCancelled)
    },
    onError: err => {
      void queryClient.invalidateQueries({ queryKey: ['admin-purchase-orders'] })
      Alert.alert(t.error, errorMessage(err))
    },
  })

  const act = (order: PurchaseOrderRow, action: 'order' | 'cancel') => {
    if (mutation.isPending) return
    const [title, msg] =
      action === 'order' ? [t.approveOrderTitle, t.approveOrderMsg] : [t.cancelOrderTitle, t.cancelOrderMsg]
    confirm(title, msg, () => mutation.mutate({ id: order.id, action }))
  }

  const drafts = (q.data ?? []).filter(o => o.status === 'DRAFT')

  return (
    <>
      <SectionTitle>{t.orders}</SectionTitle>
      {q.isPending ? (
        <Card>
          <LoadingView />
        </Card>
      ) : q.isError ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </Card>
      ) : drafts.length === 0 ? (
        <Card>
          <EmptyState message={t.noOrders} icon="clipboard-outline" />
        </Card>
      ) : (
        <View style={styles.itemList}>
          {drafts.map(o => (
            <View key={o.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>
                    {t.supplier}: {o.supplierName}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {o.itemsCount} {t.items} • {formatMoney(o.totalCost)} {ar.common.currency} •{' '}
                    {formatDateTime(o.createdAt)}
                  </Text>
                  {o.notes ? <Text style={styles.itemMeta}>{o.notes}</Text> : null}
                </View>
                <View style={[styles.statusChip, { backgroundColor: colors.infoSoft }]}>
                  <Text style={[styles.statusChipText, { color: colors.info }]}>{t.orderDraftChip}</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.actionBtn, styles.approveBtn, mutation.isPending && styles.btnDisabled]}
                  onPress={() => act(o, 'order')}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.onPrimary} />
                  <Text style={styles.approveBtnText}>{t.approveOrder}</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.rejectBtn, mutation.isPending && styles.btnDisabled]}
                  onPress={() => act(o, 'cancel')}
                >
                  <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
                  <Text style={styles.rejectBtnText}>{t.cancelOrder}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  )
}

export default function AdminApprovals() {
  const transfersEnabled = useFeature('stock_transfers')
  const queryClient = useQueryClient()
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  const onRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-transfers'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-purchase-orders'] })
  }

  return (
    <Screen title={t.title} onRefresh={onRefresh}>
      {/* قسم التحويلات يُخفى كليًا عند قفل ميزة stock_transfers (FR-017) */}
      {transfersEnabled ? <TransfersSection bid={bid} /> : null}
      <OrdersSection bid={bid} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  itemList: { gap: spacing.sm },
  itemCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  itemInfo: { flex: 1, gap: 2 },
  itemTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  itemMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  statusChip: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusChipText: { fontSize: fontSize.xs, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    height: 44,
  },
  approveBtn: { backgroundColor: colors.primary, ...shadow.button },
  approveBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.sm },
  rejectBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
  rejectBtnText: { color: colors.danger, fontWeight: '700', fontSize: fontSize.sm },
  btnDisabled: { opacity: 0.5 },
})
