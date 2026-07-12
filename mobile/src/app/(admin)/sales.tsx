import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { fetchLiveTransactions, fetchShiftsReport, type LiveTransaction } from '@/api/endpoints/reports'
import { Card, SectionTitle } from '@/components/admin/Card'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime, formatMoney, formatTime } from '@/utils/format'

const LIVE_REFETCH_MS = 30_000

const t = {
  title: 'المبيعات',
  subtitle: 'فواتير اليوم والورديات المفتوحة',
  liveInvoices: 'الفواتير الحية',
  noInvoices: 'لا توجد فواتير بعد',
  openShifts: 'الورديات المفتوحة',
  noOpenShifts: 'لا توجد ورديات مفتوحة الآن',
  openedAt: 'وقت الفتح',
  branch: 'الفرع',
  salesLabel: 'المبيعات',
  invoices: 'فاتورة',
  openChip: 'مفتوحة',
}

const TX_TYPE_LABELS: Record<string, string> = {
  SALE: 'بيع',
  REFUND: 'استرداد',
  RETURN: 'إرجاع',
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'نقدي',
  CARD: 'بطاقة',
  CREDIT: 'آجل',
  SPLIT: 'جزئي',
}

/**
 * بطاقة فاتورة نظيفة: سطر رئيسي (المبلغ ↔ الوقت) + سطر ثانوي باهت
 * (طريقة الدفع • رقم الفاتورة). شارة واحدة فقط وتظهر للإرجاع/الاسترداد حصرًا.
 */
function TxRow({ tx }: { tx: LiveTransaction }) {
  const isSale = tx.type === 'SALE'
  const payment = PAYMENT_LABELS[tx.paymentMethod ?? ''] ?? tx.paymentMethod ?? '—'
  return (
    <View style={styles.txCard}>
      <View style={styles.txPrimaryRow}>
        <View style={styles.txAmountGroup}>
          <Text style={[styles.txAmount, !isSale && styles.txAmountNegative]}>
            {formatMoney(tx.totalAmount)} {ar.common.currency}
          </Text>
          {!isSale ? (
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>{TX_TYPE_LABELS[tx.type] ?? tx.type}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.txTime}>{formatDateTime(tx.date)}</Text>
      </View>
      <Text style={styles.txMetaLine}>
        {payment} • #{tx.receiptNumber}
      </Text>
    </View>
  )
}

export default function AdminSales() {
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  // بث حي: إعادة جلب تلقائية كل 30 ثانية + سحب للتحديث
  const txQ = useQuery({
    queryKey: ['admin-live-tx', bid],
    queryFn: () => fetchLiveTransactions(bid, 30),
    refetchInterval: LIVE_REFETCH_MS,
  })
  const shiftsQ = useQuery({
    queryKey: ['admin-shifts-report', bid],
    queryFn: () => fetchShiftsReport(bid),
    refetchInterval: LIVE_REFETCH_MS,
  })

  const refreshing = txQ.isRefetching || shiftsQ.isRefetching
  const onRefresh = () => {
    void txQ.refetch()
    void shiftsQ.refetch()
  }

  if (txQ.isPending) {
    return (
      <Screen title={t.title} subtitle={t.subtitle} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (txQ.isError) {
    return (
      <Screen title={t.title} subtitle={t.subtitle} scroll={false}>
        <ErrorState error={txQ.error} onRetry={() => void txQ.refetch()} />
      </Screen>
    )
  }

  const transactions = txQ.data
  const openShifts = (shiftsQ.data ?? []).filter(s => !s.closedAt)

  return (
    <Screen title={t.title} subtitle={t.subtitle} refreshing={refreshing} onRefresh={onRefresh}>
      {/* ── الورديات المفتوحة ── */}
      <SectionTitle>{t.openShifts}</SectionTitle>
      {shiftsQ.isError ? (
        <Card>
          <ErrorState error={shiftsQ.error} onRetry={() => void shiftsQ.refetch()} />
        </Card>
      ) : openShifts.length === 0 ? (
        <Card>
          <EmptyState message={t.noOpenShifts} icon="time-outline" />
        </Card>
      ) : (
        <View style={styles.cardList}>
          {openShifts.map(s => (
            <View key={s.id} style={styles.shiftCard}>
              {/* رأس البطاقة: الكاشير + شارة الحالة */}
              <View style={styles.shiftHeader}>
                <View style={styles.shiftAvatarGroup}>
                  <View style={styles.shiftAvatar}>
                    <Ionicons name="person" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.shiftName} numberOfLines={1}>
                    {s.user?.username ?? '—'}
                  </Text>
                </View>
                <View style={styles.openChip}>
                  <View style={styles.openDot} />
                  <Text style={styles.openLabel}>{t.openChip}</Text>
                </View>
              </View>

              <View style={styles.shiftDivider} />

              {/* تفاصيل الوردية: ثلاث خانات معنونة */}
              <View style={styles.shiftStats}>
                <View style={styles.shiftStat}>
                  <Text style={styles.shiftStatLabel}>{t.branch}</Text>
                  <Text style={styles.shiftStatValue} numberOfLines={1}>
                    {s.branchName}
                  </Text>
                </View>
                <View style={styles.shiftStat}>
                  <Text style={styles.shiftStatLabel}>{t.openedAt}</Text>
                  <Text style={styles.shiftStatValue}>{formatTime(s.openedAt)}</Text>
                </View>
                <View style={styles.shiftStat}>
                  <Text style={styles.shiftStatLabel}>{t.salesLabel}</Text>
                  <Text style={[styles.shiftStatValue, styles.shiftSales]} numberOfLines={1}>
                    {formatMoney(s.totalSales)}
                  </Text>
                  <Text style={styles.shiftStatCaption}>
                    {s.txCount} {t.invoices}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── الفواتير الحية ── */}
      <SectionTitle>{t.liveInvoices}</SectionTitle>
      {transactions.length === 0 ? (
        <Card>
          <EmptyState message={t.noInvoices} icon="receipt-outline" />
        </Card>
      ) : (
        <View style={styles.cardList}>
          {transactions.map(tx => (
            <TxRow key={tx.id} tx={tx} />
          ))}
        </View>
      )}
      <Text style={styles.footnote}>{`يتم التحديث تلقائيًا كل 30 ثانية — العملة: ${ar.common.currency}`}</Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  cardList: { gap: spacing.sm },

  // ── بطاقة الفاتورة: سطران فقط وحجما نص اثنان ──────────────────────────────
  txCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  txPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  txAmountGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  txAmount: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  txAmountNegative: { color: colors.danger },
  typeChip: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.dangerSoft,
  },
  typeChipText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.danger },
  txTime: { fontSize: fontSize.sm, color: colors.textMuted },
  txMetaLine: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right' },

  // ── بطاقة الوردية المفتوحة: رأس (كاشير + حالة) ثم ثلاث خانات معنونة ────────
  shiftCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  shiftAvatarGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  shiftAvatar: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftName: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, textAlign: 'right', flexShrink: 1 },
  openChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  openDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.success },
  openLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.success },
  shiftDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  shiftStats: { flexDirection: 'row', alignItems: 'flex-start' },
  shiftStat: { flex: 1, alignItems: 'center', gap: 2 },
  shiftStatLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  shiftStatValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'center' },
  shiftStatCaption: { fontSize: fontSize.xs, color: colors.textMuted },
  shiftSales: { color: colors.success, fontSize: fontSize.md, fontWeight: '800' },

  footnote: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    opacity: 0.8,
  },
})
