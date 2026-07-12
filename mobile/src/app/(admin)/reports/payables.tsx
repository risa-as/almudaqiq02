import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchPayablesReport } from '@/api/endpoints/reports'
import { Card, SectionTitle } from '@/components/admin/Card'
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
  title: 'مستحقات الموردين',
  subtitle: 'الموردون الذين لهم أرصدة مستحقة علينا',
  totalPayables: 'إجمالي المستحقات',
  supplierCount: 'عدد الموردين الدائنين',
  list: 'الموردون',
  noPayables: 'لا توجد مستحقات — كل الأرصدة مسددة',
  lastEntry: 'آخر حركة',
  noEntries: 'لا حركات',
}

export default function PayablesReportScreen() {
  const { selectedBranchId, selectedBranchName } = useBranchSelection()
  const bid = selectedBranchId

  const q = useQuery({ queryKey: ['report-payables', bid], queryFn: () => fetchPayablesReport(bid) })

  return (
    <Screen title={t.title} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text style={styles.subtitle}>
        {t.subtitle} — {selectedBranchName}
      </Text>

      {q.isPending ? (
        <LoadingView />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              label={t.totalPayables}
              value={formatMoney(q.data.summary.totalPayables)}
              icon="wallet-outline"
              tint={colors.danger}
              tintSoft={colors.dangerSoft}
              hint={ar.common.currency}
            />
            <StatCard
              label={t.supplierCount}
              value={String(q.data.summary.supplierCount)}
              icon="business-outline"
              tint={colors.violet}
              tintSoft={colors.violetSoft}
            />
          </View>

          <SectionTitle>{t.list}</SectionTitle>
          <Card>
            {q.data.suppliers.length === 0 ? (
              <EmptyState message={t.noPayables} icon="checkmark-circle-outline" />
            ) : (
              q.data.suppliers.map((s, i) => (
                <View key={s.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {s.phone ?? '—'} •{' '}
                      {s.lastEntryDate ? `${t.lastEntry}: ${formatDate(s.lastEntryDate)}` : t.noEntries}
                    </Text>
                  </View>
                  <View style={styles.balanceBadge}>
                    <Text style={styles.balanceText}>{formatMoney(s.balance)}</Text>
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
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
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
  balanceBadge: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  balanceText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.danger },
})
