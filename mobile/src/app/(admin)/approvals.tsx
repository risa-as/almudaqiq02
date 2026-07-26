import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
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
import { appAlert } from '@/components/AppAlert'
import { Card } from '@/components/admin/Card'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { useFeature } from '@/hooks/useFeature'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { ROW } from '@/utils/rtl'
import { formatDateTime, formatMoney } from '@/utils/format'

const t = {
  title: 'الموافقات',
  bannerLoading: 'جاري تحميل الطلبات…',
  bannerSubtitle: 'راجع التحويلات وأوامر الشراء ثم اعتمد أو ارفض',
  transfersChip: 'تحويلات',
  ordersChip: 'أوامر شراء',
  transfers: 'تحويلات معلقة',
  noTransfers: 'لا توجد تحويلات بانتظار الموافقة',
  transferKind: 'طلب تحويل مخزون',
  from: 'من',
  to: 'إلى',
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
  orderKind: 'أمر شراء',
  itemsCountLabel: 'الأصناف',
  totalLabel: 'الإجمالي',
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

/** الرفض/الإلغاء لا رجعة فيه — يظهر بنبرة خطر وزر أحمر، والموافقة بنبرة سؤال. */
function confirm(title: string, message: string, onConfirm: () => void, destructive = false) {
  appAlert.confirm({ title, message, destructive, onConfirm })
}

/** صيغة عربية سليمة لعدد الطلبات المعلقة في البانر العلوي. */
function pendingLabel(n: number): string {
  if (n === 0) return 'لا توجد طلبات بانتظارك'
  if (n === 1) return 'طلب واحد بانتظار قرارك'
  if (n === 2) return 'طلبان بانتظار قرارك'
  if (n <= 10) return `${n} طلبات بانتظار قرارك`
  return `${n} طلبًا بانتظار قرارك`
}

// ── البانر العلوي: ملخّص متدرّج بعدد الطلبات المعلقة ─────────────────────────
function SummaryBanner({
  loading,
  transfersEnabled,
  transfersCount,
  ordersCount,
}: {
  loading: boolean
  transfersEnabled: boolean
  transfersCount: number
  ordersCount: number
}) {
  const total = (transfersEnabled ? transfersCount : 0) + ordersCount
  const icon: keyof typeof Ionicons.glyphMap = loading
    ? 'hourglass-outline'
    : total === 0
      ? 'checkmark-done-circle'
      : 'file-tray-full'

  return (
    <LinearGradient
      colors={[colors.gradientFrom, colors.gradientTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.banner}
    >
      <View style={styles.bannerBlob1} pointerEvents="none" />
      <View style={styles.bannerBlob2} pointerEvents="none" />

      <View style={styles.bannerTop}>
        <View style={styles.bannerIcon}>
          <Ionicons name={icon} size={24} color={colors.onPrimary} />
        </View>
        <View style={styles.bannerTextWrap}>
          <Text style={styles.bannerTitle} numberOfLines={1}>
            {loading ? t.bannerLoading : pendingLabel(total)}
          </Text>
          <Text style={styles.bannerSub} numberOfLines={1}>
            {t.bannerSubtitle}
          </Text>
        </View>
      </View>

      <View style={styles.bannerChips}>
        {transfersEnabled ? (
          <View style={styles.bannerChip}>
            <Ionicons name="swap-horizontal" size={13} color={colors.onPrimary} />
            <Text style={styles.bannerChipText}>{t.transfersChip}</Text>
            <Text style={styles.bannerChipCount}>{loading ? '…' : transfersCount}</Text>
          </View>
        ) : null}
        <View style={styles.bannerChip}>
          <Ionicons name="cart-outline" size={13} color={colors.onPrimary} />
          <Text style={styles.bannerChipText}>{t.ordersChip}</Text>
          <Text style={styles.bannerChipCount}>{loading ? '…' : ordersCount}</Text>
        </View>
      </View>
    </LinearGradient>
  )
}

// ── رأس قسم موحّد: أيقونة + عنوان + شارة عدد ملوّنة ──────────────────────────
function SectionHeader({
  icon,
  title,
  count,
  tint,
  tintSoft,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  count?: number
  tint: string
  tintSoft: string
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderStart}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
      </View>
      {typeof count === 'number' ? (
        <View style={[styles.sectionCount, { backgroundColor: tintSoft }]}>
          <Text style={[styles.sectionCountText, { color: tint }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  )
}

// ── هيكل بطاقة موافقة مشترك (تحويل / أمر شراء) ──────────────────────────────
function ApprovalCard({
  icon,
  iconTint,
  iconSoft,
  title,
  meta,
  chipIcon,
  chipText,
  chipTint,
  chipSoft,
  notes,
  approveLabel,
  rejectLabel,
  busy,
  disabled,
  onApprove,
  onReject,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconTint: string
  iconSoft: string
  title: string
  meta: string
  chipIcon: keyof typeof Ionicons.glyphMap
  chipText: string
  chipTint: string
  chipSoft: string
  notes: string | null
  approveLabel: string
  rejectLabel: string
  busy: 'approve' | 'reject' | null
  disabled: boolean
  onApprove: () => void
  onReject: () => void
  children?: ReactNode
}) {
  return (
    <View style={styles.itemCard}>
      {/* رأس البطاقة: فقاعة أيقونة + عنوان/تاريخ + شارة الحالة */}
      <View style={styles.itemHeader}>
        <View style={[styles.itemIcon, { backgroundColor: iconSoft }]}>
          <Ionicons name={icon} size={20} color={iconTint} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.itemMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: chipSoft }]}>
          <Ionicons name={chipIcon} size={11} color={chipTint} />
          <Text style={[styles.statusChipText, { color: chipTint }]}>{chipText}</Text>
        </View>
      </View>

      {children}

      {notes ? (
        <View style={styles.noteBox}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.textMuted} />
          <Text style={styles.noteText} numberOfLines={2}>
            {notes}
          </Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.actionsRow}>
        <Pressable
          disabled={disabled}
          onPress={onApprove}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.approveBtn,
            disabled && styles.btnDisabled,
            pressed && !disabled && styles.btnPressed,
          ]}
        >
          {busy === 'approve' ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color={colors.onPrimary} />
              <Text style={styles.approveBtnText}>{approveLabel}</Text>
            </>
          )}
        </Pressable>
        <Pressable
          disabled={disabled}
          onPress={onReject}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.rejectBtn,
            disabled && styles.btnDisabled,
            pressed && !disabled && styles.btnPressed,
          ]}
        >
          {busy === 'reject' ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <>
              <Ionicons name="close-circle" size={18} color={colors.danger} />
              <Text style={styles.rejectBtnText}>{rejectLabel}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  )
}

