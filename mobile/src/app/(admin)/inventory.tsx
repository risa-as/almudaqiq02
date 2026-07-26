import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { fetchExpiryReport, fetchInventoryAlerts, type ExpiryBatchRow } from '@/api/endpoints/reports'
import { Card } from '@/components/admin/Card'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Hero, type HeroChip } from '@/components/Hero'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDate, formatMoney } from '@/utils/format'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const t = {
  title: 'نظرة المخزون',
  heroGreeting: 'متابعة النقص والصلاحية أولًا بأول',
  statusHealthy: 'كل شيء سليم',
  alertsChip: (n: number) => `${n} تنبيه`,
  lowStockCount: 'منتجات منخفضة',
  lowStockHint: 'تحت الحد الأدنى',
  nearExpiryCount: 'دفعات قريبة الانتهاء',
  nearExpiryHint: 'خلال 30 يومًا',
  valueAtRisk: 'قيمة معرضة للتلف',
  riskExpired: 'منتهية',
  riskCritical: 'حرجة',
  riskWarning: 'تحذير',
  healthyTitle: 'المخزون بصحة جيدة',
  healthyHint: 'لا توجد تنبيهات نقص أو صلاحية حاليًا — استمر بالعمل باطمئنان',
  lowStockList: 'الأدنى مخزونًا',
  nearExpiryList: 'الأقرب انتهاءً (خلال 30 يومًا)',
  noExpiry: 'لا توجد دفعات قريبة الانتهاء',
  currentStock: 'المتوفر',
  minStock: 'الحد الأدنى',
  outOfStock: 'نفد',
  qty: 'الكمية',
  value: 'القيمة',
  expiryDateLabel: 'تاريخ الانتهاء',
  expired: 'منتهية',
  today: 'ينتهي اليوم',
  daysLeft: (n: number) => `متبقٍ ${n} يوم`,
  showingOf: (shown: number, total: number) => `يتم عرض أول ${shown} من ${total} دفعة`,
}

/** درجة استعجال الدفعة: لون + أيقونة + نص الحالة (منتهية / ينتهي اليوم / متبقٍ N يوم). */
function expiryTone(b: ExpiryBatchRow): {
  tint: string
  soft: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
} {
  const expired = b.urgency === 'expired' || b.daysLeft === null || b.daysLeft < 0
  if (expired) return { tint: colors.danger, soft: colors.dangerSoft, icon: 'close-circle', label: t.expired }
  const label = b.daysLeft === 0 ? t.today : t.daysLeft(b.daysLeft as number)
  if (b.urgency === 'critical') return { tint: colors.danger, soft: colors.dangerSoft, icon: 'alert-circle', label }
  return { tint: colors.warning, soft: colors.warningSoft, icon: 'time-outline', label }
}

