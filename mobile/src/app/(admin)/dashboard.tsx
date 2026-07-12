import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import {
  fetchDashboard,
  fetchExpiryReport,
  fetchInventoryAlerts,
  fetchProfit,
  fetchShiftsReport,
} from '@/api/endpoints/reports'
import { Card, SectionTitle } from '@/components/admin/Card'
import { BarChart } from '@/components/admin/BarChart'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { useFeature } from '@/hooks/useFeature'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatMoney } from '@/utils/format'

const t = {
  title: 'الرئيسية',
  greetingMorning: 'صباح الخير',
  greetingEvening: 'مساء الخير',
  todaySales: 'مبيعات اليوم',
  todayProfit: 'ربح اليوم',
  invoiceCount: 'عدد الفواتير',
  returnsToday: 'مرتجعات اليوم',
  weeklyChart: 'مبيعات آخر 7 أيام',
  openShifts: 'الورديات المفتوحة',
  noOpenShifts: 'لا توجد ورديات مفتوحة الآن',
  alerts: 'تنبيهات المخزون',
  lowStock: 'منتجات منخفضة',
  nearExpiry: 'قريبة الانتهاء',
  quickLinks: 'روابط سريعة',
  approvals: 'الموافقات',
  users: 'المستخدمون',
  assistant: 'المساعد الذكي',
  inventoryOverview: 'نظرة المخزون',
}

