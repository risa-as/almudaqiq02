import { useEffect, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import {
  productSearchKey,
  searchProducts,
  type ProductSearchResult,
  type ProductUnitDto,
} from '@/api/endpoints/products'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { formatMoney } from '@/utils/format'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

// نصوص خاصة بهذه الشاشة (النصوص المشتركة في i18n/ar فقط)
const t = {
  title: 'البحث عن منتج',
  placeholder: 'اكتب اسم المنتج أو الباركود…',
  hint: 'اكتب حرفين على الأقل للبحث',
  stock: 'المتوفر',
  noResults: 'لا توجد نتائج مطابقة',
  notFound: 'المنتج غير موجود — ابحث بالاسم',
}

const DEBOUNCE_MS = 300

interface ProductSearchSheetProps {
  visible: boolean
  onClose: () => void
  /** اختيار منتج + وحدة → يضيفه المستدعي للسلة */
  onPick: (product: ProductSearchResult, unit: ProductUnitDto) => void
  branchId?: string | null
  /** تنبيه يظهر أعلى الورقة (مثلاً «المنتج غير موجود» بعد مسح فاشل) */
  notice?: string | null
}

/**
 * ورقة البحث الخادمي بالاسم/الباركود (FR-012): بديل كامل للكاميرا.
 * منتج بوحدة واحدة → لمس الصف يضيفه؛ عدة وحدات → أزرار وحدات داخل الصف.
 */
export function ProductSearchSheet({ visible, onClose, onPick, branchId, notice }: ProductSearchSheetProps) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  // تفريغ البحث عند إغلاق الورقة
  useEffect(() => {
    if (!visible) {
      setQuery('')
      setDebounced('')
    }
  }, [visible])

  const enabled = visible && debounced.length >= 2
  const search = useQuery({
    queryKey: productSearchKey(debounced, branchId),
    queryFn: () => searchProducts(debounced, branchId),
    enabled,
  })

  const renderItem = ({ item }: { item: ProductSearchResult }) => {
    const singleUnit = item.units.length === 1 ? item.units[0] : null
    return (
      <Pressable
        style={styles.row}
        onPress={singleUnit ? () => onPick(item, singleUnit) : undefined}
        disabled={!singleUnit}
      >
        <View style={styles.rowHeader}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.stock, item.baseStock <= 0 && styles.stockOut]}>
            {t.stock}: {formatMoney(item.baseStock)}
          </Text>
        </View>
        <View style={styles.unitsRow}>
          {item.units.map(unit => (
            <Pressable key={unit.unitId} style={styles.unitChip} onPress={() => onPick(item, unit)}>
              <Text style={styles.unitName}>{unit.unitName}</Text>
              <Text style={styles.unitPrice}>{formatMoney(unit.price)}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.flexEnd}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>{t.title}</Text>
              <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {notice ? (
              <View style={styles.noticeBox}>
                <Ionicons name="alert-circle" size={16} color={colors.warning} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder={t.placeholder}
              placeholderTextColor={colors.textMuted}
              autoFocus
              textAlign="right"
            />

            <View style={styles.results}>
              {!enabled ? (
                <Text style={styles.hint}>{t.hint}</Text>
              ) : search.isPending ? (
                <LoadingView />
              ) : search.isError ? (
                <ErrorState error={search.error} onRetry={() => search.refetch()} />
              ) : search.data.length === 0 ? (
                <EmptyState message={t.noResults} icon="search-outline" />
              ) : (
                <FlatList
                  data={search.data}
                  keyExtractor={item => item.id}
                  renderItem={renderItem}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.list}
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  flexEnd: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    height: '80%',
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: { flex: 1, color: colors.warning, fontSize: fontSize.sm, textAlign: 'right' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  results: { flex: 1 },
  hint: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xl },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  stock: { fontSize: fontSize.xs, color: colors.textSecondary },
  stockOut: { color: colors.danger },
  unitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  unitName: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  unitPrice: { fontSize: fontSize.sm, color: colors.primary },
})
