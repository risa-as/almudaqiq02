import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchAbcReport, type AbcClass, type AbcProductRow } from '@/api/endpoints/reports'
import { Card, SectionTitle } from '@/components/admin/Card'
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
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  const q = useQuery({ queryKey: ['report-abc', bid], queryFn: () => fetchAbcReport(bid) })

  return (
    <Screen title={t.title} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text style={styles.subtitle}>{t.subtitle}</Text>

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
            <View key={cls}>
              <SectionTitle
                action={
                  <View style={[styles.classBadge, { backgroundColor: meta.tintSoft }]}>
                    <Text style={[styles.classBadgeText, { color: meta.tint }]}>
                      {summary.count} {t.products} • {summary.revenueShare.toFixed(1)}% {t.ofRevenue}
                    </Text>
                  </View>
                }
              >
                {meta.label}
              </SectionTitle>
              <Card>
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
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.sm },
  classBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
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
