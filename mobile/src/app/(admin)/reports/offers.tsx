import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchOffersReport, type DateRange, type OfferStatus } from '@/api/endpoints/reports'
import { Card, SectionTitle } from '@/components/admin/Card'
import { DateRangeFilter } from '@/components/admin/DateRangeFilter'
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
  title: 'أداء العروض',
  subtitle: 'استخدام العروض وأثرها (آخر 30 يومًا)',
  totalUsage: 'مرات الاستخدام',
  totalRevenue: 'إيراد العروض',
  totalDiscount: 'إجمالي الخصومات',
  activeCount: 'عروض نشطة',
  list: 'العروض',
  noOffers: 'لا توجد عروض',
  usage: 'استخدام',
  revenue: 'الإيراد',
  discount: 'الخصم',
  shared: 'كل الفروع',
}

const STATUS_META: Record<OfferStatus, { label: string; tint: string; tintSoft: string }> = {
  ACTIVE: { label: 'نشط', tint: colors.success, tintSoft: colors.successSoft },
  SCHEDULED: { label: 'مجدول', tint: colors.info, tintSoft: colors.infoSoft },
  EXPIRED: { label: 'منتهٍ', tint: colors.textSecondary, tintSoft: colors.background },
  DISABLED: { label: 'موقوف', tint: colors.danger, tintSoft: colors.dangerSoft },
}

export default function OffersReportScreen() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  const q = useQuery({
    queryKey: ['report-offers', bid, range?.startDate ?? null, range?.endDate ?? null],
    queryFn: () => fetchOffersReport(bid, range),
  })

  return (
    <Screen title={t.title} subtitle={t.subtitle} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {/* فترة مخصصة اختيارية — الافتراضي خادميًا: آخر 30 يومًا */}
      <View style={styles.rangeRow}>
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
              label={t.totalUsage}
              value={String(q.data.summary.totalUsage)}
              icon="pricetags-outline"
              tint={colors.warning}
              tintSoft={colors.warningSoft}
            />
            <StatCard
              label={t.activeCount}
              value={String(q.data.summary.activeCount)}
              icon="flash-outline"
              tint={colors.success}
              tintSoft={colors.successSoft}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label={t.totalRevenue}
              value={formatMoney(q.data.summary.totalRevenue)}
              icon="cash-outline"
              hint={ar.common.currency}
            />
            <StatCard
              label={t.totalDiscount}
              value={formatMoney(q.data.summary.totalDiscount)}
              icon="remove-circle-outline"
              tint={colors.danger}
              tintSoft={colors.dangerSoft}
              hint={ar.common.currency}
            />
          </View>

          <SectionTitle>{`${t.list} (${q.data.summary.offerCount})`}</SectionTitle>
          <Card>
            {q.data.offers.length === 0 ? (
              <EmptyState message={t.noOffers} icon="pricetags-outline" />
            ) : (
              q.data.offers.map((o, i) => {
                const meta = STATUS_META[o.status]
                return (
                  <View key={o.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                    <View style={styles.rowInfo}>
                      <View style={styles.rowTitleWrap}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {o.name}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: meta.tintSoft }]}>
                          <Text style={[styles.statusBadgeText, { color: meta.tint }]}>{meta.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.rowMeta}>
                        {o.branchName ?? t.shared} • {formatDate(o.startDate)}
                        {o.endDate ? ` ← ${formatDate(o.endDate)}` : ''}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {o.usageCount} {t.usage} • {t.discount}: {formatMoney(o.discount)}
                      </Text>
                    </View>
                    <View style={styles.rowAmounts}>
                      <Text style={styles.rowRevenue}>{formatMoney(o.revenue)}</Text>
                      <Text style={styles.rowMeta}>{t.revenue}</Text>
                    </View>
                  </View>
                )
              })
            )}
          </Card>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: spacing.md },
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
  rowTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right', flexShrink: 1 },
  rowMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  rowAmounts: { alignItems: 'flex-end', gap: 2 },
  rowRevenue: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  statusBadge: { borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusBadgeText: { fontSize: fontSize.xs, fontWeight: '700' },
})
