import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchExpenses, type ExpensePeriod } from '@/api/endpoints/expenses'
import type { DateRange } from '@/api/endpoints/reports'
import { Card, SectionTitle } from '@/components/admin/Card'
import { DateRangeFilter } from '@/components/admin/DateRangeFilter'
import { PeriodFilter } from '@/components/admin/PeriodFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, spacing } from '@/theme'
import { formatDate, formatMoney } from '@/utils/format'

const t = {
  title: 'المصروفات',
  subtitle: 'قائمة المصروفات حسب الفترة',
  total: 'إجمالي المصروفات',
  count: 'عدد المصروفات',
  list: 'القائمة',
  noExpenses: 'لا توجد مصروفات في هذه الفترة',
  uncategorized: 'بدون تصنيف',
}

const PERIODS: { value: ExpensePeriod; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'all', label: 'الكل' },
]

export default function ExpensesReportScreen() {
  const [period, setPeriod] = useState<ExpensePeriod>('month')
  const [range, setRange] = useState<DateRange | null>(null)
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  const q = useQuery({
    queryKey: ['report-expenses', period, bid, range?.startDate ?? null, range?.endDate ?? null],
    queryFn: () => fetchExpenses(period, bid, range),
  })

  const total = (q.data ?? []).reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <Screen title={t.title} subtitle={t.subtitle} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {/* فترات جاهزة + فترة مخصصة (من → إلى) */}
      <View style={styles.filtersRow}>
        <View style={styles.filtersChips}>
          <PeriodFilter
            options={PERIODS}
            value={(range ? '' : period) as ExpensePeriod}
            onChange={p => {
              setRange(null)
              setPeriod(p)
            }}
          />
        </View>
        <DateRangeFilter value={range} onChange={setRange} />
      </View>

      {q.isPending ? (
        <LoadingView />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              label={t.total}
              value={formatMoney(total)}
              icon="trending-down-outline"
              tint={colors.danger}
              tintSoft={colors.dangerSoft}
              hint={ar.common.currency}
            />
            <StatCard
              label={t.count}
              value={String(q.data.length)}
              icon="documents-outline"
              tint={colors.violet}
              tintSoft={colors.violetSoft}
            />
          </View>

          <SectionTitle>{t.list}</SectionTitle>
          <Card>
            {q.data.length === 0 ? (
              <EmptyState message={t.noExpenses} icon="cash-outline" />
            ) : (
              q.data.map((e, i) => (
                <View key={e.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {e.category || t.uncategorized} • {formatDate(e.date)}
                    </Text>
                    {e.description ? (
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {e.description}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.amountBadge}>
                    <Text style={styles.amountText}>{formatMoney(e.amount)}</Text>
                  </View>
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
  filtersRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filtersChips: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
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
  amountBadge: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  amountText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.danger },
})
