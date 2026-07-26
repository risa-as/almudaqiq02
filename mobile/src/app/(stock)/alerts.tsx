import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  fetchExpiryReport,
  fetchInventoryAlerts,
  type ExpiryRow,
  type LowStockAlert,
} from '@/api/endpoints/inventory'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ExpiringBatchRow, LowStockRow } from '@/components/stock/AlertRows'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { useAuthStore } from '@/stores/auth'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { ROW } from '@/utils/rtl'

const S = {
  title: 'التنبيهات',
  subtitle: 'كل تنبيهات فرعك',
  all: 'الكل',
  lowStock: 'تحت الحد الأدنى',
  nearExpiry: 'قرب انتهاء الصلاحية',
  lowStockSection: 'منتجات تحت الحد الأدنى',
  nearExpirySection: 'دفعات تقترب صلاحيتها من الانتهاء',
  empty: 'لا توجد تنبيهات — كل شيء ضمن الحدود',
}

type Filter = 'all' | 'low' | 'expiry'

/** عنصر قائمة موحّد: نوعه يحدّد أي صفّ يُرسم. */
type AlertEntry =
  | { kind: 'low'; key: string; low: LowStockAlert }
  | { kind: 'expiry'; key: string; expiry: ExpiryRow }

/**
 * شاشة التنبيهات الكاملة — تعرض كل المنتجات تحت الحد الأدنى وكل الدفعات القريبة
 * من الانتهاء، بلا اقتطاع (تبويب «المزيد» يعرض معاينة مختصرة فقط).
 */
export default function StockAlerts() {
  const params = useLocalSearchParams<{ tab?: string }>()
  const initialFilter: Filter = params.tab === 'low' || params.tab === 'expiry' ? params.tab : 'all'
  const [filter, setFilter] = useState<Filter>(initialFilter)
  // مسار التنبيهات لا يقيّد بالفرع تلقائيًا — يجب تمرير الفرع صراحةً
  const branchId = useAuthStore(s => s.user?.branchId ?? null)

  // مفتاح مستقل بلاحقة 'full': الحمولة أكبر من معاينة «المزيد» فلا يجوز أن يدهسها
  const alertsQuery = useQuery({
    queryKey: ['inventory-alerts', branchId, 'full'],
    queryFn: () => fetchInventoryAlerts(branchId, true),
  })
  // نفس مفتاح المعاينة — البيانات ذاتها غير مقتطعة أصلًا، فتُشارَك الذاكرة
  const expiryQuery = useQuery({
    queryKey: ['inventory-expiry', '30', branchId],
    queryFn: () => fetchExpiryReport('30', branchId),
  })

  // useMemo لا لتحسين الأداء بل لتثبيت المرجع: `?? []` ينتج مصفوفة جديدة كل رسم
  const lowStock = useMemo(() => alertsQuery.data?.lowStock ?? [], [alertsQuery.data])
  const expiring = useMemo(() => expiryQuery.data?.batches ?? [], [expiryQuery.data])

  const sections = useMemo(() => {
    const out: { title: string; count: number; data: AlertEntry[] }[] = []
    if (filter !== 'expiry' && lowStock.length > 0) {
      out.push({
        title: S.lowStockSection,
        count: lowStock.length,
        data: lowStock.map(low => ({ kind: 'low' as const, key: `low:${low.id}`, low })),
      })
    }
    if (filter !== 'low' && expiring.length > 0) {
      out.push({
        title: S.nearExpirySection,
        count: expiring.length,
        data: expiring.map(expiry => ({ kind: 'expiry' as const, key: `exp:${expiry.id}`, expiry })),
      })
    }
    return out
  }, [filter, lowStock, expiring])

  const isPending = alertsQuery.isPending || expiryQuery.isPending
  const error = alertsQuery.error ?? expiryQuery.error
  const refetchAll = () => {
    void alertsQuery.refetch()
    void expiryQuery.refetch()
  }

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: S.all, count: lowStock.length + expiring.length },
    { key: 'low', label: S.lowStock, count: lowStock.length },
    { key: 'expiry', label: S.nearExpiry, count: expiring.length },
  ]

  return (
    <Screen
      title={S.title}
      subtitle={S.subtitle}
      scroll={false}
      headerAction={
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      }
    >
      {isPending ? (
        <LoadingView />
      ) : alertsQuery.isError || expiryQuery.isError ? (
        <ErrorState error={error} onRetry={refetchAll} />
      ) : (
        <>
          <View style={styles.filterRow}>
            {chips.map(c => (
              <Pressable
                key={c.key}
                style={[styles.chip, filter === c.key && styles.chipActive]}
                onPress={() => setFilter(c.key)}
              >
                <Text style={[styles.chipText, filter === c.key && styles.chipTextActive]}>
                  {c.label} ({c.count})
                </Text>
              </Pressable>
            ))}
          </View>

          <SectionList
            sections={sections}
            keyExtractor={item => item.key}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled
            refreshControl={
              <RefreshControl
                refreshing={alertsQuery.isRefetching || expiryQuery.isRefetching}
                onRefresh={refetchAll}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={<EmptyState icon="checkmark-circle-outline" message={S.empty} />}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle} numberOfLines={1}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.count}</Text>
              </View>
            )}
            renderItem={({ item }) =>
              item.kind === 'low' ? <LowStockRow item={item.low} /> : <ExpiringBatchRow item={item.expiry} />
            }
          />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: ROW, gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.onPrimary },
  listContent: { paddingBottom: spacing.xxl },
  sectionHeader: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '800', textAlign: 'right' },
  sectionCount: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: '800',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    ...shadow.card,
  },
})
