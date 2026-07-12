import { useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { checkBarcode, searchProducts } from '@/api/endpoints/inventory'
import {
  confirmTransferReceipt,
  createTransfer,
  deriveBranchOptions,
  fetchBranchOptions,
  fetchTransfers,
  parseTransferItems,
  type BranchOption,
  type Transfer,
} from '@/api/endpoints/transfers'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { UpgradeState } from '@/components/UpgradeState'
import { CollapsibleScanner } from '@/components/stock/CollapsibleScanner'
import { QtyInputModal } from '@/components/stock/QtyInputModal'
import { chipFor, StatusChip, TRANSFER_STATUS } from '@/components/stock/StatusChip'
import { useFeature } from '@/hooks/useFeature'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime } from '@/utils/format'

const S = {
  title: 'التحويلات بين الفروع',
  incoming: 'تحويلات واردة إلى فرعي',
  outgoing: 'تحويلاتي الصادرة',
  newTransfer: 'تحويل جديد',
  confirmReceipt: 'تأكيد الاستلام',
  confirming: 'جارٍ التأكيد…',
  confirmTitle: 'تأكيد استلام التحويل؟',
  confirmMsg: 'ستُنقل الكميات إلى مخزون فرعك — لا يمكن التراجع',
  receiptDone: 'تم استلام التحويل ونقل الكميات إلى فرعك',
  waitingApproval: 'بانتظار موافقة المدير قبل التمكن من الاستلام',
  from: 'من',
  to: 'إلى',
  items: 'صنف',
  emptyIncoming: 'لا توجد تحويلات واردة',
  emptyOutgoing: 'لا توجد تحويلات صادرة',
  // نموذج الإنشاء
  targetBranch: 'الفرع المستهدف',
  noBranches: 'لا توجد فروع معروفة للتحويل إليها — تظهر الفروع من سجل التحويلات السابقة',
  productSearch: 'ابحث عن منتج بالاسم…',
  scanToAdd: 'مسح منتج لإضافته',
  addedItems: 'الأصناف المضافة',
  noItems: 'أضف منتجًا واحدًا على الأقل بالمسح أو البحث',
  notes: 'ملاحظات (اختياري)',
  create: 'إرسال طلب التحويل',
  creating: 'جارٍ الإرسال…',
  created: 'أُنشئ التحويل بنجاح — بانتظار موافقة المدير',
  chooseBranchFirst: 'اختر الفرع المستهدف أولًا',
  notFound: 'المنتج غير موجود',
  noBranchAccount: 'حسابك غير مرتبط بفرع — لا يمكن إنشاء تحويلات',
  enterQty: 'أدخل الكمية (بالوحدة الأساسية)',
  stock: 'المتوفر',
}

interface FormItem {
  productId: string
  name: string
  unitId: string
  quantity: number
}

interface PendingProduct {
  productId: string
  name: string
  unitId: string
  stock: number | null
}

/** الوحدة الأساسية للمنتج: conversionFactor = 1 وإلا أول وحدة. */
function baseUnit<T extends { conversionFactor: number }>(units: T[]): T | undefined {
  return units.find(u => u.conversionFactor === 1) ?? units[0]
}

