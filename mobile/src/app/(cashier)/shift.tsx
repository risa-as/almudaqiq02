import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ApiError } from '@/api/client'
import {
  closeShift,
  fetchActiveShift,
  fetchShiftSummary,
  openShift,
  shiftKeys,
} from '@/api/endpoints/shifts'
import { fetchTransactions, shiftInvoicesKey } from '@/api/endpoints/transactions'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'

// نصوص خاصة بشاشة الوردية
const t = {
  title: 'ورديتي',
  noShiftTitle: 'لا توجد وردية مفتوحة',
  noShiftHint: 'افتح وردية جديدة لبدء البيع — أدخل الرصيد الافتتاحي للصندوق',
  openingBalance: 'الرصيد الافتتاحي',
  openShift: 'فتح الوردية',
  opening: 'جارٍ فتح الوردية…',
  openedAt: 'فُتحت في',
  salesCount: 'عدد الفواتير',
  totalSales: 'إجمالي المبيعات',
  cashSales: 'مبيعات نقدية',
  cardSales: 'مبيعات شبكة',
  creditSales: 'مبيعات آجلة',
  cashRefunds: 'مرتجعات نقدية',
  expectedCash: 'النقد المتوقع بالصندوق',
  closeShift: 'إغلاق الوردية',
  countedCash: 'النقد المعدود فعليًا',
  difference: 'الفرق',
  balanced: 'مطابق',
  surplus: 'زيادة',
  deficit: 'عجز',
  confirmCloseTitle: 'تأكيد إغلاق الوردية',
  confirmCloseMessage: (expected: string, counted: string) =>
    `النقد المتوقع: ${expected}\nالنقد المعدود: ${counted}\n\nهل تريد إغلاق الوردية؟`,
  closing: 'جارٍ الإغلاق…',
  closedTitle: 'أُغلقت الوردية',
  closedMessage: (expected: string, counted: string, diff: string) =>
    `المتوقع: ${expected}\nالمعدود: ${counted}\nالفرق: ${diff}`,
  invalidAmount: 'أدخل مبلغًا صحيحًا',
  cancelClose: 'إلغاء',
  startClose: 'بدء الإغلاق',
}

