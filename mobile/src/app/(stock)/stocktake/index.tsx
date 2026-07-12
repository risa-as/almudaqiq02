import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { createStocktakeSession, fetchStocktakeSessions } from '@/api/endpoints/stocktake'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { chipFor, StatusChip, STOCKTAKE_STATUS } from '@/components/stock/StatusChip'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime } from '@/utils/format'

const S = {
  startNew: 'بدء جرد جديد',
  starting: 'جارٍ إنشاء الجلسة…',
  counted: 'المعدود',
  diffs: 'فروقات',
  empty: 'لا توجد جلسات جرد بعد — ابدأ أول جرد لفرعك',
}

export default function StocktakeList() {
  const branchId = useAuthStore(s => s.user?.branchId ?? null)
  const queryClient = useQueryClient()
  const [createError, setCreateError] = useState<string | null>(null)

  const sessionsQuery = useQuery({
    queryKey: ['stocktake-sessions', branchId],
    queryFn: fetchStocktakeSessions,
  })

  const createMutation = useMutation({
    mutationFn: () => createStocktakeSession(branchId),
    onSuccess: data => {
      setCreateError(null)
      queryClient.invalidateQueries({ queryKey: ['stocktake-sessions'] })
      router.push({ pathname: '/(stock)/stocktake/[id]', params: { id: data.sessionId } })
    },
    onError: err => {
      // 409 = جلسة مفتوحة موجودة — الرسالة العربية تأتي من الخادم
      setCreateError(err instanceof ApiError ? err.message : ar.common.unexpectedError)
      sessionsQuery.refetch()
    },
  })

  if (sessionsQuery.isLoading) {
    return (
      <Screen title={ar.tabs.stocktake} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (sessionsQuery.isError) {
    return (
      <Screen title={ar.tabs.stocktake} scroll={false}>
        <ErrorState error={sessionsQuery.error} onRetry={() => sessionsQuery.refetch()} />
      </Screen>
    )
  }

  const sessions = sessionsQuery.data?.sessions ?? []

  return (
    <Screen title={ar.tabs.stocktake} scroll={false}>
      <Pressable
        style={[styles.startButton, createMutation.isPending && styles.disabled]}
        onPress={() => createMutation.mutate()}
        disabled={createMutation.isPending}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.onPrimary} />
        <Text style={styles.startText}>{createMutation.isPending ? S.starting : S.startNew}</Text>
      </Pressable>

      {createError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{createError}</Text>
          <Pressable onPress={() => setCreateError(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={sessions}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={sessionsQuery.isRefetching}
            onRefresh={() => sessionsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={<EmptyState icon="clipboard-outline" message={S.empty} />}
        renderItem={({ item }) => {
          const chip = chipFor(STOCKTAKE_STATUS, item.status)
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/(stock)/stocktake/[id]', params: { id: item.id } })}
            >
              <View style={styles.cardHeader}>
                <StatusChip {...chip} />
                <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.branch}>{item.branchName}</Text>
              <View style={styles.statsRow}>
                <Text style={styles.stat}>
                  {S.counted}: <Text style={styles.statValue}>{item.countedItems}</Text> / {item.totalItems}
                </Text>
                {item.diffItems > 0 ? (
                  <Text style={[styles.stat, { color: colors.warning }]}>
                    {S.diffs}: <Text style={[styles.statValue, { color: colors.warning }]}>{item.diffItems}</Text>
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  startText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  disabled: { opacity: 0.6 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSize.sm, textAlign: 'right' },
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
  branch: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', textAlign: 'right' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stat: { color: colors.textSecondary, fontSize: fontSize.sm },
  statValue: { fontWeight: '800', color: colors.text },
})
