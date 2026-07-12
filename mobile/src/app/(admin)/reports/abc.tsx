import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchAbcReport, type AbcClass, type AbcProductRow, type DateRange } from '@/api/endpoints/reports'
import { Card } from '@/components/admin/Card'
import { DateRangeFilter } from '@/components/admin/DateRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, spacing } from '@/theme'
import { formatMoney } from '@/utils/format'

const t = {
  title: 'تحليل ABC',
  subtitle: 'تصنيف المنتجات حسب مساهمتها في الإيراد (آخر 90 يومًا)',
  products: 'منتج',
  ofRevenue: 'من الإيراد',
  revenue: 'الإيراد',
  profit: 'الربح',
  qty: 'الكمية',
  noData: 'لا توجد مبيعات في الفترة المحسوبة',
}

const CLASS_META: Record<AbcClass, { label: string; desc: string; tint: string; tintSoft: string }> = {
  A: { label: 'الفئة A', desc: 'الأهم — أول 80% من الإيراد', tint: colors.success, tintSoft: colors.successSoft },
  B: { label: 'الفئة B', desc: 'متوسطة — 80% إلى 95%', tint: colors.warning, tintSoft: colors.warningSoft },
  C: { label: 'الفئة C', desc: 'الأقل — آخر 5%', tint: colors.danger, tintSoft: colors.dangerSoft },
}

function ProductRow({ p, divider }: { p: AbcProductRow; divider: boolean }) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {p.rank}. {p.name}
        </Text>
        <Text style={styles.rowMeta}>
          {p.category} • {t.qty}: {formatMoney(p.quantity)}
        </Text>
      </View>
      <View style={styles.rowAmounts}>
        <Text style={styles.rowRevenue}>{formatMoney(p.revenue)}</Text>
        <Text style={styles.rowMeta}>
          {t.profit}: {formatMoney(p.profit)}
        </Text>
      </View>
    </View>
  )
}

export default function AbcReportScreen() {
  const [range, setRange] = useState<DateRange | null>(null)
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  const q = useQuery({
    queryKey: ['report-abc', bid, range?.startDate ?? null, range?.endDate ?? null],
    queryFn: () => fetchAbcReport(bid, range),
  })

  return (
    <Screen title={t.title} subtitle={t.subtitle} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {/* فترة مخصصة اختيارية — الافتراضي خادميًا: آخر 90 يومًا */}
      <View style={styles.rangeRow}>
        <DateRangeFilter value={range} onChange={setRange} />
      </View>

      {q.isPending ? (
        <LoadingView />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.products.length === 0 ? (
        <EmptyState message={t.noData} icon="podium-outline" />
      ) : (
        (['A', 'B', 'C'] as AbcClass[]).map(cls => {
          const meta = CLASS_META[cls]
          const summary = q.data.summary.classes[cls]
          const products = q.data.products.filter(p => p.class === cls)
          return (
            <View key={cls} style={styles.classSection}>
              {/* رأس مجموعة ملوّن: A أخضر / B كهرماني / C أحمر */}
              <View style={[styles.classHeader, { backgroundColor: meta.tintSoft, borderColor: `${meta.tint}33` }]}>
                <View style={styles.classHeaderRight}>
                  <View style={[styles.classDot, { backgroundColor: meta.tint }]} />
                  <Text style={[styles.classHeaderTitle, { color: meta.tint }]}>{meta.label}</Text>
                </View>
                <View style={styles.classBadge}>
                  <Text style={[styles.classBadgeText, { color: meta.tint }]}>
                    {summary.count} {t.products} • {summary.revenueShare.toFixed(1)}% {t.ofRevenue}
                  </Text>
                </View>
              </View>
              <Card style={styles.classCard}>
                <Text style={styles.classDesc}>{meta.desc}</Text>
                {products.length === 0 ? (
                  <EmptyState />
                ) : (
                  products.slice(0, 15).map((p, i) => <ProductRow key={p.productId} p={p} divider={i > 0} />)
                )}
              </Card>
            </View>
          )
        })
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: spacing.xs },
  classSection: { marginTop: spacing.lg },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  classHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  classDot: { width: 10, height: 10, borderRadius: radius.full },
  classHeaderTitle: { fontSize: fontSize.md, fontWeight: '800', textAlign: 'right' },
  classCard: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
  },
  classBadge: { borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  classBadgeText: { fontSize: fontSize.xs, fontWeight: '700' },
  classDesc: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
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
  rowAmounts: { alignItems: 'flex-end', gap: 2 },
  rowRevenue: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
})