export default function ShiftScreen() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  const [openingInput, setOpeningInput] = useState('')
  const [closePanelOpen, setClosePanelOpen] = useState(false)
  const [countedInput, setCountedInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const shiftQuery = useQuery({ queryKey: shiftKeys.active, queryFn: fetchActiveShift })
  const activeShift = shiftQuery.data?.activeShift ?? null

  const summaryQuery = useQuery({
    queryKey: shiftKeys.summary,
    queryFn: fetchShiftSummary,
    enabled: !!activeShift,
  })

  const branchId = activeShift?.branchId ?? user?.branchId ?? null
  const invoicesQuery = useQuery({
    queryKey: shiftInvoicesKey(branchId),
    queryFn: () => fetchTransactions({ limit: 100, branchId }),
    enabled: !!activeShift,
  })

  const salesCount =
    activeShift && invoicesQuery.data
      ? invoicesQuery.data.filter(
          tx =>
            tx.type === 'SALE' &&
            tx.userId === user?.id &&
            new Date(tx.date).getTime() >= new Date(activeShift.openedAt).getTime(),
        ).length
      : null

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: shiftKeys.active })
    queryClient.invalidateQueries({ queryKey: shiftKeys.summary })
    queryClient.invalidateQueries({ queryKey: shiftInvoicesKey(branchId) })
  }

  const openMutation = useMutation({
    mutationFn: (amount: number) => openShift(amount, user?.branchId ?? undefined),
    onSuccess: () => {
      setOpeningInput('')
      setFormError(null)
      invalidateAll()
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : ar.common.unexpectedError)
    },
  })

  const closeMutation = useMutation({
    mutationFn: (amount: number) => closeShift(amount),
    onSuccess: result => {
      setClosePanelOpen(false)
      setCountedInput('')
      setFormError(null)
      const counted = Number(result.shift.closingAmount ?? 0)
      const expected = Number(result.expectedAmount)
      Alert.alert(
        t.closedTitle,
        t.closedMessage(formatMoney(expected), formatMoney(counted), formatMoney(counted - expected)),
      )
      invalidateAll()
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : ar.common.unexpectedError)
    },
  })

  const submitOpen = () => {
    const amount = Number(openingInput)
    if (openingInput.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setFormError(t.invalidAmount)
      return
    }
    setFormError(null)
    openMutation.mutate(amount)
  }

  const submitClose = () => {
    const counted = Number(countedInput)
    if (countedInput.trim() === '' || !Number.isFinite(counted) || counted < 0) {
      setFormError(t.invalidAmount)
      return
    }
    setFormError(null)
    const expected = summaryQuery.data?.expectedCash ?? 0
    Alert.alert(t.confirmCloseTitle, t.confirmCloseMessage(formatMoney(expected), formatMoney(counted)), [
      { text: ar.common.cancel, style: 'cancel' },
      { text: ar.common.confirm, style: 'destructive', onPress: () => closeMutation.mutate(counted) },
    ])
  }

  if (shiftQuery.isPending) {
    return (
      <Screen title={t.title} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (shiftQuery.isError) {
    return (
      <Screen title={t.title} scroll={false}>
        <ErrorState error={shiftQuery.error} onRetry={() => shiftQuery.refetch()} />
      </Screen>
    )
  }

  // ── لا توجد وردية مفتوحة → بطاقة الفتح (US2-AS1) ────────────────────────────
  if (!activeShift) {
    return (
      <Screen
        title={t.title}
        refreshing={shiftQuery.isRefetching}
        onRefresh={() => shiftQuery.refetch()}
      >
        <View style={styles.card}>
          <View style={styles.noShiftIcon}>
            <Ionicons name="time-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>{t.noShiftTitle}</Text>
          <Text style={styles.cardHint}>{t.noShiftHint}</Text>

          <Text style={styles.inputLabel}>{t.openingBalance}</Text>
          <TextInput
            style={styles.input}
            value={openingInput}
            onChangeText={setOpeningInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            textAlign="right"
            editable={!openMutation.isPending}
          />

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <Pressable
            style={[styles.primaryButton, openMutation.isPending && styles.buttonDisabled]}
            onPress={submitOpen}
            disabled={openMutation.isPending}
          >
            <Text style={styles.primaryButtonText}>{openMutation.isPending ? t.opening : t.openShift}</Text>
          </Pressable>
        </View>
      </Screen>
    )
  }

  // ── وردية مفتوحة → الإجماليات الجارية + مسار الإغلاق (US2-AS6) ──────────────
  const summary = summaryQuery.data
  const counted = Number(countedInput)
  const diff =
    countedInput.trim() !== '' && Number.isFinite(counted) && summary
      ? counted - summary.expectedCash
      : null

  return (
    <Screen
      title={t.title}
      refreshing={shiftQuery.isRefetching || summaryQuery.isRefetching}
      onRefresh={() => {
        shiftQuery.refetch()
        summaryQuery.refetch()
        invoicesQuery.refetch()
      }}
    >
      <View style={styles.openBadge}>
        <View style={styles.openDot} />
        <Text style={styles.openBadgeText}>
          {t.openedAt} {formatDateTime(activeShift.openedAt)}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label={t.totalSales}
          value={formatMoney(summary?.totalSales ?? 0)}
          icon="trending-up"
          tint={colors.primary}
          tintSoft={colors.primarySoft}
        />
        <StatCard
          label={t.salesCount}
          value={salesCount === null ? '—' : String(salesCount)}
          icon="receipt-outline"
          tint={colors.violet}
          tintSoft={colors.violetSoft}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label={t.cashSales}
          value={formatMoney(summary?.cashSales ?? 0)}
          icon="cash-outline"
          tint={colors.success}
          tintSoft={colors.successSoft}
        />
        <StatCard
          label={t.cardSales}
          value={formatMoney(summary?.cardSales ?? 0)}
          icon="card-outline"
          tint={colors.info}
          tintSoft={colors.infoSoft}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label={t.creditSales}
          value={formatMoney(summary?.creditSales ?? 0)}
          icon="time-outline"
          tint={colors.warning}
          tintSoft={colors.warningSoft}
        />
        <StatCard
          label={t.cashRefunds}
          value={formatMoney(summary?.cashRefunds ?? 0)}
          icon="return-down-back-outline"
          tint={colors.danger}
          tintSoft={colors.dangerSoft}
        />
      </View>

      <View style={styles.expectedCard}>
        <Text style={styles.expectedLabel}>{t.expectedCash}</Text>
        <Text style={styles.expectedValue}>
          {formatMoney(summary?.expectedCash ?? 0)} {ar.common.currency}
        </Text>
        <Text style={styles.expectedHint}>
          {t.openingBalance}: {formatMoney(activeShift.openingAmount)}
        </Text>
      </View>

      {!closePanelOpen ? (
        <Pressable style={styles.closeStartButton} onPress={() => setClosePanelOpen(true)}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.danger} />
          <Text style={styles.closeStartText}>{t.startClose}</Text>
        </Pressable>
      ) : (
        <View style={styles.closePanel}>
          <Text style={styles.cardTitle}>{t.closeShift}</Text>

          <Text style={styles.inputLabel}>{t.countedCash}</Text>
          <TextInput
            style={styles.input}
            value={countedInput}
            onChangeText={setCountedInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            textAlign="right"
            editable={!closeMutation.isPending}
          />

          <View style={styles.diffRow}>
            <Text style={styles.diffLabel}>{t.expectedCash}</Text>
            <Text style={styles.diffValue}>{formatMoney(summary?.expectedCash ?? 0)}</Text>
          </View>
          {diff !== null ? (
            <View style={styles.diffRow}>
              <Text style={styles.diffLabel}>{t.difference}</Text>
              <Text
                style={[
                  styles.diffValue,
                  diff === 0 ? styles.diffOk : diff > 0 ? styles.diffSurplus : styles.diffDeficit,
                ]}
              >
                {diff === 0 ? t.balanced : `${formatMoney(diff)} (${diff > 0 ? t.surplus : t.deficit})`}
              </Text>
            </View>
          ) : null}

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <View style={styles.closeActions}>
            <Pressable
              style={[styles.dangerButton, closeMutation.isPending && styles.buttonDisabled]}
              onPress={submitClose}
              disabled={closeMutation.isPending}
            >
              <Text style={styles.primaryButtonText}>
                {closeMutation.isPending ? t.closing : t.closeShift}
              </Text>
            </Pressable>
            <Pressable
              style={styles.ghostButton}
              onPress={() => {
                setClosePanelOpen(false)
                setCountedInput('')
                setFormError(null)
              }}
              disabled={closeMutation.isPending}
            >
              <Text style={styles.ghostButtonText}>{t.cancelClose}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.sm,
    marginTop: spacing.md,
    ...shadow.card,
  },
  noShiftIcon: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'center' },
  cardHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  inputLabel: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right', marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  errorText: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'right', marginTop: spacing.xs },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    ...shadow.button,
  },
  primaryButtonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  openDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.success },
  openBadgeText: { flex: 1, color: colors.success, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  expectedCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  expectedLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  expectedValue: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.primary },
  expectedHint: { fontSize: fontSize.xs, color: colors.textMuted },
  closeStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.pill,
    height: 48,
  },
  closeStartText: { color: colors.danger, fontSize: fontSize.md, fontWeight: '700' },
  closePanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  diffLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  diffValue: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  diffOk: { color: colors.success },
  diffSurplus: { color: colors.info },
  diffDeficit: { color: colors.danger },
  closeActions: { gap: spacing.sm, marginTop: spacing.md },
  dangerButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
    shadowColor: colors.danger,
  },
  ghostButton: {
    borderRadius: radius.pill,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ghostButtonText: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' },
})