export default function AdminDashboard() {
  const router = useRouter()
  const aiEnabled = useFeature('ai_assistant')
  const user = useAuthStore(s => s.user)
  const { selectedBranchId, selectedBranchName } = useBranchSelection()
  const bid = selectedBranchId

  // أرقام مالية → staleTime: 0 (الافتراضي في queryClient) + سحب للتحديث (SC-004)
  const dashQ = useQuery({ queryKey: ['admin-dashboard', bid], queryFn: () => fetchDashboard(bid) })
  const profitQ = useQuery({ queryKey: ['admin-profit', 'daily', bid], queryFn: () => fetchProfit('daily', bid) })
  const alertsQ = useQuery({ queryKey: ['admin-alerts', bid], queryFn: () => fetchInventoryAlerts(bid) })
  const expiryQ = useQuery({ queryKey: ['admin-expiry', bid, '30'], queryFn: () => fetchExpiryReport(bid) })
  const shiftsQ = useQuery({ queryKey: ['admin-shifts-report', bid], queryFn: () => fetchShiftsReport(bid) })

  const refreshing =
    dashQ.isRefetching || profitQ.isRefetching || alertsQ.isRefetching || expiryQ.isRefetching || shiftsQ.isRefetching

  const onRefresh = () => {
    void dashQ.refetch()
    void profitQ.refetch()
    void alertsQ.refetch()
    void expiryQ.refetch()
    void shiftsQ.refetch()
  }

  const branchBadge = (
    <View style={styles.branchBadge}>
      <Ionicons name="storefront-outline" size={14} color={colors.primary} />
      <Text style={styles.branchBadgeText} numberOfLines={1}>
        {selectedBranchName}
      </Text>
    </View>
  )

  if (dashQ.isPending) {
    return (
      <Screen title={t.title} headerAction={branchBadge} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (dashQ.isError) {
    return (
      <Screen title={t.title} headerAction={branchBadge} scroll={false}>
        <ErrorState error={dashQ.error} onRetry={() => void dashQ.refetch()} />
      </Screen>
    )
  }

  const dash = dashQ.data
  const openShifts = (shiftsQ.data ?? []).filter(s => !s.closedAt)
  const lowStockCount = alertsQ.data?.lowStock.length ?? 0
  const nearExpiryCount = expiryQ.data?.stats.total ?? 0

  const goInventory = () => router.push('/(admin)/inventory' as never)

  const greeting = new Date().getHours() < 12 ? t.greetingMorning : t.greetingEvening

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* ── الهيدر البطولي (نيلي → بنفسجي) ── */}
      <LinearGradient
        colors={[colors.gradientFrom, colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroGreeting}>{greeting} 👋</Text>
            <Text style={styles.heroName} numberOfLines={1}>
              {user?.tenantName || user?.username || ar.appName}
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Ionicons name="storefront-outline" size={14} color={colors.onPrimary} />
            <Text style={styles.heroBadgeText} numberOfLines={1}>
              {selectedBranchName}
            </Text>
          </View>
        </View>
        <Text style={styles.heroHint}>{t.title} · {ar.common.today}</Text>
      </LinearGradient>

      {/* ── بطاقات اليوم ── */}
      <View style={styles.statsRow}>
        <StatCard
          label={t.todaySales}
          value={formatMoney(dash.today.sales)}
          icon="cash-outline"
          hint={ar.common.currency}
        />
        <StatCard
          label={t.todayProfit}
          value={profitQ.isPending ? '…' : formatMoney(profitQ.data?.netProfit ?? 0)}
          icon="trending-up"
          tint={colors.success}
          tintSoft={colors.successSoft}
          hint={ar.common.currency}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          label={t.invoiceCount}
          value={String(dash.today.txCount)}
          icon="receipt-outline"
          tint={colors.violet}
          tintSoft={colors.violetSoft}
        />
        <StatCard
          label={t.returnsToday}
          value={formatMoney(dash.today.returns)}
          icon="return-down-back-outline"
          tint={colors.warning}
          tintSoft={colors.warningSoft}
          hint={ar.common.currency}
        />
      </View>

      {/* ── مبيعات الأسبوع (مخطط أعمدة يدوي) ── */}
      <SectionTitle>{t.weeklyChart}</SectionTitle>
      <Card>
        <BarChart data={dash.sparkline.map(p => ({ label: p.label, value: p.total }))} />
      </Card>

      {/* ── تنبيهات المخزون ── */}
      <SectionTitle>{t.alerts}</SectionTitle>
      <View style={styles.statsRow}>
        <Pressable style={styles.flex1} onPress={goInventory}>
          <StatCard
            label={t.lowStock}
            value={lowStockCount >= 10 ? '+10' : String(lowStockCount)}
            icon="alert-circle-outline"
            tint={colors.danger}
            tintSoft={colors.dangerSoft}
            hint={t.inventoryOverview}
          />
        </Pressable>
        <Pressable style={styles.flex1} onPress={goInventory}>
          <StatCard
            label={t.nearExpiry}
            value={String(nearExpiryCount)}
            icon="hourglass-outline"
            tint={colors.warning}
            tintSoft={colors.warningSoft}
            hint={t.inventoryOverview}
          />
        </Pressable>
      </View>

      {/* ── الورديات المفتوحة ── */}
      <SectionTitle>{t.openShifts}</SectionTitle>
      <Card>
        {shiftsQ.isError ? (
          <ErrorState error={shiftsQ.error} onRetry={() => void shiftsQ.refetch()} />
        ) : openShifts.length === 0 ? (
          <EmptyState message={t.noOpenShifts} icon="time-outline" />
        ) : (
          openShifts.map((s, i) => (
            <View key={s.id} style={[styles.shiftRow, i > 0 && styles.rowDivider]}>
              <View style={styles.shiftInfo}>
                <Text style={styles.shiftName}>{s.user?.username ?? '—'}</Text>
                <Text style={styles.shiftMeta}>{s.branchName}</Text>
              </View>
              <View style={styles.shiftSalesWrap}>
                <Text style={styles.shiftSales}>{formatMoney(s.totalSales)}</Text>
                <Text style={styles.shiftMeta}>{s.txCount} فاتورة</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* ── روابط سريعة ── */}
      <SectionTitle>{t.quickLinks}</SectionTitle>
      <View style={styles.linksRow}>
        <QuickLink icon="checkmark-done-outline" label={t.approvals} onPress={() => router.push('/(admin)/approvals' as never)} />
        <QuickLink icon="people-outline" label={t.users} onPress={() => router.push('/(admin)/users' as never)} />
        {aiEnabled ? (
          <QuickLink icon="sparkles-outline" label={t.assistant} onPress={() => router.push('/(admin)/assistant' as never)} />
        ) : null}
      </View>
    </Screen>
  )
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable style={styles.quickLink} onPress={onPress}>
      <View style={styles.quickLinkIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.quickLinkText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  hero: {
    borderRadius: radius.xxl,
    padding: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.md,
    ...shadow.button,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  heroTextWrap: { flex: 1, gap: spacing.xs },
  heroGreeting: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.md, fontWeight: '600', textAlign: 'right' },
  heroName: { color: colors.onPrimary, fontSize: fontSize.title, fontWeight: '800', textAlign: 'right', letterSpacing: -0.3 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    maxWidth: 150,
  },
  heroBadgeText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  heroHint: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm, textAlign: 'right' },
  branchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    maxWidth: 160,
  },
  branchBadgeText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  shiftInfo: { flex: 1, gap: 2 },
  shiftName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, textAlign: 'right' },
  shiftMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  shiftSalesWrap: { alignItems: 'flex-end', gap: 2 },
  shiftSales: { fontSize: fontSize.md, fontWeight: '700', color: colors.success },
  linksRow: { flexDirection: 'row', gap: spacing.md },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  quickLinkIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
})
