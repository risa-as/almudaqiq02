import { useCallback, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import {
  cancelStocktake,
  completeStocktake,
  fetchStocktakeSession,
  saveStocktakeCounts,
  type StocktakeItem,
} from '@/api/endpoints/stocktake'
import { appAlert } from '@/components/AppAlert'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { chipFor, StatusChip, STOCKTAKE_STATUS } from '@/components/stock/StatusChip'
import { diffColor, StocktakeCountRow } from '@/components/stock/StocktakeCountRow'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ROW } from '@/utils/rtl'

const S = {
  title: 'جلسة الجرد',
  searchPlaceholder: 'ابحث باسم المنتج…',
  noCategory: 'بدون قسم',
  sectionMeta: (counted: number, total: number) => `${counted} / ${total}`,
  diffValue: 'قيمة الفرق',
  noMatch: 'لا يوجد منتج مطابق للبحث',
  recorded: 'المسجّل',
  counted: 'المعدود',
  submit: 'حفظ ومراجعة الفروقات',
  submitting: 'جارٍ الحفظ…',
  reviewTitle: 'ملخص الفروقات قبل الاعتماد',
  noDiffs: 'كل العدّات مطابقة للمسجّل — لا فروقات',
  confirmComplete: 'اعتماد الجرد وتطبيق الفروقات',
  completing: 'جارٍ الاعتماد…',
  completeWarning: 'سيُعدَّل المخزون الفعلي وفق العدّات ولا يمكن التراجع',
  cancelSession: 'إلغاء الجلسة',
  cancelConfirmTitle: 'إلغاء جلسة الجرد؟',
  cancelConfirmMsg: 'ستُهمل كل العدّات ولن يتغير المخزون',
  completedTitle: 'اكتمل الجرد',
  completedMsg: 'تم اعتماد الجرد وتطبيق الفروقات على المخزون',
  surplus: 'زيادة',
  shortage: 'نقص',
  progress: (c: number, t: number) => `المعدود: ${c} من ${t}`,
}

// diffColor/diffSoft يعيشان الآن مع صفّ الجرد في components/stock/StocktakeCountRow

