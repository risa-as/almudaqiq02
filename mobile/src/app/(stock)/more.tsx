import { StyleSheet, Text, View, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { fetchExpiryReport, fetchInventoryAlerts, type ExpiryUrgency } from '@/api/endpoints/inventory'
import { AccountCard } from '@/components/AccountCard'
import { Screen } from '@/components/Screen'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDate } from '@/utils/format'

const S = {
  alerts: 'التنبيهات',
  lowStock: 'منتجات تحت الحد الأدنى',
  nearExpiry: 'دفعات تقترب صلاحيتها من الانتهاء',
  noLowStock: 'لا توجد منتجات تحت الحد الأدنى',
  noNearExpiry: 'لا توجد دفعات قريبة الانتهاء',
  loading: 'جارٍ التحميل…',
  loadFailed: 'تعذر تحميل التنبيهات',
  currentStock: 'الرصيد',
  minStock: 'الحد الأدنى',
  qty: 'الكمية',
  expired: 'منتهية',
  daysLeft: (d: number) => `متبقٍ ${d} يوم`,
  navigate: 'أقسام أخرى',
  transfers: 'التحويلات بين الفروع',
  suppliers: 'الموردون',
}

const MAX_ROWS = 8

function urgencyColor(u: ExpiryUrgency): string {
  switch (u) {
    case 'expired':
      return colors.danger
    case 'critical':
      return colors.danger
    case 'warning':
      return colors.warning
    default:
      return colors.textSecondary
  }
}

export default function StockMore() {
  const branchId = useAuthStore(s => s.user?.branchId ?? null)

  const alertsQuery = useQuery({
    queryKey: ['inventory-alerts', branchId],
    queryFn: () => fetchInventoryAlerts(branchId),
  })

  const expiryQuery = useQuery({
    queryKey: ['inventory-expiry', '30', branchId],
    queryFn: () => fetchExpiryReport('30', branchId),
  })

  const lowStock = alertsQuery.data?.lowStock ?? []
  const expiryRows = (expiryQuery.data?.batches ?? []).slice(0, MAX_ROWS)

  return (
    <Screen
      title={ar.tabs.more}
      refreshing={alertsQuery.isRefetching || expiryQuery.isRefetching}
      onRefresh={() => {
        alertsQuery.refetch()
        expiryQuery.refetch()
      }}
    >
      {/* ── التنبيهات: تحت الحد الأدنى ── */}
      <Text style={styles.sectionTitle}>{S.alerts}</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="trending-down" size={18} color={colors.warning} />
          </View>
          <Text style={styles.cardTitle}>{S.lowStock}</Text>
          {lowStock.length > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: colors.warningSoft }]}>
              <Text style={[styles.countText, { color: colors.warning }]}>{lowStock.length}</Text>
            </View>
          ) : null}
        </View>
        {alertsQuery.isLoading ? (
          <Text style={styles.hint}>{S.loading}</Text>
        ) : alertsQuery.isError ? (
          <Text style={[styles.hint, { color: colors.danger }]}>{S.loadFailed}</Text>
        ) : lowStock.length === 0 ? (
          <Text style={[styles.hint, { color: colors.success }]}>{S.noLowStock}</Text>
        ) : (
          lowStock.slice(0, MAX_ROWS).map(p => (
            <View key={p.id} style={styles.alertRow}>
              <Text style={styles.alertName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.alertMeta}>
                {S.currentStock}: <Text style={{ color: colors.danger, fontWeight: '800' }}>{p.baseStock}</Text>
                {'  •  '}
                {S.minStock}: {p.minimumStock > 0 ? p.minimumStock : 10}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ── التنبيهات: قرب انتهاء الصلاحية ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="time-outline" size={18} color={colors.danger} />
          </View>
          <Text style={styles.cardTitle}>{S.nearExpiry}</Text>
          {expiryQuery.data && expiryQuery.data.batches.length > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: colors.dangerSoft }]}>
              <Text style={[styles.countText, { color: colors.danger }]}>{expiryQuery.data.batches.length}</Text>
            </View>
          ) : null}
        </View>
        {expiryQuery.isLoading ? (
          <Text style={styles.hint}>{S.loading}</Text>
        ) : expiryQuery.isError ? (
          <Text style={[styles.hint, { color: colors.danger }]}>{S.loadFailed}</Text>
        ) : expiryRows.length === 0 ? (
          <Text style={[styles.hint, { color: colors.success }]}>{S.noNearExpiry}</Text>
        ) : (
          expiryRows.map(b => (
            <View key={b.id} style={styles.alertRow}>
              <View style={styles.expiryTop}>
                <Text style={styles.alertName} numberOfLines={1}>{b.productName}</Text>
                <Text style={[styles.expiryDays, { color: urgencyColor(b.urgency) }]}>
                  {b.daysLeft === null ? '—' : b.daysLeft < 0 ? S.expired : S.daysLeft(b.daysLeft)}
                </Text>
              </View>
              <Text style={styles.alertMeta}>
                {S.qty}: {b.quantity} • {formatDate(b.expiryDate)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ── روابط الأقسام ── */}
      <Text style={styles.sectionTitle}>{S.navigate}</Text>

      <Pressable style={styles.navRow} onPress={() => router.push('/(stock)/transfers')}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
        </View>
        <Text style={styles.navLabel}>{S.transfers}</Text>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable style={styles.navRow} onPress={() => router.push('/(stock)/suppliers')}>
        <View style={[styles.iconWrap, { backgroundColor: colors.violetSoft }]}>
          <Ionicons name="people" size={18} color={colors.violet} />
        </View>
        <Text style={styles.navLabel}>{S.suppliers}</Text>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
      </Pressable>

      {/* بطاقة الحساب وتسجيل الخروج تبقى في الأسفل (FR-005) */}
      <View style={styles.accountWrap}>
        <AccountCard />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '700', textAlign: 'right' },
  countBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  countText: { fontSize: fontSize.xs, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.sm },
  alertRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 2,
  },
  alertName: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  alertMeta: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right' },
  expiryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  expiryDays: { fontSize: fontSize.xs, fontWeight: '800' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  navLabel: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: '600', textAlign: 'right' },
  accountWrap: { marginTop: spacing.md },
})
