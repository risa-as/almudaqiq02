import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchSalesReport, type SalesPeriod } from '@/api/endpoints/reports'
import { BarChart } from '@/components/admin/BarChart'
import { Card, SectionTitle } from '@/components/admin/Card'
import { PeriodFilter } from '@/components/admin/PeriodFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, spacing } from '@/theme'
import { formatDateTime, formatMoney } from '@/utils/format'

const t = {
  title: 'تقرير المبيعات',
  totalSales: 'إجمالي المبيعات',
  txCount: 'عدد الفواتير',
  netProfit: 'صافي الربح',
  returns: 'المرتجعات',
  byCategory: 'المبيعات حسب التصنيف',
  recent: 'أحدث الفواتير',
  noData: 'لا توجد مبيعات في هذه الفترة',
}

const PERIODS: { value: SalesPeriod; label: string }[] = [
  { value: 'daily', label: 'اليوم' },
  { value: 'weekly', label: 'أسبوع' },
  { value: 'monthly', label: 'شهر' },
]

export default function SalesReportScreen() {
  const [period, setPeriod] = useState<SalesPeriod>('daily')
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  const q = useQuery({
    queryKey: ['report-sales', period, bid],
    queryFn: () => fetchSalesReport(period, bid),
  })

  return (
    <Screen title={t.title} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <PeriodFilter options={PERIODS} value={period} onChange={setPeriod} />

      {q.isPending ? (
        <LoadingView />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard label={t.totalSales} value={formatMoney(q.data.totalSales)} icon="cash-outline" hint={ar.common.currency} />
            <StatCard
              label={t.txCount}
              value={String(q.data.transactionCount)}
              icon="receipt-outline"
              tint={colors.violet}
              tintSoft={colors.violetSoft}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label={t.netProfit}
              value={formatMoney(q.data.netProfit)}
              icon="trending-up"
              tint={colors.success}
              tintSoft={colors.successSoft}
              hint={ar.common.currency}
            />
            <StatCard
              label={t.returns}
              value={formatMoney(q.data.totalReturns)}
              icon="return-down-back-outline"
              tint={colors.danger}
              tintSoft={colors.dangerSoft}
              hint={`${q.data.returnCount} عملية`}
            />
          </View>

          {q.data.salesByCategory.length > 0 ? (
            <>
              <SectionTitle>{t.byCategory}</SectionTitle>
              <Card>
                <BarChart
                  data={q.data.salesByCategory.slice(0, 6).map(c => ({ label: c.name, value: c.value }))}
                  tint={colors.violet}
                />
              </Card>
            </>
          ) : null}

          <SectionTitle>{t.recent}</SectionTitle>
          <Card>
            {q.data.transactions.length === 0 ? (
              <EmptyState message={t.noData} icon="receipt-outline" />
            ) : (
              q.data.transactions.slice(0, 20).map((tx, i) => (
                <View key={tx.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>#{tx.receiptNumber ?? tx.id.slice(-6)}</Text>
                    <Text style={styles.rowMeta}>
                      {tx.user?.username ?? '—'} • {formatDateTime(tx.date)}
                    </Text>
                  </View>
                  <Text style={styles.rowAmount}>{formatMoney(tx.totalAmount)}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, textAlign: 'right' },
  rowMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  rowAmount: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
})