export default function TransfersScreen() {
  const hasTransfers = useFeature('stock_transfers')
  const myBranchId = useAuthStore(s => s.user?.branchId ?? null)
  const queryClient = useQueryClient()

  const [banner, setBanner] = useState<string | null>(null)

  // نموذج الإنشاء
  const [createOpen, setCreateOpen] = useState(false)
  const [toBranchId, setToBranchId] = useState<string | null>(null)
  const [items, setItems] = useState<FormItem[]>([])
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<PendingProduct | null>(null)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [scanBusy, setScanBusy] = useState(false)

  const transfersQuery = useQuery({
    queryKey: ['transfers'],
    queryFn: () => fetchTransfers(),
    enabled: hasTransfers,
  })

  // محاولة /api/branches (محجوبة حاليًا لأمين المخزن — نشتق البديل من السجل)
  const branchesQuery = useQuery({
    queryKey: ['branch-options'],
    queryFn: fetchBranchOptions,
    enabled: hasTransfers,
    staleTime: 5 * 60_000,
  })

  const trimmed = search.trim()
  const searchQuery = useQuery({
    queryKey: ['product-search', trimmed, myBranchId],
    queryFn: () => searchProducts(trimmed, myBranchId),
    enabled: hasTransfers && createOpen && trimmed.length >= 2,
  })

  const branchOptions: BranchOption[] = useMemo(() => {
    const merged = new Map<string, string>()
    for (const b of deriveBranchOptions(transfersQuery.data ?? [])) merged.set(b.id, b.name)
    for (const b of branchesQuery.data ?? []) merged.set(b.id, b.name)
    if (myBranchId) merged.delete(myBranchId)
    return Array.from(merged.entries()).map(([id, name]) => ({ id, name }))
  }, [transfersQuery.data, branchesQuery.data, myBranchId])

  const incoming = useMemo(
    () =>
      (transfersQuery.data ?? []).filter(
        t => t.toBranchId === myBranchId && ['PENDING', 'APPROVED'].includes(t.status),
      ),
    [transfersQuery.data, myBranchId],
  )

  const outgoing = useMemo(
    () => (transfersQuery.data ?? []).filter(t => t.fromBranchId === myBranchId),
    [transfersQuery.data, myBranchId],
  )

  const receiptMutation = useMutation({
    mutationFn: (id: string) => confirmTransferReceipt(id),
    onSuccess: () => {
      setBanner(null)
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      Alert.alert(ar.common.confirm, S.receiptDone)
    },
    onError: err => setBanner(err instanceof ApiError ? err.message : ar.common.unexpectedError),
  })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!myBranchId) throw new ApiError(0, S.noBranchAccount)
      if (!toBranchId) throw new ApiError(0, S.chooseBranchFirst)
      return createTransfer({
        fromBranchId: myBranchId,
        toBranchId,
        items: items.map(i => ({ productId: i.productId, unitId: i.unitId, quantity: i.quantity })),
        notes: notes.trim() || undefined,
      })
    },
    onSuccess: () => {
      // نجاح مؤكد فقط يمسح النموذج
      setCreateOpen(false)
      setToBranchId(null)
      setItems([])
      setNotes('')
      setSearch('')
      setFormError(null)
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      Alert.alert(ar.common.confirm, S.created)
    },
    onError: err => setFormError(err instanceof ApiError ? err.message : ar.common.unexpectedError),
  })

  const onScannedInForm = async (code: string) => {
    if (scanBusy) return
    setScanBusy(true)
    setFormError(null)
    try {
      const res = await checkBarcode(code)
      if (!res.found || !res.product) {
        setFormError(S.notFound)
        return
      }
      const unit = baseUnit(res.product.units)
      if (!unit) {
        setFormError(S.notFound)
        return
      }
      setPending({ productId: res.product.id, name: res.product.name, unitId: unit.id, stock: res.product.baseStock })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setFormError(S.notFound)
      else setFormError(err instanceof ApiError ? err.message : ar.common.unexpectedError)
    } finally {
      setScanBusy(false)
    }
  }

  const addItem = (qty: number) => {
    if (pending) {
      setItems(prev => {
        const at = prev.findIndex(i => i.productId === pending.productId && i.unitId === pending.unitId)
        if (at >= 0) {
          const next = [...prev]
          next[at] = { ...next[at], quantity: qty }
          return next
        }
        return [...prev, { productId: pending.productId, name: pending.name, unitId: pending.unitId, quantity: qty }]
      })
      setPending(null)
    } else if (editIndex !== null) {
      setItems(prev => prev.map((it, i) => (i === editIndex ? { ...it, quantity: qty } : it)))
      setEditIndex(null)
    }
  }

  const confirmReceipt = (t: Transfer) => {
    Alert.alert(S.confirmTitle, S.confirmMsg, [
      { text: ar.common.cancel, style: 'cancel' },
      { text: ar.common.confirm, onPress: () => receiptMutation.mutate(t.id) },
    ])
  }

  // ── بوابة الخطة (FR-017) ──────────────────────────────────────────────────
  if (!hasTransfers) {
    return (
      <Screen title={S.title} scroll={false}>
        <UpgradeState />
      </Screen>
    )
  }

  if (transfersQuery.isLoading) {
    return (
      <Screen title={S.title} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (transfersQuery.isError) {
    return (
      <Screen title={S.title} scroll={false}>
        <ErrorState error={transfersQuery.error} onRetry={() => transfersQuery.refetch()} />
      </Screen>
    )
  }

  const renderTransfer = (t: Transfer, isIncoming: boolean) => {
    const chip = chipFor(TRANSFER_STATUS, t.status)
    const count = parseTransferItems(t).length
    return (
      <View key={t.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <StatusChip {...chip} />
          <Text style={styles.date}>{formatDateTime(t.createdAt)}</Text>
        </View>
        <Text style={styles.route}>
          {S.from}: {t.fromBranch?.name ?? '—'} ← {S.to}: {t.toBranch?.name ?? '—'}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.meta}>
            {count} {S.items}
          </Text>
          {isIncoming && t.status === 'APPROVED' ? (
            <Pressable
              style={[styles.receiptButton, receiptMutation.isPending && styles.disabled]}
              onPress={() => confirmReceipt(t)}
              disabled={receiptMutation.isPending}
            >
              <Ionicons name="checkmark-circle" size={16} color={colors.onPrimary} />
              <Text style={styles.receiptText}>
                {receiptMutation.isPending ? S.confirming : S.confirmReceipt}
              </Text>
            </Pressable>
          ) : isIncoming && t.status === 'PENDING' ? (
            <Text style={styles.waiting}>{S.waitingApproval}</Text>
          ) : null}
        </View>
        {t.notes ? <Text style={styles.notes}>{t.notes}</Text> : null}
      </View>
    )
  }

  return (
    <Screen
      title={S.title}
      refreshing={transfersQuery.isRefetching}
      onRefresh={() => transfersQuery.refetch()}
    >
      <Pressable
        style={[styles.newButton, !myBranchId && styles.disabled]}
        onPress={() => (myBranchId ? setCreateOpen(true) : setBanner(S.noBranchAccount))}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.onPrimary} />
        <Text style={styles.newButtonText}>{S.newTransfer}</Text>
      </Pressable>

      {banner ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{banner}</Text>
          <Pressable onPress={() => setBanner(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>{S.incoming}</Text>
      {incoming.length === 0 ? (
        <EmptyState icon="arrow-down-circle-outline" message={S.emptyIncoming} />
      ) : (
        incoming.map(t => renderTransfer(t, true))
      )}

      <Text style={styles.sectionTitle}>{S.outgoing}</Text>
      {outgoing.length === 0 ? (
        <EmptyState icon="arrow-up-circle-outline" message={S.emptyOutgoing} />
      ) : (
        outgoing.map(t => renderTransfer(t, false))
      )}

      {/* نموذج إنشاء تحويل */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{S.newTransfer}</Text>
              <Pressable onPress={() => setCreateOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{S.targetBranch}</Text>
              {branchOptions.length === 0 ? (
                <Text style={styles.hint}>{S.noBranches}</Text>
              ) : (
                <View style={styles.branchChips}>
                  {branchOptions.map(b => (
                    <Pressable
                      key={b.id}
                      style={[styles.branchChip, toBranchId === b.id && styles.branchChipActive]}
                      onPress={() => setToBranchId(b.id)}
                    >
                      <Text style={[styles.branchChipText, toBranchId === b.id && styles.branchChipTextActive]}>
                        {b.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <CollapsibleScanner onScanned={onScannedInForm} paused={scanBusy || pending !== null} openLabel={S.scanToAdd} />

              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={S.productSearch}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              {trimmed.length >= 2 && searchQuery.data
                ? searchQuery.data.slice(0, 8).map(p => {
                    const unit = baseUnit(p.units)
                    if (!unit) return null
                    return (
                      <Pressable
                        key={p.id}
                        style={styles.searchResult}
                        onPress={() => {
                          setPending({ productId: p.id, name: p.name, unitId: unit.unitId, stock: p.baseStock })
                          setSearch('')
                        }}
                      >
                        <Text style={styles.searchResultName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.searchResultStock}>
                          {S.stock}: {p.baseStock}
                        </Text>
                      </Pressable>
                    )
                  })
                : null}

              <Text style={styles.fieldLabel}>{S.addedItems}</Text>
              {items.length === 0 ? (
                <Text style={styles.hint}>{S.noItems}</Text>
              ) : (
                items.map((it, idx) => (
                  <View key={`${it.productId}-${it.unitId}`} style={styles.itemRow}>
                    <Pressable style={styles.itemInfo} onPress={() => setEditIndex(idx)}>
                      <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                      <Text style={styles.itemQty}>× {it.quantity}</Text>
                    </Pressable>
                    <Pressable onPress={() => setItems(prev => prev.filter((_, i) => i !== idx))} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                ))
              )}

              <Text style={styles.fieldLabel}>{S.notes}</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder={S.notes}
                placeholderTextColor={colors.textMuted}
                multiline
              />

              {formError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <Pressable
                style={[
                  styles.newButton,
                  (createMutation.isPending || !toBranchId || items.length === 0) && styles.disabled,
                ]}
                onPress={() => createMutation.mutate()}
                disabled={createMutation.isPending || !toBranchId || items.length === 0}
              >
                <Ionicons name="paper-plane-outline" size={18} color={colors.onPrimary} />
                <Text style={styles.newButtonText}>{createMutation.isPending ? S.creating : S.create}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* كمية المنتج المضاف/المعدَّل */}
      <QtyInputModal
        visible={pending !== null || editIndex !== null}
        title={pending?.name ?? (editIndex !== null ? items[editIndex]?.name ?? '' : '')}
        subtitle={
          pending?.stock != null ? `${S.stock}: ${pending.stock} — ${S.enterQty}` : S.enterQty
        }
        initialValue={editIndex !== null ? String(items[editIndex]?.quantity ?? '') : ''}
        onConfirm={qty => {
          if (qty > 0) addItem(qty)
          else {
            setPending(null)
            setEditIndex(null)
          }
        }}
        onClose={() => {
          setPending(null)
          setEditIndex(null)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    marginBottom: spacing.sm,
    ...shadow.button,
  },
  newButtonText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },
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
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { color: colors.textMuted, fontSize: fontSize.xs },
  route: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  meta: { color: colors.textSecondary, fontSize: fontSize.sm },
  waiting: { color: colors.warning, fontSize: fontSize.xs, flex: 1, textAlign: 'left' },
  notes: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right' },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  receiptText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  modalBody: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  hint: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'right' },
  branchChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  branchChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  branchChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  branchChipText: { color: colors.text, fontSize: fontSize.sm },
  branchChipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: fontSize.sm, color: colors.text, textAlign: 'right' },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  searchResultName: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  searchResultStock: { color: colors.textSecondary, fontSize: fontSize.xs },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  itemInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  itemName: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  itemQty: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800' },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlign: 'right',
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
})
