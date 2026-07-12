import { StyleSheet, Text, View } from 'react-native'
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
import { formatDateTime, formatMoney } from '@/utils/format'

const LIVE_REFETCH_MS = 30_000

const t = {
  title: 'المبيعات',
  liveInvoices: 'الفواتير الحية',
  noInvoices: 'لا توجد فواتير بعد',
  openShifts: 'الورديات المفتوحة',
  noOpenShifts: 'لا توجد ورديات مفتوحة الآن',
  openedAt: 'فُتحت',
  invoices: 'فاتورة',
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

function TxRow({ tx }: { tx: LiveTransaction }) {
  const isSale = tx.type === 'SALE'
  return (
    <View style={styles.txCard}>
      <View style={styles.txInfo}>
        <View style={styles.txTitleRow}>
          <Text style={styles.txReceipt}>#{tx.receiptNumber}</Text>
          <View style={[styles.typeBadge, { backgroundColor: isSale ? colors.successSoft : colors.dangerSoft }]}>
            <Text style={[styles.typeBadgeText, { color: isSale ? colors.success : colors.danger }]}>
              {TX_TYPE_LABELS[tx.type] ?? tx.type}
            </Text>
          </View>
          <View style={styles.payChip}>
            <Text style={styles.payChipText}>{PAYMENT_LABELS[tx.paymentMethod ?? ''] ?? tx.paymentMethod ?? '—'}</Text>
          </View>
        </View>
        <Text style={styles.txMeta}>
          {tx.user?.username ?? '—'}
          {tx.customer?.name ? ` • ${tx.customer.name}` : ''}
        </Text>
        <Text style={styles.txMeta}>{formatDateTime(tx.date)}</Text>
      </View>
      <View style={styles.txAmountWrap}>
        <Text style={[styles.txAmount, { color: isSale ? colors.text : colors.danger }]}>
          {formatMoney(tx.totalAmount)}
        </Text>
        <Text style={styles.txMeta}>{ar.common.currency}</Text>
      </View>
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
      <Screen title={t.title} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (txQ.isError) {
    return (
      <Screen title={t.title} scroll={false}>
        <ErrorState error={txQ.error} onRetry={() => void txQ.refetch()} />
      </Screen>
    )
  }

  const transactions = txQ.data
  const openShifts = (shiftsQ.data ?? []).filter(s => !s.closedAt)

  return (
    <Screen title={t.title} refreshing={refreshing} onRefresh={onRefresh}>
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
            <View key={s.id} style={styles.txCard}>
              <View style={styles.txInfo}>
                <Text style={styles.shiftName}>{s.user?.username ?? '—'}</Text>
                <Text style={styles.txMeta}>{s.branchName}</Text>
                <Text style={styles.txMeta}>
                  {t.openedAt} {formatDateTime(s.openedAt)}
                </Text>
              </View>
              <View style={styles.txAmountWrap}>
                <Text style={styles.shiftSales}>{formatMoney(s.totalSales)}</Text>
                <Text style={styles.txMeta}>
                  {s.txCount} {t.invoices}
                </Text>
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
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  txInfo: { flex: 1, gap: 2 },
  txTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  txReceipt: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  typeBadge: { borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  typeBadgeText: { fontSize: fontSize.xs, fontWeight: '700' },
  payChip: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.primarySoft,
  },
  payChipText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary },
  txMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  txAmountWrap: { alignItems: 'flex-end', gap: 2 },
  txAmount: { fontSize: fontSize.lg, fontWeight: '800' },
  shiftName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  shiftSales: { fontSize: fontSize.lg, fontWeight: '800', color: colors.success },
  footnote: {
    marginTop: spacing.md,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
})