export default function StocktakeSession() {
  const params = useLocalSearchParams<{ id: string }>()
  const sessionId = typeof params.id === 'string' ? params.id : ''
  const queryClient = useQueryClient()

  // العدّات المحلية — تبقى حيّة عبر دورات المسح وبعد أي فشل إرسال (FR-015)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [banner, setBanner] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  const sessionQuery = useQuery({
    queryKey: ['stocktake-session', sessionId],
    queryFn: () => fetchStocktakeSession(sessionId),
    enabled: !!sessionId,
  })

  const detail = sessionQuery.data
  const isDraft = detail?.status === 'DRAFT'

  /**
   * نص حقل العدّ لكل بند: التعديل المحلي أولًا، وإلا العدّة المحفوظة خادميًا.
   * '' يعني «لم يُعدّ»؛ '0' عدّة حقيقية (رفّ فارغ) ولها فرق سالب.
   */
  const textOf = useCallback(
    (item: StocktakeItem): string => {
      const local = counts[item.id]
      if (local !== undefined) return local
      return item.countedQty !== null ? String(item.countedQty) : ''
    },
    [counts],
  )

  const items = useMemo(() => detail?.items ?? [], [detail?.items])

  const entries = useMemo(() => items.filter(i => textOf(i) !== ''), [items, textOf])

  const discrepancies = useMemo(
    () =>
      entries
        .map(item => ({ item, counted: Number(textOf(item)) }))
        .map(e => ({ ...e, diff: e.counted - e.item.expectedQty }))
        .filter(e => e.diff !== 0),
    [entries, textOf],
  )

  /** قيمة الفرق الإجمالية = مجموع (الفرق × سعر الوحدة) */
  const totalDiffValue = useMemo(
    () => discrepancies.reduce((sum, e) => sum + e.diff * e.item.unitPrice, 0),
    [discrepancies],
  )

  /** كل الأصناف مجمّعة حسب القسم (الأقسام أبجديًا و«بدون قسم» أخيرًا) */
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase()
    const visible = q ? items.filter(i => i.productName.toLowerCase().includes(q)) : items

    const groups = new Map<string, StocktakeItem[]>()
    for (const item of visible) {
      const key = item.categoryName ?? S.noCategory
      const bucket = groups.get(key)
      if (bucket) bucket.push(item)
      else groups.set(key, [item])
    }

    return [...groups.entries()]
      .sort(([a], [b]) => {
        if (a === S.noCategory) return 1
        if (b === S.noCategory) return -1
        return a.localeCompare(b, 'ar')
      })
      .map(([title, data]) => ({ title, data }))
  }, [items, search])

  const onCountChange = useCallback((itemId: string, text: string) => {
    // أرقام فقط — الحقل رقمي والخادم يخزّن Int
    const clean = text.replace(/[^\d]/g, '')
    setCounts(prev => ({ ...prev, [itemId]: clean }))
  }, [])

  const saveMutation = useMutation({
    mutationFn: () => {
      // '' يُرسل null عمدًا: مسح حقل عُدّ سابقًا يعني إلغاء عدّته لا تجاهلها
      const payload = Object.entries(counts).map(([itemId, v]) => ({
        itemId,
        countedQty: v === '' ? null : Math.max(0, Math.round(Number(v))),
      }))
      return saveStocktakeCounts(sessionId, payload)
    },
    onSuccess: () => {
      setBanner(null)
      setReviewOpen(true)
    },
    onError: err => {
      // فشل الإرسال لا يمس العدّات المحلية إطلاقًا
      setBanner({ kind: 'error', text: err instanceof ApiError ? err.message : ar.common.unexpectedError })
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => completeStocktake(sessionId),
    onSuccess: () => {
      setReviewOpen(false)
      queryClient.invalidateQueries({ queryKey: ['stocktake-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['stocktake-session', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      appAlert.success(S.completedTitle, S.completedMsg, () => router.back())
    },
    onError: err => {
      setReviewOpen(false)
      setBanner({ kind: 'error', text: err instanceof ApiError ? err.message : ar.common.unexpectedError })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelStocktake(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake-sessions'] })
      router.back()
    },
    onError: err => {
      setBanner({ kind: 'error', text: err instanceof ApiError ? err.message : ar.common.unexpectedError })
    },
  })

  const confirmCancel = () => {
    appAlert.confirm({
      title: S.cancelConfirmTitle,
      message: S.cancelConfirmMsg,
      destructive: true,
      onConfirm: () => cancelMutation.mutate(),
    })
  }

  if (sessionQuery.isLoading) {
    return (
      <Screen title={S.title} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (sessionQuery.isError || !detail) {
    return (
      <Screen title={S.title} scroll={false}>
        <ErrorState error={sessionQuery.error} onRetry={() => sessionQuery.refetch()} />
      </Screen>
    )
  }

  const chip = chipFor(STOCKTAKE_STATUS, detail.status)

  return (
    <Screen
      title={S.title}
      scroll={false}
      headerAction={
        <View style={styles.headerAction}>
          <StatusChip {...chip} />
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      }
    >
      <Text style={styles.sessionMeta}>{formatDateTime(detail.createdAt)}</Text>

      {banner ? (
        <View style={[styles.banner, banner.kind === 'error' ? styles.bannerError : styles.bannerWarning]}>
          <Ionicons
            name={banner.kind === 'error' ? 'alert-circle' : 'warning'}
            size={16}
            color={banner.kind === 'error' ? colors.danger : colors.warning}
          />
          <Text style={[styles.bannerText, { color: banner.kind === 'error' ? colors.danger : colors.warning }]}>
            {banner.text}
          </Text>
          <Pressable onPress={() => setBanner(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={S.searchPlaceholder}
          placeholderTextColor={colors.textMuted}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* ورقة الجرد: كل الأصناف مرتّبة حسب القسم، وأمام كلٍّ رصيدُه وحقلُ عدّه وفرقُه */}
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled
        initialNumToRender={12}
        windowSize={9}
        ListEmptyComponent={
          <EmptyState icon="clipboard-outline" message={search.trim() ? S.noMatch : ar.common.empty} />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} numberOfLines={1}>{section.title}</Text>
            <Text style={styles.sectionCount}>
              {S.sectionMeta(section.data.filter(i => textOf(i) !== '').length, section.data.length)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <StocktakeCountRow item={item} value={textOf(item)} editable={!!isDraft} onChange={onCountChange} />
        )}
      />

      {/* شريط سفلي: تقدم + إرسال (خطوة أولى) + إلغاء الجلسة */}
      {isDraft ? (
        <View style={styles.footer}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>{S.progress(entries.length, detail.items.length)}</Text>
            {discrepancies.length > 0 ? (
              <Text style={[styles.progressText, { color: colors.warning }]}>فروقات: {discrepancies.length}</Text>
            ) : null}
          </View>
          {/* قيمة الفرق الإجمالية = مجموع (الفرق × سعر الوحدة) */}
          {discrepancies.length > 0 ? (
            <View style={styles.diffValueRow}>
              <Text style={styles.diffValueLabel}>{S.diffValue}</Text>
              <Text style={[styles.diffValueAmount, { color: diffColor(totalDiffValue) }]}>
                {totalDiffValue > 0 ? `+${formatMoney(totalDiffValue)}` : formatMoney(totalDiffValue)}{' '}
                <Text style={styles.diffValueCurrency}>{ar.common.currency}</Text>
              </Text>
            </View>
          ) : null}
          <Pressable
            style={[styles.submitButton, (saveMutation.isPending || entries.length === 0) && styles.disabled]}
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || entries.length === 0}
          >
            <Ionicons name="checkmark-done" size={18} color={colors.onPrimary} />
            <Text style={styles.submitText}>{saveMutation.isPending ? S.submitting : S.submit}</Text>
          </Pressable>
          <Pressable onPress={confirmCancel} disabled={cancelMutation.isPending}>
            <Text style={styles.cancelText}>{S.cancelSession}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* الخطوة الثانية: مراجعة الفروقات ثم الاعتماد النهائي */}
      <Modal visible={reviewOpen} transparent animationType="slide" onRequestClose={() => setReviewOpen(false)}>
        <View style={styles.reviewBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReviewOpen(false)} />
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>{S.reviewTitle}</Text>
              <Pressable onPress={() => setReviewOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.reviewBody}>
              {discrepancies.length === 0 ? (
                <Text style={styles.reviewOk}>{S.noDiffs}</Text>
              ) : (
                discrepancies.map(({ item, counted, diff }) => (
                  <View key={item.id} style={styles.reviewRow}>
                    <View style={styles.reviewInfo}>
                      <Text style={styles.entryName} numberOfLines={1}>{item.productName}</Text>
                      <Text style={styles.entryMeta}>
                        {S.recorded}: {item.expectedQty} • {S.counted}: {counted}
                      </Text>
                    </View>
                    <View
                      style={[styles.diffBadge, { backgroundColor: diff < 0 ? colors.dangerSoft : colors.warningSoft }]}
                    >
                      <Text style={{ color: diffColor(diff), fontWeight: '800', fontSize: fontSize.sm }}>
                        {diff > 0 ? `+${diff} ${S.surplus}` : `${diff} ${S.shortage}`}
                      </Text>
                    </View>
                  </View>
                ))
              )}
              <Text style={styles.reviewWarning}>{S.completeWarning}</Text>
            </ScrollView>
            <Pressable
              style={[styles.submitButton, completeMutation.isPending && styles.disabled]}
              onPress={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              <Ionicons name="shield-checkmark" size={18} color={colors.onPrimary} />
              <Text style={styles.submitText}>{completeMutation.isPending ? S.completing : S.confirmComplete}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerAction: { flexDirection: ROW, alignItems: 'center', gap: spacing.md },
  sessionMeta: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right', marginBottom: spacing.sm },
  banner: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  bannerError: { backgroundColor: colors.dangerSoft },
  bannerWarning: { backgroundColor: colors.warningSoft },
  bannerText: { flex: 1, fontSize: fontSize.sm, textAlign: 'right', writingDirection: 'rtl' },
  searchRow: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: fontSize.sm, color: colors.text, textAlign: 'right' },
  listContent: { paddingBottom: spacing.md, gap: spacing.xs },
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
  },
  diffValueRow: { flexDirection: ROW, alignItems: 'baseline', justifyContent: 'space-between' },
  diffValueLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  diffValueAmount: { fontSize: fontSize.md, fontWeight: '900' },
  diffValueCurrency: { fontSize: fontSize.xs, fontWeight: '700' },
  entryName: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  entryMeta: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right', writingDirection: 'rtl' },
  footer: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  progressRow: { flexDirection: ROW, justifyContent: 'space-between' },
  progressText: { color: colors.textSecondary, fontSize: fontSize.sm, writingDirection: 'rtl' },
  submitButton: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    ...shadow.button,
  },
  submitText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },
  disabled: { opacity: 0.6 },
  cancelText: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.xs },
  reviewBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  reviewCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '80%',
    padding: spacing.lg,
    gap: spacing.md,
  },
  reviewHeader: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' },
  reviewTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  reviewBody: { gap: spacing.sm },
  reviewOk: { color: colors.success, fontSize: fontSize.md, textAlign: 'center', paddingVertical: spacing.lg },
  reviewRow: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  reviewInfo: { flex: 1, gap: 2 },
  diffBadge: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 4 },
  reviewWarning: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.sm },
})