/** إحصائية صغيرة معنونة داخل شريط تفاصيل الدفعة (تسمية أعلى + أيقونة وقيمة أسفل). */
function MetaStat({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  return (
    <View style={styles.metaStat}>
      <Text style={styles.metaLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.metaValueRow}>
        <Ionicons name={icon} size={13} color={colors.textSecondary} />
        <Text style={styles.metaValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {value}
        </Text>
      </View>
    </View>
  )
}

const EXPIRY_LIST_LIMIT = 20

export default function AdminInventoryOverview() {
  const { selectedBranchId, selectedBranchName } = useBranchSelection()
  const bid = selectedBranchId

  const alertsQ = useQuery({ queryKey: ['admin-alerts', bid], queryFn: () => fetchInventoryAlerts(bid) })
  const expiryQ = useQuery({ queryKey: ['admin-expiry', bid, '30'], queryFn: () => fetchExpiryReport(bid) })

  const loading = alertsQ.isPending || expiryQ.isPending
  const refreshing = alertsQ.isRefetching || expiryQ.isRefetching
  const onRefresh = () => {
    void alertsQ.refetch()
    void expiryQ.refetch()
  }

  const lowStock = alertsQ.data?.lowStock ?? []
  const expiry = expiryQ.isError ? null : (expiryQ.data ?? null)
  const nearExpiryTotal = expiry?.stats.total ?? 0
  const alertsTotal = lowStock.length + nearExpiryTotal
  const isHealthy = !loading && !alertsQ.isError && !expiryQ.isError && alertsTotal === 0

  // شريحة الحالة في الهيدر: سليم ✓ أو عدد التنبيهات — تظهر بعد وصول البيانات فقط
  const chips: HeroChip[] = [
    { icon: 'calendar-outline', text: formatDate(new Date()) },
    { icon: 'storefront-outline', text: selectedBranchName },
  ]
  if (!loading && !alertsQ.isError) {
    chips.push(
      isHealthy
        ? { icon: 'shield-checkmark-outline', text: t.statusHealthy }
        : { icon: 'notifications-outline', text: t.alertsChip(alertsTotal) },
    )
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* ── الهيدر البطولي المشترك (نفس هوية الرئيسية) ── */}
      <Hero greeting={t.heroGreeting} title={t.title} icon="cube" chips={chips} />

      {loading ? (
        <LoadingView />
      ) : alertsQ.isError ? (
        <ErrorState error={alertsQ.error} onRetry={() => void alertsQ.refetch()} />
      ) : isHealthy ? (
        /* ── حالة سليمة: بطاقة احتفالية بدل أقسام فارغة ── */
        <View style={styles.healthyCard}>
          <View style={styles.healthyIconRing}>
            <View style={styles.healthyIcon}>
              <Ionicons name="shield-checkmark" size={30} color={colors.success} />
            </View>
          </View>
          <Text style={styles.healthyTitle}>{t.healthyTitle}</Text>
          <Text style={styles.healthyHint}>{t.healthyHint}</Text>
        </View>
      ) : (
        <>
          {/* ── إجماليات ── */}
          <View style={styles.statsRow}>
            <StatCard
              label={t.lowStockCount}
              value={lowStock.length >= 10 ? '+10' : String(lowStock.length)}
              icon="alert-circle-outline"
              tint={colors.danger}
              tintSoft={colors.dangerSoft}
              hint={t.lowStockHint}
            />
            <StatCard
              label={t.nearExpiryCount}
              value={expiryQ.isError ? '—' : String(nearExpiryTotal)}
              icon="hourglass-outline"
              tint={colors.warning}
              tintSoft={colors.warningSoft}
              hint={t.nearExpiryHint}
            />
          </View>

          {/* ── القيمة المعرضة للتلف + توزيع الاستعجال (تُخفى عندما لا خطر) ── */}
          {expiry && nearExpiryTotal > 0 ? <RiskCard stats={expiry.stats} /> : null}

          {/* ── قائمة المنخفض — يُخفى القسم كليًا عندما لا نقص ── */}
          {lowStock.length > 0 ? (
            <>
              <SectionHeader
                icon="trending-down-outline"
                title={t.lowStockList}
                count={lowStock.length}
                tint={colors.danger}
                tintSoft={colors.dangerSoft}
              />
              <Card>
                {lowStock.map((p, i) => {
                  const min = p.minimumStock > 0 ? p.minimumStock : 10
                  const out = p.baseStock <= 0
                  const tint = out ? colors.danger : colors.warning
                  const soft = out ? colors.dangerSoft : colors.warningSoft
                  return (
                    <View key={p.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                      <View style={[styles.prodIcon, { backgroundColor: soft }]}>
                        <Ionicons name="cube-outline" size={18} color={tint} />
                      </View>
                      <View style={styles.rowInfo}>
                        <View style={styles.rowTitleRow}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {p.name}
                          </Text>
                          {out ? (
                            <View style={styles.outChip}>
                              <Text style={styles.outChipText}>{t.outOfStock}</Text>
                            </View>
                          ) : null}
                        </View>
                        <StockBar current={p.baseStock} min={min} />
                        <Text style={styles.rowMeta}>
                          {t.minStock}: {formatMoney(min)}
                        </Text>
                      </View>
                      <View style={[styles.qtyBox, { backgroundColor: soft }]}>
                        <Text style={[styles.qtyValue, { color: tint }]}>{formatMoney(p.baseStock)}</Text>
                        <Text style={[styles.qtyLabel, { color: tint }]}>{t.currentStock}</Text>
                      </View>
                    </View>
                  )
                })}
              </Card>
            </>
          ) : null}

          {/* ── قائمة قرب الانتهاء — بطاقات مستقلة مرمّزة بالاستعجال ── */}
          {expiryQ.isError ? (
            <>
              <SectionHeader icon="hourglass-outline" title={t.nearExpiryList} tint={colors.warning} tintSoft={colors.warningSoft} />
              <Card>
                <ErrorState error={expiryQ.error} onRetry={() => void expiryQ.refetch()} />
              </Card>
            </>
          ) : expiry && expiry.batches.length > 0 ? (
            <>
              <SectionHeader
                icon="hourglass-outline"
                title={t.nearExpiryList}
                count={nearExpiryTotal}
                tint={colors.warning}
                tintSoft={colors.warningSoft}
              />
              <View style={styles.expiryList}>
                {expiry.batches.slice(0, EXPIRY_LIST_LIMIT).map(b => {
                  const tone = expiryTone(b)
                  return (
                    <View key={b.id} style={styles.expiryCard}>
                      <View style={[styles.expiryAccent, { backgroundColor: tone.tint }]} />
                      <View style={styles.expiryContent}>
                        {/* رأس: اسم المنتج + شارة الحالة */}
                        <View style={styles.expiryHead}>
                          <View style={styles.expiryTitleWrap}>
                            <Text style={styles.expiryName} numberOfLines={1}>
                              {b.productName}
                            </Text>
                            {b.category ? (
                              <View style={styles.catChip}>
                                <Text style={styles.catChipText} numberOfLines={1}>
                                  {b.category}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={[styles.statusPill, { backgroundColor: tone.soft }]}>
                            <Ionicons name={tone.icon} size={13} color={tone.tint} />
                            <Text style={[styles.statusText, { color: tone.tint }]} numberOfLines={1}>
                              {tone.label}
                            </Text>
                          </View>
                        </View>

                        {/* شريط التفاصيل المعنون */}
                        <View style={styles.metaPanel}>
                          <MetaStat icon="calendar-outline" label={t.expiryDateLabel} value={formatDate(b.expiryDate)} />
                          <View style={styles.metaSep} />
                          <MetaStat icon="cube-outline" label={t.qty} value={formatMoney(b.quantity)} />
                          <View style={styles.metaSep} />
                          <MetaStat
                            icon="cash-outline"
                            label={t.value}
                            value={`${formatMoney(b.totalValue)} ${ar.common.currency}`}
                          />
                        </View>

                        {b.branchName !== '—' ? (
                          <View style={styles.branchRow}>
                            <Ionicons name="storefront-outline" size={12} color={colors.textMuted} />
                            <Text style={styles.branchText} numberOfLines={1}>
                              {b.branchName}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )
                })}
                {expiry.batches.length > EXPIRY_LIST_LIMIT ? (
                  <Text style={styles.listFooter}>{t.showingOf(EXPIRY_LIST_LIMIT, expiry.batches.length)}</Text>
                ) : null}
              </View>
            </>
          ) : (
            <>
              <SectionHeader icon="hourglass-outline" title={t.nearExpiryList} tint={colors.warning} tintSoft={colors.warningSoft} />
              <Card>
                <EmptyState message={t.noExpiry} icon="checkmark-circle-outline" />
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  )
}

/** بطاقة القيمة المعرضة للتلف مع شريط توزيع الاستعجال (منتهية/حرجة/تحذير). */
function RiskCard({ stats }: { stats: { totalValueAtRisk: number; expiredCount: number; criticalCount: number; warningCount: number } }) {
  const segments = [
    { count: stats.expiredCount, color: colors.danger, label: t.riskExpired, soft: colors.dangerSoft },
    { count: stats.criticalCount, color: colors.warning, label: t.riskCritical, soft: colors.warningSoft },
    { count: stats.warningCount, color: colors.info, label: t.riskWarning, soft: colors.infoSoft },
  ].filter(s => s.count > 0)
  const total = segments.reduce((sum, s) => sum + s.count, 0)

  return (
    <Card style={styles.riskCard}>
      <View style={styles.riskHeader}>
        <View style={styles.riskIcon}>
          <Ionicons name="warning-outline" size={20} color={colors.violet} />
        </View>
        <View style={styles.riskTextWrap}>
          <Text style={styles.riskLabel}>{t.valueAtRisk}</Text>
          <View style={styles.riskValueRow}>
            <Text style={styles.riskValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(stats.totalValueAtRisk)}
            </Text>
            <Text style={styles.riskCurrency}>{ar.common.currency}</Text>
          </View>
        </View>
      </View>

      {total > 0 ? (
        <>
          <View style={styles.riskBar}>
            {segments.map((s, i) => (
              <View key={i} style={[styles.riskSegment, { flex: s.count, backgroundColor: s.color }]} />
            ))}
          </View>
          <View style={styles.riskLegend}>
            {segments.map((s, i) => (
              <View key={i} style={[styles.riskChip, { backgroundColor: s.soft }]}>
                <View style={[styles.riskDot, { backgroundColor: s.color }]} />
                <Text style={[styles.riskChipText, { color: s.color }]}>
                  {s.label} {s.count}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Card>
  )
}

/** شريط تقدّم صغير: المتوفر مقابل الحد الأدنى (أحمر تحت النصف، كهرماني فوقه). */
function StockBar({ current, min }: { current: number; min: number }) {
  const ratio = Math.max(0, Math.min(current / Math.max(min, 1), 1))
  const color = ratio < 0.5 ? colors.danger : colors.warning
  return (
    <View style={styles.stockBarTrack}>
      <View style={[styles.stockBarFill, { width: `${Math.max(ratio * 100, 3)}%`, backgroundColor: color }]} />
    </View>
  )
}

/** رأس قسم موحّد: أيقونة داخل صندوق ملوّن + عنوان + شارة عدد — نفس نمط لوحة التحكم. */
function SectionHeader({
  icon,
  title,
  count,
  tint = colors.primary,
  tintSoft = colors.primarySoft,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  count?: number
  tint?: string
  tintSoft?: string
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderRight}>
        <View style={[styles.sectionIcon, { backgroundColor: tintSoft }]}>
          <Ionicons name={icon} size={15} color={tint} />
        </View>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
      </View>
      {typeof count === 'number' ? (
        <View style={[styles.sectionCount, { backgroundColor: tintSoft }]}>
          <Text style={[styles.sectionCountText, { color: tint }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // ── الحالة السليمة ──
  healthyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
  healthyIconRing: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  healthyIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  healthyTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'center' },
  healthyHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },

  // ── بطاقة القيمة المعرضة للتلف ──
  riskCard: { gap: spacing.md },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  riskIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskTextWrap: { flex: 1, gap: 2 },
  riskLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  riskValueRow: { flexDirection: ROW, alignItems: 'baseline', gap: 4 },
  riskValue: { flexShrink: 1, color: colors.violet, fontSize: fontSize.xl, fontWeight: '800', textAlign: 'right' },
  riskCurrency: { color: colors.violet, fontSize: fontSize.xs, fontWeight: '700' },
  riskBar: {
    flexDirection: ROW,
    height: 8,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.borderSoft,
    gap: 2,
  },
  riskSegment: { borderRadius: radius.sm },
  riskLegend: { flexDirection: ROW, flexWrap: 'wrap', gap: spacing.sm },
  riskChip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  riskDot: { width: 7, height: 7, borderRadius: radius.full },
  riskChipText: { fontSize: fontSize.xs, fontWeight: '700' },

  // ── رؤوس الأقسام ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  sectionCount: {
    minWidth: 24,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  sectionCountText: { fontSize: fontSize.xs, fontWeight: '800' },

  // ── صفوف الأدنى مخزونًا ──
  // ROW يضع أيقونة المنتج والاسم في جهة اليمين وصندوق الكمية في اليسار مهما كان اتجاه النظام
  row: {
    flexDirection: ROW,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  prodIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1, gap: 4, alignItems: ALIGN_RIGHT },
  rowTitleRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm, maxWidth: '100%' },
  rowTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, textAlign: 'right', flexShrink: 1 },
  outChip: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  outChipText: { fontSize: fontSize.xs, fontWeight: '800', color: colors.onPrimary },
  rowMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },

  qtyBox: {
    minWidth: 64,
    alignItems: 'center',
    gap: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  qtyValue: { fontSize: fontSize.lg, fontWeight: '800' },
  qtyLabel: { fontSize: fontSize.xs, fontWeight: '600' },

  stockBarTrack: {
    // alignSelf: stretch يلغي alignItems للأب (وإلا انكمش الشريط إلى عرض صفر لأنه بلا عرض ذاتي)،
    // و flexDirection: ROW يجعل التعبئة تبدأ من اليمين.
    alignSelf: 'stretch',
    flexDirection: ROW,
    height: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.borderSoft,
    overflow: 'hidden',
  },
  stockBarFill: { height: '100%', borderRadius: radius.sm },

  // ── بطاقات قرب الانتهاء ──
  expiryList: { gap: spacing.sm },
  expiryCard: {
    flexDirection: ROW,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    ...shadow.card,
  },
  // شريط لوني رفيع على الحافة اليمنى (بادئة القراءة) يرمز لدرجة الاستعجال
  expiryAccent: { width: 4, alignSelf: 'stretch' },
  expiryContent: { flex: 1, padding: spacing.md, gap: spacing.sm },

  expiryHead: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  expiryTitleWrap: { flex: 1, gap: 4, alignItems: ALIGN_RIGHT },
  expiryName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  catChip: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  catChipText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },
  statusPill: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  statusText: { fontSize: fontSize.xs, fontWeight: '800' },

  metaPanel: {
    flexDirection: ROW,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  metaStat: { flex: 1, gap: 3, alignItems: ALIGN_RIGHT },
  metaLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textAlign: 'right' },
  metaValueRow: { flexDirection: ROW, alignItems: 'center', alignSelf: 'stretch', gap: spacing.xs },
  metaValue: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'right' },
  metaSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: spacing.sm },

  branchRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  branchText: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },

  listFooter: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingTop: spacing.sm,
  },
})
