import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import {
  fetchOffersReport,
  type DateRange,
  type OfferPerformanceRow,
  type OfferStatus,
} from '@/api/endpoints/reports'
import { Card, SectionTitle } from '@/components/admin/Card'
import { ReportRangeFilter } from '@/components/admin/ReportRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
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
  usage: 'الاستخدام',
  revenue: 'الإيراد',
  discount: 'الخصم',
  shared: 'كل الفروع',
  openEnded: 'مفتوح',
  discountLabel: 'خصم',
  bogo: 'اشترِ واحصل',
}

const STATUS_META: Record<OfferStatus, { label: string; tint: string; tintSoft: string }> = {
  ACTIVE: { label: 'نشط', tint: colors.success, tintSoft: colors.successSoft },
  SCHEDULED: { label: 'مجدول', tint: colors.info, tintSoft: colors.infoSoft },
  EXPIRED: { label: 'منتهٍ', tint: colors.textSecondary, tintSoft: colors.background },
  DISABLED: { label: 'موقوف', tint: colors.danger, tintSoft: colors.dangerSoft },
}

type IconName = keyof typeof Ionicons.glyphMap

const TYPE_META: Record<string, { icon: IconName; tint: string; tintSoft: string }> = {
  PERCENTAGE_DISCOUNT: { icon: 'pricetag-outline', tint: colors.primary, tintSoft: colors.primarySoft },
  FIXED_DISCOUNT: { icon: 'cash-outline', tint: colors.success, tintSoft: colors.successSoft },
  BUY_X_GET_Y: { icon: 'gift-outline', tint: colors.violet, tintSoft: colors.violetSoft },
  DEFAULT: { icon: 'pricetags-outline', tint: colors.textSecondary, tintSoft: colors.background },
}

/** وصف مقروء لقيمة العرض حسب نوعه (نسبة / مبلغ ثابت / اشترِ واحصل). */
function discountDescriptor(o: OfferPerformanceRow): string {
  switch (o.type) {
    case 'PERCENTAGE_DISCOUNT':
      return `${t.discountLabel} ${Number(o.value)}%`
    case 'FIXED_DISCOUNT':
      return `${t.discountLabel} ${formatMoney(o.value)} ${ar.common.currency}`
    case 'BUY_X_GET_Y':
      return t.bogo
    default:
      return o.type
  }
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
      {/* فلتر الفترة الموحّد — الافتراضي خادميًا: آخر 30 يومًا */}
      <View style={styles.rangeRow}>
        <ReportRangeFilter onRangeChange={setRange} />
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
              unit={ar.common.currency}
            />
            <StatCard
              label={t.totalDiscount}
              value={formatMoney(q.data.summary.totalDiscount)}
              icon="remove-circle-outline"
              tint={colors.danger}
              tintSoft={colors.dangerSoft}
              unit={ar.common.currency}
            />
          </View>

          <SectionTitle>{`${t.list} (${q.data.summary.offerCount})`}</SectionTitle>
          {q.data.offers.length === 0 ? (
            <Card>
              <EmptyState message={t.noOffers} icon="pricetags-outline" />
            </Card>
          ) : (
            <View style={styles.offerList}>
              {q.data.offers.map(o => (
                <OfferCard key={o.id} o={o} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  )
}

/** بطاقة عرض واحد — رأس (نوع + اسم + حالة) ثم وصف الخصم ثم سطر الفرع/المدة ثم مقاييس. */
function OfferCard({ o }: { o: OfferPerformanceRow }) {
  const status = STATUS_META[o.status]
  const type = TYPE_META[o.type] ?? TYPE_META.DEFAULT
  const dateText = o.endDate
    ? `${formatDate(o.startDate)} ← ${formatDate(o.endDate)}`
    : `${formatDate(o.startDate)} • ${t.openEnded}`

  return (
    <View style={styles.offerCard}>
      {/* رأس البطاقة */}
      <View style={styles.offerHeader}>
        <View style={[styles.typeBadge, { backgroundColor: type.tintSoft }]}>
          <Ionicons name={type.icon} size={20} color={type.tint} />
        </View>
        <View style={styles.headText}>
          <View style={styles.titleRow}>
            <Text style={styles.offerName} numberOfLines={1}>
              {o.name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: status.tintSoft }]}>
              <View style={[styles.statusDot, { backgroundColor: status.tint }]} />
              <Text style={[styles.statusText, { color: status.tint }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={[styles.discountText, { color: type.tint }]} numberOfLines={1}>
            {discountDescriptor(o)}
          </Text>
        </View>
      </View>

      {/* الفرع والمدة */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="storefront-outline" size={13} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {o.branchName ?? t.shared}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {dateText}
          </Text>
        </View>
      </View>

      {/* المقاييس */}
      <View style={styles.metricsRow}>
        <OfferMetric icon="repeat-outline" tint={colors.violet} value={String(o.usageCount)} label={t.usage} />
        <View style={styles.metricDivider} />
        <OfferMetric icon="cash-outline" tint={colors.success} value={formatMoney(o.revenue)} label={t.revenue} />
        <View style={styles.metricDivider} />
        <OfferMetric icon="pricetag-outline" tint={colors.warning} value={formatMoney(o.discount)} label={t.discount} />
      </View>
    </View>
  )
}

function OfferMetric({
  icon,
  tint,
  value,
  label,
}: {
  icon: IconName
  tint: string
  value: string
  label: string
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={15} color={tint} />
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  rangeRow: { marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  offerList: { gap: spacing.md },

  // ── بطاقة العرض ──────────────────────────────────────────────────────────────
  offerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  offerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  typeBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offerName: { flex: 1, fontSize: fontSize.md, fontWeight: '800', color: colors.text, textAlign: 'right' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusDot: { width: 6, height: 6, borderRadius: radius.full },
  statusText: { fontSize: fontSize.xs, fontWeight: '700' },
  discountText: { fontSize: fontSize.sm, fontWeight: '700', textAlign: 'right' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted, flexShrink: 1 },

  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  metric: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: spacing.xs },
  metricDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
  metricValue: { fontSize: fontSize.sm, fontWeight: '800', color: colors.text },
  metricLabel: { fontSize: fontSize.xs, color: colors.textMuted },
})
