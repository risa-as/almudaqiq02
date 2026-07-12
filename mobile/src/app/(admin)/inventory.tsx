import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchExpiryReport, fetchInventoryAlerts } from '@/api/endpoints/reports'
import { Card, SectionTitle } from '@/components/admin/Card'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, spacing } from '@/theme'
import { formatDate, formatMoney } from '@/utils/format'

const t = {
  title: 'نظرة المخزون',
  scope: 'نطاق العرض:',
  lowStockCount: 'منتجات منخفضة',
  nearExpiryCount: 'دفعات قريبة الانتهاء',
  valueAtRisk: 'قيمة معرضة للتلف',
  lowStockList: 'الأدنى مخزونًا',
  nearExpiryList: 'الأقرب انتهاءً (خلال 30 يومًا)',
  noLowStock: 'لا توجد منتجات تحت الحد الأدنى',
  noExpiry: 'لا توجد دفعات قريبة الانتهاء',
  currentStock: 'المتوفر',
  minStock: 'الحد الأدنى',
  qty: 'الكمية',
  expired: 'منتهية',
  daysLeft: 'يوم متبقٍ',
}

export default function AdminInventoryOverview() {
  const { selectedBranchId, selectedBranchName } = useBranchSelection()
  const bid = selectedBranchId

  const alertsQ = useQuery({ queryKey: ['admin-alerts', bid], queryFn: () => fetchInventoryAlerts(bid) })
  const expiryQ = useQuery({ queryKey: ['admin-expiry', bid, '30'], queryFn: () => fetchExpiryReport(bid) })

  const refreshing = alertsQ.isRefetching || expiryQ.isRefetching
  const onRefresh = () => {
    void alertsQ.refetch()
    void expiryQ.refetch()
  }

  if (alertsQ.isPending || expiryQ.isPending) {
    return (
      <Screen title={t.title} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (alertsQ.isError) {
    return (
      <Screen title={t.title} scroll={false}>
        <ErrorState error={alertsQ.error} onRetry={() => void alertsQ.refetch()} />
      </Screen>
    )
  }

  const lowStock = alertsQ.data.lowStock
  const expiry = expiryQ.isError ? null : expiryQ.data

  return (
    <Screen title={t.title} refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={styles.scope}>
        {t.scope} {selectedBranchName}
      </Text>

      {/* ── إجماليات ── */}
      <View style={styles.statsRow}>
        <StatCard
          label={t.lowStockCount}
          value={lowStock.length >= 10 ? '+10' : String(lowStock.length)}
          icon="alert-circle-outline"
          tint={colors.danger}
          tintSoft={colors.dangerSoft}
        />
        <StatCard
          label={t.nearExpiryCount}
          value={String(expiry?.stats.total ?? 0)}
          icon="hourglass-outline"
          tint={colors.warning}
          tintSoft={colors.warningSoft}
        />
      </View>
      {expiry ? (
        <View style={styles.statsRow}>
          <StatCard
            label={t.valueAtRisk}
            value={formatMoney(expiry.stats.totalValueAtRisk)}
            icon="warning-outline"
            tint={colors.violet}
            tintSoft={colors.violetSoft}
            hint={`${expiry.stats.expiredCount} منتهية • ${expiry.stats.criticalCount} حرجة`}
          />
        </View>
      ) : null}

      {/* ── قائمة المنخفض ── */}
      <SectionTitle>{t.lowStockList}</SectionTitle>
      <Card>
        {lowStock.length === 0 ? (
          <EmptyState message={t.noLowStock} icon="checkmark-circle-outline" />
        ) : (
          lowStock.map((p, i) => (
            <View key={p.id} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {t.minStock}: {p.minimumStock > 0 ? p.minimumStock : 10}
                </Text>
              </View>
              <View style={[styles.qtyBadge, { backgroundColor: colors.dangerSoft }]}>
                <Text style={[styles.qtyBadgeText, { color: colors.danger }]}>
                  {t.currentStock}: {formatMoney(p.baseStock)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* ── قائمة قرب الانتهاء ── */}
      <SectionTitle>{t.nearExpiryList}</SectionTitle>
      <Card>
        {expiryQ.isError ? (
          <ErrorState error={expiryQ.error} onRetry={() => void expiryQ.refetch()} />
        ) : !expiry || expiry.batches.length === 0 ? (
          <EmptyState message={t.noExpiry} icon="checkmark-circle-outline" />
        ) : (
          expiry.batches.slice(0, 20).map((b, i) => {
            const isExpired = b.urgency === 'expired'
            const tint = isExpired || b.urgency === 'critical' ? colors.danger : colors.warning
            const tintSoft = isExpired || b.urgency === 'critical' ? colors.dangerSoft : colors.warningSoft
            return (
              <View key={b.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {b.productName}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {formatDate(b.expiryDate)} • {t.qty}: {formatMoney(b.quantity)}
                    {b.branchName !== '—' ? ` • ${b.branchName}` : ''}
                  </Text>
                </View>
                <View style={[styles.qtyBadge, { backgroundColor: tintSoft }]}>
                  <Text style={[styles.qtyBadgeText, { color: tint }]}>
                    {isExpired || b.daysLeft === null ? t.expired : `${b.daysLeft} ${t.daysLeft}`}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scope: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.md },
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
  qtyBadge: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  qtyBadgeText: { fontSize: fontSize.xs, fontWeight: '700' },
})
