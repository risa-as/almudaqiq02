import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
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
import { appAlert } from '@/components/AppAlert'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

// نصوص خاصة بشاشة الوردية
const t = {
  title: 'ورديتي',
  noShiftTitle: 'لا توجد وردية مفتوحة',
  noShiftHint: 'افتح وردية جديدة لبدء البيع — أدخل الرصيد الافتتاحي للصندوق',
  openingBalance: 'الرصيد الافتتاحي',
  openShift: 'فتح الوردية',
  opening: 'جارٍ فتح الوردية…',
  shiftOpen: 'وردية مفتوحة الآن',
  openedAt: 'فُتحت في',
  summary: 'ملخص الوردية',
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
      appAlert.success(
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
    appAlert.confirm({
      title: t.confirmCloseTitle,
      message: t.confirmCloseMessage(formatMoney(expected), formatMoney(counted)),
      destructive: true,
      onConfirm: () => closeMutation.mutate(counted),
    })
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
          <View style={styles.inputWrap}>
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
            <Text style={styles.inputUnit}>{ar.common.currency}</Text>
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <Pressable
            style={[styles.primaryButton, openMutation.isPending && styles.buttonDisabled]}
            onPress={submitOpen}
            disabled={openMutation.isPending}
          >
            <Ionicons name="play-circle-outline" size={20} color={colors.onPrimary} />
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
      {/* ── بطاقة حالة الوردية ── */}
      <View style={styles.statusCard}>
        <View style={styles.statusTop}>
          <View style={styles.openDot} />
          <Text style={styles.statusTitle}>{t.shiftOpen}</Text>
        </View>
        <View style={styles.statusChips}>
          <View style={styles.statusChip}>
            <Ionicons name="time-outline" size={13} color={colors.success} />
            <Text style={styles.statusChipText} numberOfLines={1}>
              {t.openedAt} {formatDateTime(activeShift.openedAt)}
            </Text>
          </View>
          <View style={styles.statusChip}>
            <Ionicons name="wallet-outline" size={13} color={colors.success} />
            <Text style={styles.statusChipText} numberOfLines={1}>
              {t.openingBalance}: {formatMoney(activeShift.openingAmount)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── ملخص الوردية ── */}
      <View style={styles.sectionHeader}>
        <Ionicons name="stats-chart-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.sectionHeaderTitle}>{t.summary}</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label={t.totalSales}
          value={formatMoney(summary?.totalSales ?? 0)}
          icon="trending-up"
          tint={colors.primary}
          tintSoft={colors.primarySoft}
          unit={ar.common.currency}
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
          unit={ar.common.currency}
        />
        <StatCard
          label={t.cardSales}
          value={formatMoney(summary?.cardSales ?? 0)}
          icon="card-outline"
          tint={colors.info}
          tintSoft={colors.infoSoft}
          unit={ar.common.currency}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label={t.creditSales}
          value={formatMoney(summary?.creditSales ?? 0)}
          icon="time-outline"
          tint={colors.warning}
          tintSoft={colors.warningSoft}
          unit={ar.common.currency}
        />
        <StatCard
          label={t.cashRefunds}
          value={formatMoney(summary?.cashRefunds ?? 0)}
          icon="return-down-back-outline"
          tint={colors.danger}
          tintSoft={colors.dangerSoft}
          unit={ar.common.currency}
        />
      </View>

      {/* ── النقد المتوقع ── */}
      <View style={styles.expectedCard}>
        <View style={styles.expectedIcon}>
          <Ionicons name="wallet-outline" size={22} color={colors.primary} />
        </View>
        <Text style={styles.expectedLabel}>{t.expectedCash}</Text>
        <View style={styles.expectedValueRow}>
          <Text style={styles.expectedValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(summary?.expectedCash ?? 0)}
          </Text>
          <Text style={styles.expectedUnit}>{ar.common.currency}</Text>
        </View>
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
          <View style={styles.inputWrap}>
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
            <Text style={styles.inputUnit}>{ar.common.currency}</Text>
          </View>

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
  // الحقل والوحدة في إطار واحد: الرقم يمينًا و«د.ع» في الطرف الأيسر
  inputWrap: {
    flexDirection: ROW,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  inputUnit: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textMuted },
  errorText: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'right', marginTop: spacing.xs },
  primaryButton: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    marginTop: spacing.md,
    ...shadow.button,
  },
  primaryButtonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },

  // ── بطاقة الحالة ──
  statusCard: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statusTop: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  openDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.success },
  statusTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '800', textAlign: 'right' },
  statusChips: { flexDirection: ROW, flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    flexShrink: 1,
  },
  statusChipText: { color: colors.success, fontSize: fontSize.xs, fontWeight: '700' },

  sectionHeader: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionHeaderTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },

  statsRow: { flexDirection: ROW, gap: spacing.md, marginBottom: spacing.md },

  // ── النقد المتوقع ──
  expectedCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  expectedIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  expectedLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  expectedValueRow: { flexDirection: ROW, alignItems: 'baseline', gap: spacing.xs },
  expectedValue: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.primary },
  expectedUnit: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },

  // ── مسار الإغلاق ──
  closeStartButton: {
    flexDirection: ROW,
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
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  diffLabel: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right' },
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
