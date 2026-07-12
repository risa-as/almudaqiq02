import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { fetchPurchaseOrders } from '@/api/endpoints/purchaseOrders'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { chipFor, ORDER_STATUS, StatusChip } from '@/components/stock/StatusChip'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime, formatMoney } from '@/utils/format'

const S = {
  history: 'عرض السجل',
  hideHistory: 'إخفاء السجل',
  items: 'صنف',
  total: 'الإجمالي',
  emptyPending: 'لا توجد أوامر شراء بانتظار الاستلام',
}

const PENDING = ['DRAFT', 'ORDERED']

export default function ReceiveList() {
  const [showHistory, setShowHistory] = useState(false)

  const ordersQuery = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: fetchPurchaseOrders,
  })

  const orders = useMemo(() => {
    const all = ordersQuery.data?.orders ?? []
    return showHistory ? all : all.filter(o => PENDING.includes(o.status))
  }, [ordersQuery.data, showHistory])

  if (ordersQuery.isLoading) {
    return (
      <Screen title={ar.tabs.receive} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (ordersQuery.isError) {
    return (
      <Screen title={ar.tabs.receive} scroll={false}>
        <ErrorState error={ordersQuery.error} onRetry={() => ordersQuery.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen
      title={ar.tabs.receive}
      scroll={false}
      headerAction={
        <Pressable onPress={() => setShowHistory(h => !h)} hitSlop={8}>
          <Text style={styles.historyToggle}>{showHistory ? S.hideHistory : S.history}</Text>
        </Pressable>
      }
    >
      <FlatList
        data={orders}
        keyExtractor={o => o.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={ordersQuery.isRefetching}
            onRefresh={() => ordersQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={<EmptyState icon="download-outline" message={S.emptyPending} />}
        renderItem={({ item }) => {
          const chip = chipFor(ORDER_STATUS, item.status)
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/(stock)/receive/[id]', params: { id: item.id } })}
            >
              <View style={styles.cardHeader}>
                <StatusChip {...chip} />
                <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.supplier} numberOfLines={1}>{item.supplierName}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {item.itemsCount} {S.items}
                </Text>
                <Text style={styles.metaStrong}>
                  {S.total}: {formatMoney(item.totalCost)} {ar.common.currency}
                </Text>
              </View>
            </Pressable>
          )
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  historyToggle: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  listContent: { paddingBottom: spacing.xxl, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { color: colors.textMuted, fontSize: fontSize.xs },
  supplier: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', textAlign: 'right' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: colors.textSecondary, fontSize: fontSize.sm },
  metaStrong: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
})
