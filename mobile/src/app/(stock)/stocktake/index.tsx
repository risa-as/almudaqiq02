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
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime } from '@/utils/format'
import { ROW } from '@/utils/rtl'

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
          const complete = item.totalItems > 0 && item.countedItems >= item.totalItems
          const countTint = complete ? colors.success : colors.primary
          const countSoft = complete ? colors.successSoft : colors.primarySoft
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/(stock)/stocktake/[id]', params: { id: item.id } })}
            >
              <View style={styles.cardHeader}>
                <StatusChip {...chip} />
                <View style={styles.dateWrap}>
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
                </View>
              </View>

              <View style={styles.branchRow}>
                <View style={styles.branchIcon}>
                  <Ionicons name="storefront-outline" size={14} color={colors.primary} />
                </View>
                <Text style={styles.branch} numberOfLines={1}>{item.branchName}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={[styles.statPill, { backgroundColor: countSoft }]}>
                  <Ionicons name="checkmark-done" size={14} color={countTint} />
                  <Text style={styles.statLabel}>{S.counted}</Text>
                  <Text style={[styles.statValue, { color: countTint }]}>
                    {item.countedItems} / {item.totalItems}
                  </Text>
                </View>
                {item.diffItems > 0 ? (
                  <View style={[styles.statPill, { backgroundColor: colors.warningSoft }]}>
                    <Ionicons name="git-compare-outline" size={14} color={colors.warning} />
                    <Text style={styles.statLabel}>{S.diffs}</Text>
                    <Text style={[styles.statValue, { color: colors.warning }]}>{item.diffItems}</Text>
                  </View>
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
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    marginBottom: spacing.sm,
    ...shadow.button,
  },
  startText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },
  disabled: { opacity: 0.6 },
  errorBanner: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSize.sm, textAlign: 'right', writingDirection: 'rtl' },
  listContent: { paddingBottom: spacing.xxl, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  cardHeader: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' },
  dateWrap: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  date: { color: colors.textMuted, fontSize: fontSize.xs },
  branchRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  branchIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branch: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: '700', textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  statsRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  statPill: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  statLabel: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '600' },
  statValue: { fontSize: fontSize.sm, fontWeight: '800', color: colors.text },
})