// ── مسار التحويل: من ← إلى بشكل بصري ─────────────────────────────────────────
function RouteStrip({ from, to }: { from: string; to: string }) {
  return (
    <View style={styles.routeStrip}>
      <View style={styles.routeCell}>
        <Text style={styles.routeLabel}>{t.from}</Text>
        <Text style={styles.routeName} numberOfLines={1}>
          {from}
        </Text>
      </View>
      <View style={styles.routeArrow}>
        <Ionicons name="arrow-back" size={14} color={colors.primary} />
      </View>
      <View style={styles.routeCell}>
        <Text style={styles.routeLabel}>{t.to}</Text>
        <Text style={styles.routeName} numberOfLines={1}>
          {to}
        </Text>
      </View>
    </View>
  )
}

// ── قسم التحويلات المعلقة (ميزة stock_transfers) ─────────────────────────────
function TransfersSection({ q }: { q: UseQueryResult<TransferRow[], Error> }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'CANCELLED' }) =>
      updateTransferStatus(id, status),
    onSuccess: (_data, vars) => {
      // إعادة الجلب بعد كل تنفيذ ناجح (FR-015: القائمة هي مصدر الحقيقة)
      void queryClient.invalidateQueries({ queryKey: ['admin-transfers'] })
      appAlert.success(t.done, vars.status === 'APPROVED' ? t.transferApproved : t.transferRejected)
    },
    onError: err => {
      void queryClient.invalidateQueries({ queryKey: ['admin-transfers'] })
      appAlert.error(t.error, errorMessage(err))
    },
  })

  const act = (transfer: TransferRow, status: 'APPROVED' | 'CANCELLED') => {
    if (mutation.isPending) return
    const [title, msg] =
      status === 'APPROVED'
        ? [t.approveTransferTitle, t.approveTransferMsg]
        : [t.rejectTransferTitle, t.rejectTransferMsg]
    confirm(title, msg, () => mutation.mutate({ id: transfer.id, status }), status === 'CANCELLED')
  }

  // الصفّ قيد التنفيذ فقط يعرض مؤشّر تحميل داخل زره
  const vars = mutation.isPending ? mutation.variables : undefined
  const busyOf = (id: string): 'approve' | 'reject' | null =>
    vars && vars.id === id ? (vars.status === 'APPROVED' ? 'approve' : 'reject') : null

  return (
    <>
      <SectionHeader
        icon="swap-horizontal-outline"
        title={t.transfers}
        count={q.data?.length}
        tint={colors.warning}
        tintSoft={colors.warningSoft}
      />
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
            <ApprovalCard
              key={tr.id}
              icon="swap-horizontal"
              iconTint={colors.primary}
              iconSoft={colors.primarySoft}
              title={t.transferKind}
              meta={`${transferItemsCount(tr.items)} ${t.items} • ${formatDateTime(tr.createdAt)}`}
              chipIcon="time-outline"
              chipText={t.transferPendingChip}
              chipTint={colors.warning}
              chipSoft={colors.warningSoft}
              notes={tr.notes}
              approveLabel={t.approve}
              rejectLabel={t.reject}
              busy={busyOf(tr.id)}
              disabled={mutation.isPending}
              onApprove={() => act(tr, 'APPROVED')}
              onReject={() => act(tr, 'CANCELLED')}
            >
              <RouteStrip from={tr.fromBranch.name} to={tr.toBranch.name} />
            </ApprovalCard>
          ))}
        </View>
      )}
    </>
  )
}

