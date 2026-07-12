import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchAbcReport, type AbcClass, type AbcProductRow, type DateRange } from '@/api/endpoints/reports'
import { ReportRangeFilter } from '@/components/admin/ReportRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatMoney } from '@/utils/format'

const t = {
  title: 'تحليل ABC',
  subtitle: 'المنتجات الأكثر مساهمة في الإيراد',
  totalRevenue: 'إجمالي الإيراد',
  productCount: 'عدد المنتجات',
  product: 'منتج',
  ofRevenue: 'من الإيراد',
  profit: 'ربح',
  qty: 'كمية',
  noData: 'لا توجد مبيعات في الفترة المحسوبة',
  distribution: 'توزيع الإيراد على الفئات',
}

const CLASS_META: Record<AbcClass, { label: string; desc: string; tint: string; tintSoft: string }> = {
  A: { label: 'الفئة A', desc: 'الأهم — أول 80% من الإيراد', tint: colors.success, tintSoft: colors.successSoft },
  B: { label: 'الفئة B', desc: 'متوسطة — 80% إلى 95%', tint: colors.warning, tintSoft: colors.warningSoft },
  C: { label: 'الفئة C', desc: 'الأقل — آخر 5%', tint: colors.danger, tintSoft: colors.dangerSoft },
}

const CLASSES: AbcClass[] = ['A', 'B', 'C']

/** صف منتج نظيف: رتبة + اسم/تصنيف + إيراد/ربح، وأسفله شريط يوضح حجم الإيراد نسبيًا. */
function ProductRow({
  p,
  tint,
  tintSoft,
  topRevenue,
}: {
  p: AbcProductRow
  tint: string
  tintSoft: string
  topRevenue: number
}) {
  const barWidth = topRevenue > 0 ? Math.max((p.revenue / topRevenue) * 100, 4) : 0
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        {/* كتلة الاسم على اليمين: رتبة + اسم وتحته الفئة والكمية */}
        <View style={styles.rowInfo}>
          <View style={[styles.rankBadge, { backgroundColor: tintSoft }]}>
            <Text style={[styles.rankText, { color: tint }]}>{p.rank}</Text>
          </View>
          <View style={styles.textCol}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {p.category} • {t.qty} {formatMoney(p.quantity)}
            </Text>
          </View>
        </View>
        {/* المبالغ على اليسار */}
        <View style={styles.rowAmounts}>
          <Text style={styles.rowRevenue}>{formatMoney(p.revenue)}</Text>
          <Text style={styles.rowProfit}>
            {t.profit} {formatMoney(p.profit)}
          </Text>
        </View>
      </View>
      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: tint }]} />
        </View>
        <Text style={styles.sharePct}>{p.sharePct.toFixed(1)}%</Text>
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
      <View style={styles.rangeRow}>
        <ReportRangeFilter onRangeChange={setRange} />
      </View>

      {q.isPending ? (
        <LoadingView />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.products.length === 0 ? (
        <EmptyState message={t.noData} icon="podium-outline" />
      ) : (
        <>
          {/* ── ملخص علوي: إجمالي الإيراد + عدد المنتجات + شريط التوزيع ── */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryLabel}>{t.totalRevenue}</Text>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(q.data.summary.totalRevenue)}
                </Text>
                <Text style={styles.summaryUnit}>{ar.common.currency}</Text>
              </View>
              <View style={styles.summaryVDivider} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryLabel}>{t.productCount}</Text>
                <Text style={styles.summaryValue}>{q.data.summary.productCount}</Text>
                <Text style={styles.summaryUnit}>{t.product}</Text>
              </View>
            </View>

            <Text style={styles.distTitle}>{t.distribution}</Text>
            <View style={styles.distTrack}>
              {CLASSES.map(cls => {
                const share = q.data.summary.classes[cls].revenueShare
                if (share <= 0) return null
                return <View key={cls} style={{ width: `${share}%`, backgroundColor: CLASS_META[cls].tint }} />
              })}
            </View>
            <View style={styles.legendRow}>
              {CLASSES.map(cls => (
                <View key={cls} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: CLASS_META[cls].tint }]} />
                  <Text style={styles.legendText}>
                    {cls} · {q.data.summary.classes[cls].revenueShare.toFixed(0)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── أقسام الفئات ── */}
          {CLASSES.map(cls => {
            const meta = CLASS_META[cls]
            const summary = q.data.summary.classes[cls]
            const products = q.data.products.filter(p => p.class === cls)
            if (products.length === 0) return null
            const topRevenue = products[0]?.revenue ?? 0
            return (
              <View key={cls} style={styles.classSection}>
                <View style={[styles.classHeader, { backgroundColor: meta.tintSoft }]}>
                  <View style={styles.classHeaderRight}>
                    <View style={[styles.classCircle, { backgroundColor: meta.tint }]}>
                      <Text style={styles.classCircleText}>{cls}</Text>
                    </View>
                    <View>
                      <Text style={[styles.classHeaderTitle, { color: meta.tint }]}>{meta.label}</Text>
                      <Text style={styles.classHeaderDesc}>{meta.desc}</Text>
                    </View>
                  </View>
                  <View style={styles.classHeaderStats}>
                    <Text style={[styles.classShare, { color: meta.tint }]}>{summary.revenueShare.toFixed(0)}%</Text>
                    <Text style={styles.classCount}>
                      {summary.count} {t.product}
                    </Text>
                  </View>
                </View>

                <View style={styles.classBody}>
                  {products.slice(0, 15).map((p, i) => (
                    <View key={p.productId}>
                      {i > 0 ? <View style={styles.rowDivider} /> : null}
                      <ProductRow p={p} tint={meta.tint} tintSoft={meta.tintSoft} topRevenue={topRevenue} />
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  rangeRow: { marginBottom: spacing.md },

  // ── الملخص العلوي ──────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  summaryStats: { flexDirection: 'row', alignItems: 'center' },
  summaryStat: { flex: 1, alignItems: 'center', gap: 2 },
  summaryVDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  summaryValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  summaryUnit: { fontSize: fontSize.xs, color: colors.textSecondary },
  distTitle: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'right' },
  distTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: radius.full },
  legendText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },

  // ── قسم الفئة ──────────────────────────────────────────────────────────────
  classSection: { marginTop: spacing.lg },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  classHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  classCircle: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  classCircleText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },
  classHeaderTitle: { fontSize: fontSize.md, fontWeight: '800', textAlign: 'right' },
  classHeaderDesc: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  classHeaderStats: { alignItems: 'center' },
  classShare: { fontSize: fontSize.lg, fontWeight: '800' },
  classCount: { fontSize: fontSize.xs, color: colors.textMuted },

  classBody: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  // ── صف المنتج ──────────────────────────────────────────────────────────────
  row: { paddingVertical: spacing.md, gap: spacing.sm },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // كتلة الاسم (اليمين): رتبة + عمود نص، تأخذ المساحة المتبقية
  rowInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rankBadge: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: fontSize.sm, fontWeight: '800' },
  textCol: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  rowMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  rowAmounts: { alignItems: 'flex-end', gap: 2 },
  rowRevenue: { fontSize: fontSize.md, fontWeight: '800', color: colors.text },
  rowProfit: { fontSize: fontSize.xs, color: colors.success, fontWeight: '600' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: radius.sm, minWidth: 6 },
  sharePct: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '700', width: 42, textAlign: 'left' },
})
