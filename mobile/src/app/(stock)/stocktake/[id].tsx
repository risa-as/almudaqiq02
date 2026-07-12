import { useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { checkBarcode } from '@/api/endpoints/inventory'
import {
  cancelStocktake,
  completeStocktake,
  fetchStocktakeSession,
  saveStocktakeCounts,
  type StocktakeItem,
} from '@/api/endpoints/stocktake'
import { BarcodeScannerView } from '@/components/BarcodeScannerView'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { QtyInputModal } from '@/components/stock/QtyInputModal'
import { chipFor, StatusChip, STOCKTAKE_STATUS } from '@/components/stock/StatusChip'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime } from '@/utils/format'

const S = {
  title: 'جلسة الجرد',
  searchPlaceholder: 'ابحث عن منتج لعدّه يدويًا…',
  recorded: 'المسجّل',
  counted: 'المعدود',
  diff: 'الفرق',
  countAction: 'عدّ',
  recount: 'تعديل',
  notFound: 'المنتج غير موجود',
  notInSession: 'هذا المنتج غير مدرج في جلسة الجرد',
  noEntries: 'لم يُعدّ أي منتج بعد — امسح باركود أو ابحث بالاسم',
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
  completedMsg: 'تم اعتماد الجرد وتطبيق الفروقات على المخزون',
  enterCount: 'أدخل الكمية المعدودة',
  surplus: 'زيادة',
  shortage: 'نقص',
  progress: (c: number, t: number) => `المعدود: ${c} من ${t}`,
}

/** لون الفرق: صفر أخضر / نقص أحمر / زيادة كهرماني */
function diffColor(diff: number): string {
  if (diff === 0) return colors.success
  return diff < 0 ? colors.danger : colors.warning
}