// ── قسم أوامر الشراء بانتظار المراجعة (مسودات) ───────────────────────────────
function OrdersSection({ q }: { q: UseQueryResult<PurchaseOrderRow[], Error> }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'order' | 'cancel' }) =>
      action === 'order' ? approvePurchaseOrder(id) : cancelPurchaseOrder(id),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-purchase-orders'] })
      appAlert.success(t.done, vars.action === 'order' ? t.orderApproved : t.orderCancelled)
    },
    onError: err => {
      void queryClient.invalidateQueries({ queryKey: ['admin-purchase-orders'] })
      appAlert.error(t.error, errorMessage(err))
    },
  })

  const act = (order: PurchaseOrderRow, action: 'order' | 'cancel') => {
    if (mutation.isPending) return
    const [title, msg] =
      action === 'order' ? [t.approveOrderTitle, t.approveOrderMsg] : [t.cancelOrderTitle, t.cancelOrderMsg]
    confirm(title, msg, () => mutation.mutate({ id: order.id, action }), action === 'cancel')
  }

  const vars = mutation.isPending ? mutation.variables : undefined
  const busyOf = (id: string): 'approve' | 'reject' | null =>
    vars && vars.id === id ? (vars.action === 'order' ? 'approve' : 'reject') : null

  const drafts = (q.data ?? []).filter(o => o.status === 'DRAFT')

  return (
    <>
      <SectionHeader
        icon="cart-outline"
        title={t.orders}
        count={q.data ? drafts.length : undefined}
        tint={colors.info}
        tintSoft={colors.infoSoft}
      />
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
            <ApprovalCard
              key={o.id}
              icon="cart"
              iconTint={colors.violet}
              iconSoft={colors.violetSoft}
              title={o.supplierName}
              meta={`${t.orderKind} • ${formatDateTime(o.createdAt)}`}
              chipIcon="document-text-outline"
              chipText={t.orderDraftChip}
              chipTint={colors.info}
              chipSoft={colors.infoSoft}
              notes={o.notes}
              approveLabel={t.approveOrder}
              rejectLabel={t.cancelOrder}
              busy={busyOf(o.id)}
              disabled={mutation.isPending}
              onApprove={() => act(o, 'order')}
              onReject={() => act(o, 'cancel')}
            >
              {/* شريط إحصاءات الأمر: عدد الأصناف + التكلفة الإجمالية */}
              <View style={styles.statsStrip}>
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>{t.itemsCountLabel}</Text>
                  <Text style={styles.statsValue}>
                    {o.itemsCount} {t.items}
                  </Text>
                </View>
                <View style={styles.statsDividerV} />
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>{t.totalLabel}</Text>
                  <Text style={[styles.statsValue, { color: colors.primary }]} numberOfLines={1}>
                    {formatMoney(o.totalCost)} {ar.common.currency}
                  </Text>
                </View>
              </View>
            </ApprovalCard>
          ))}
        </View>
      )}
    </>
  )
}

