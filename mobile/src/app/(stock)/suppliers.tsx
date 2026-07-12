import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { fetchSuppliers } from '@/api/endpoints/suppliers'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatMoney } from '@/utils/format'

const S = {
  title: 'الموردون',
  searchPlaceholder: 'ابحث باسم المورد…',
  balanceDue: 'مستحق له',
  balanceCredit: 'رصيد لنا',
  settled: 'مسدَّد',
  products: 'منتج',
  readOnlyHint: 'عرض فقط — إدارة الموردين من لوحة الويب',
}

export default function SuppliersScreen() {
  const branchId = useAuthStore(s => s.user?.branchId ?? null)
  const [query, setQuery] = useState('')

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', branchId],
    queryFn: () => fetchSuppliers(branchId),
    staleTime: 2 * 60_000, // قائمة مرجعية
  })

  const suppliers = useMemo(() => {
    const all = suppliersQuery.data ?? []
    const q = query.trim()
    return q ? all.filter(s => s.name.includes(q)) : all
  }, [suppliersQuery.data, query])

  if (suppliersQuery.isLoading) {
    return (
      <Screen title={S.title} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (suppliersQuery.isError) {
    return (
      <Screen title={S.title} scroll={false}>
        <ErrorState error={suppliersQuery.error} onRetry={() => suppliersQuery.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen title={S.title} scroll={false}>
      <Text style={styles.hint}>{S.readOnlyHint}</Text>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={S.searchPlaceholder}
          placeholderTextColor={colors.textMuted}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={suppliers}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={suppliersQuery.isRefetching}
            onRefresh={() => suppliersQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={<EmptyState icon="people-outline" />}
        renderItem={({ item }) => {
          const balance = Number(item.balance) || 0
          const balanceLabel = balance > 0 ? S.balanceDue : balance < 0 ? S.balanceCredit : S.settled
          const balanceColor = balance > 0 ? colors.danger : balance < 0 ? colors.success : colors.textSecondary
          return (
            <View style={styles.card}>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
                {item._count ? (
                  <Text style={styles.meta}>
                    {item._count.products} {S.products}
                  </Text>
                ) : null}
              </View>
              <View style={styles.balanceWrap}>
                <Text style={[styles.balance, { color: balanceColor }]}>
                  {formatMoney(Math.abs(balance))} {ar.common.currency}
                </Text>
                <Text style={[styles.balanceLabel, { color: balanceColor }]}>{balanceLabel}</Text>
              </View>
            </View>
          )
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right', marginBottom: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm + 2, fontSize: fontSize.md, color: colors.text, textAlign: 'right' },
  listContent: { paddingBottom: spacing.xxl, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.card,
  },
  info: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', textAlign: 'right' },
  meta: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right' },
  balanceWrap: { alignItems: 'center', gap: 2 },
  balance: { fontSize: fontSize.md, fontWeight: '800' },
  balanceLabel: { fontSize: fontSize.xs },
})