export default function StocktakeSession() {
  const params = useLocalSearchParams<{ id: string }>()
  const sessionId = typeof params.id === 'string' ? params.id : ''
  const queryClient = useQueryClient()

  // العدّات المحلية — تبقى حيّة عبر دورات المسح وبعد أي فشل إرسال (FR-015)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [pendingItem, setPendingItem] = useState<StocktakeItem | null>(null)
  const [search, setSearch] = useState('')
  const [banner, setBanner] = useState<{ kind: 'error' | 'warning'; text: string } | null>(null)
  const [scanBusy, setScanBusy] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const sessionQuery = useQuery({
    queryKey: ['stocktake-session', sessionId],
    queryFn: () => fetchStocktakeSession(sessionId),
    enabled: !!sessionId,
  })

  const detail = sessionQuery.data
  const isDraft = detail?.status === 'DRAFT'

  /** القيمة المعدودة الفعلية لعنصر: المحلية أولًا ثم المحفوظة خادميًا */
  const countedOf = (item: StocktakeItem): number | null => {
    const local = counts[item.id]
    if (local !== undefined && local !== '') return Number(local)
    return item.countedQty
  }

  const entries = useMemo(
    () => (detail?.items ?? []).filter(i => countedOf(i) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail?.items, counts],
  )

  const discrepancies = useMemo(
    () =>
      entries
        .map(i => ({ item: i, counted: countedOf(i) as number }))
        .map(e => ({ ...e, diff: e.counted - e.item.expectedQty }))
        .filter(e => e.diff !== 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, counts],
  )

  const searchResults = useMemo(() => {
    const q = search.trim()
    if (!q || !detail) return []
    return detail.items.filter(i => i.productName.includes(q)).slice(0, 20)
  }, [search, detail])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = Object.entries(counts)
        .filter(([, v]) => v !== '')
        .map(([itemId, v]) => ({ itemId, countedQty: Math.max(0, Math.round(Number(v))) }))
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
      Alert.alert(ar.common.confirm, S.completedMsg, [{ text: ar.common.close, onPress: () => router.back() }])
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

  const onScanned = async (code: string) => {
    if (scanBusy || !detail || !isDraft) return
    setScanBusy(true)
    setBanner(null)
    try {
      const res = await checkBarcode(code)
      if (!res.found || !res.product) {
        setBanner({ kind: 'error', text: S.notFound })
        return
      }
      const productId = res.product.id
      const item = detail.items.find(i => i.productId === productId)
      if (!item) {
        setBanner({ kind: 'warning', text: S.notInSession })
        return
      }
      setPendingItem(item)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setBanner({ kind: 'error', text: S.notFound })
      else setBanner({ kind: 'error', text: err instanceof ApiError ? err.message : ar.common.unexpectedError })
    } finally {
      setScanBusy(false)
    }
  }

  const confirmCancel = () => {
    Alert.alert(S.cancelConfirmTitle, S.cancelConfirmMsg, [
      { text: ar.common.cancel, style: 'cancel' },
      { text: ar.common.confirm, style: 'destructive', onPress: () => cancelMutation.mutate() },
    ])
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

      {isDraft ? (
        <BarcodeScannerView onScanned={onScanned} paused={scanBusy || pendingItem !== null || reviewOpen} height={200} />
      ) : null}

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

      {isDraft ? (
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
      ) : null}

      {/* نتائج البحث اليدوي (بديل كامل عن الكاميرا — FR-012) */}
      {isDraft && search.trim() ? (
        <FlatList
          data={searchResults}
          keyExtractor={i => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState icon="search-outline" />}
          renderItem={({ item }) => {
            const counted = countedOf(item)
            return (
              <Pressable style={styles.searchItem} onPress={() => { setPendingItem(item); setSearch('') }}>
                <View style={styles.searchItemInfo}>
                  <Text style={styles.entryName} numberOfLines={1}>{item.productName}</Text>
                  <Text style={styles.entryMeta}>
                    {S.recorded}: {item.expectedQty}
                    {counted !== null ? ` • ${S.counted}: ${counted}` : ''}
                  </Text>
                </View>
                <View style={styles.countButton}>
                  <Text style={styles.countButtonText}>{counted !== null ? S.recount : S.countAction}</Text>
                </View>
              </Pressable>
            )
          }}
        />
      ) : (
        <>
          {/* جدول العدّات: الاسم / المسجّل / المعدود / الفرق الملوّن */}
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.thName]}>المنتج</Text>
            <Text style={styles.th}>{S.recorded}</Text>
            <Text style={styles.th}>{S.counted}</Text>
            <Text style={styles.th}>{S.diff}</Text>
          </View>
          <FlatList
            data={entries}
            keyExtractor={i => i.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<EmptyState icon="clipboard-outline" message={isDraft ? S.noEntries : ar.common.empty} />}
            renderItem={({ item }) => {
              const counted = countedOf(item) as number
              const diff = counted - item.expectedQty
              return (
                <Pressable style={styles.entryRow} disabled={!isDraft} onPress={() => setPendingItem(item)}>
                  <Text style={[styles.td, styles.tdName]} numberOfLines={1}>{item.productName}</Text>
                  <Text style={styles.td}>{item.expectedQty}</Text>
                  <Text style={[styles.td, styles.tdCounted]}>{counted}</Text>
                  <Text style={[styles.td, { color: diffColor(diff), fontWeight: '800' }]}>
                    {diff > 0 ? `+${diff}` : diff}
                  </Text>
                </Pressable>
              )
            }}
          />
        </>
      )}

      {/* شريط سفلي: تقدم + إرسال (خطوة أولى) + إلغاء الجلسة */}
      {isDraft ? (
        <View style={styles.footer}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>{S.progress(entries.length, detail.items.length)}</Text>
            {discrepancies.length > 0 ? (
              <Text style={[styles.progressText, { color: colors.warning }]}>فروقات: {discrepancies.length}</Text>
            ) : null}
          </View>
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

      {/* إدخال الكمية بعد المسح/الاختيار */}
      <QtyInputModal
        visible={pendingItem !== null}
        title={pendingItem?.productName ?? ''}
        subtitle={pendingItem ? `${S.recorded}: ${pendingItem.expectedQty} — ${S.enterCount}` : undefined}
        initialValue={
          pendingItem
            ? counts[pendingItem.id] ?? (pendingItem.countedQty !== null ? String(pendingItem.countedQty) : '')
            : ''
        }
        onConfirm={qty => {
          if (pendingItem) setCounts(prev => ({ ...prev, [pendingItem.id]: String(qty) }))
          setPendingItem(null)
        }}
        onClose={() => setPendingItem(null)}
      />

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
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sessionMeta: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right', marginBottom: spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  bannerError: { backgroundColor: colors.dangerSoft },
  bannerWarning: { backgroundColor: colors.warningSoft },
  bannerText: { flex: 1, fontSize: fontSize.sm, textAlign: 'right' },
  searchRow: {
    flexDirection: 'row',
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
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  searchItemInfo: { flex: 1, gap: 2 },
  countButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  countButtonText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  th: { width: 64, color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', textAlign: 'center' },
  thName: { flex: 1, width: undefined, textAlign: 'right' },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow.card,
  },
  td: { width: 64, color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' },
  tdName: { flex: 1, width: undefined, color: colors.text, fontWeight: '600', textAlign: 'right' },
  tdCounted: { color: colors.text, fontWeight: '700' },
  entryName: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  entryMeta: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right' },
  footer: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: colors.textSecondary, fontSize: fontSize.sm },
  submitButton: {
    flexDirection: 'row',
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
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  reviewBody: { gap: spacing.sm },
  reviewOk: { color: colors.success, fontSize: fontSize.md, textAlign: 'center', paddingVertical: spacing.lg },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reviewInfo: { flex: 1, gap: 2 },
  diffBadge: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 4 },
  reviewWarning: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.sm },
})