export default function AdminApprovals() {
  const transfersEnabled = useFeature('stock_transfers')
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  // الاستعلامان مرفوعان هنا حتى يتغذّى البانر العلوي بالأعداد ويرتبط سحب-للتحديث
  // بحالة الجلب الفعلية؛ المفاتيح نفسها السابقة فتبقى إبطالات الأقسام سارية.
  const transfersQ = useQuery({
    queryKey: ['admin-transfers', 'PENDING', bid],
    queryFn: () => fetchTransfers({ status: 'PENDING', selectedBranchId: bid }),
    enabled: transfersEnabled,
  })
  const ordersQ = useQuery({
    queryKey: ['admin-purchase-orders', bid],
    queryFn: () => fetchPurchaseOrders(bid),
  })

  const loading = (transfersEnabled && transfersQ.isPending) || ordersQ.isPending
  const refreshing = transfersQ.isRefetching || ordersQ.isRefetching

  const onRefresh = () => {
    if (transfersEnabled) void transfersQ.refetch()
    void ordersQ.refetch()
  }

  const transfersCount = transfersQ.data?.length ?? 0
  const draftsCount = (ordersQ.data ?? []).filter(o => o.status === 'DRAFT').length

  return (
    <Screen title={t.title} refreshing={refreshing} onRefresh={onRefresh}>
      <SummaryBanner
        loading={loading}
        transfersEnabled={transfersEnabled}
        transfersCount={transfersCount}
        ordersCount={draftsCount}
      />
      {/* قسم التحويلات يُخفى كليًا عند قفل ميزة stock_transfers (FR-017) */}
      {transfersEnabled ? <TransfersSection q={transfersQ} /> : null}
      <OrdersSection q={ordersQ} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  // ── البانر العلوي ──
  banner: {
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
    overflow: 'hidden',
    ...shadow.button,
  },
  bannerBlob1: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -50,
    left: -30,
  },
  bannerBlob2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -45,
    right: -18,
  },
  bannerTop: { flexDirection: ROW, alignItems: 'center', gap: spacing.md },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextWrap: { flex: 1, gap: 2 },
  bannerTitle: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'right' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.sm, fontWeight: '500', textAlign: 'right' },
  bannerChips: { flexDirection: ROW, gap: spacing.sm, flexWrap: 'wrap' },
  bannerChip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  bannerChipText: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: '600' },
  bannerChipCount: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: '800' },

  // ── رؤوس الأقسام ──
  sectionHeader: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeaderStart: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  sectionHeaderTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  sectionCount: {
    minWidth: 24,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  sectionCountText: { fontSize: fontSize.xs, fontWeight: '800' },

  // ── بطاقات الطلبات ──
  itemList: { gap: spacing.md },
  itemCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  itemHeader: { flexDirection: ROW, alignItems: 'center', gap: spacing.md },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, gap: 2 },
  itemTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  itemMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  statusChip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusChipText: { fontSize: fontSize.xs, fontWeight: '700' },

  // ── مسار التحويل (من ← إلى) ──
  routeStrip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  routeCell: { flex: 1, alignItems: 'center', gap: 1 },
  routeLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },
  routeName: { fontSize: fontSize.sm, color: colors.text, fontWeight: '700', textAlign: 'center' },
  routeArrow: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── شريط إحصاءات أمر الشراء ──
  statsStrip: {
    flexDirection: ROW,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  statsCell: { flex: 1, alignItems: 'center', gap: 1 },
  statsLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },
  statsValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '700', textAlign: 'center' },
  statsDividerV: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },

  // ── الملاحظات ──
  noteBox: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  noteText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right' },

  // ── الأزرار ──
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  actionsRow: { flexDirection: ROW, gap: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    height: 46,
  },
  approveBtn: { flex: 1.35, backgroundColor: colors.primary, ...shadow.button },
  approveBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.sm },
  rejectBtn: { backgroundColor: colors.dangerSoft },
  rejectBtnText: { color: colors.danger, fontWeight: '700', fontSize: fontSize.sm },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
})
