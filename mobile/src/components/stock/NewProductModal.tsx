import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { createProduct, fetchCategories } from '@/api/endpoints/inventory'
import { fetchSuppliers } from '@/api/endpoints/suppliers'
import { ar } from '@/i18n/ar'
import { formatMoney } from '@/utils/format'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const t = {
  title: 'إضافة منتج جديد',
  subtitle: 'الباركود غير مسجّل — أدخل بيانات المنتج',
  basics: 'البيانات الأساسية',
  name: 'اسم المنتج',
  namePlaceholder: 'مثال: بيبسي 330 مل',
  description: 'الوصف (اختياري)',
  descriptionPlaceholder: 'وصف مختصر…',
  category: 'القسم / التصنيف',
  noCategory: 'بدون قسم',
  pickCategory: '— اختر القسم —',
  supplier: 'المورد المعتاد (اختياري)',
  noSupplier: 'بدون مورد',
  pickSupplier: '— اختر المورد —',
  pickerSearch: 'ابحث…',
  pickerEmpty: 'لا توجد نتائج مطابقة',
  prepaid: 'تم شراء الكمية الابتدائية مسبقاً',
  prepaidNote: 'مدفوع بالكامل — لا دين على المورد',
  supplierDebtNote: 'سيُسجَّل شراء بالآجل على هذا المورد بقيمة الكمية الابتدائية',
  baseCost: 'تكلفة الشراء (للوحدة الأصغر)',
  minimumStock: 'الحد الأدنى للمخزون',
  expiry: 'تاريخ الصلاحية (اختياري)',
  expiryPlaceholder: 'YYYY-MM-DD',
  units: 'الوحدات والتسعير',
  unitCount: (n: number) => `${n} وحدة`,
  unitName: 'اسم الوحدة',
  unitNamePlaceholder: 'قطعة',
  conversion: 'المعامل',
  barcode: 'الباركود',
  initialQty: 'الكمية الأولية',
  price: 'سعر البيع',
  addUnit: 'إضافة وحدة',
  totalBase: 'المخزون الأولي الإجمالي',
  totalBaseNote: '= مجموع (الكمية × المعامل) لكل وحدة',
  baseUnit: 'قطعة (وحدة أساسية)',
  save: 'حفظ المنتج',
  saving: 'جارٍ الحفظ…',
  loadFailed: 'تعذّر تحميل القائمة',
  retry: 'إعادة المحاولة',
  nameRequired: 'أدخل اسم المنتج',
  unitNameRequired: 'أدخل اسمًا لكل وحدة',
  priceRequired: 'أدخل سعر بيع أكبر من صفر لكل وحدة',
  conversionRequired: 'معامل التحويل يجب أن يكون 1 أو أكثر',
  expiryInvalid: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)',
}

interface UnitInput {
  name: string
  conversion: string
  barcode: string
  price: string
  initialQty: string
}

interface NewProductModalProps {
  visible: boolean
  /** الباركود المقروء الذي لم يُعثر عليه — القيمة الابتدائية لوحدة أولى */
  barcode: string
  branchId?: string | null
  onClose: () => void
  onCreated: (name: string) => void
}

/**
 * إضافة منتج من الماسح عند عدم العثور على الباركود — بنفس حقول صفحة الويب
 * «إضافة منتج» (app/(tenant)/inventory/new): الاسم والوصف والقسم والمورد
 * والتكلفة والحد الأدنى والصلاحية، وجدول وحدات متعدّد الصفوف.
 *
 * تصفير الحقول يتم بإعادة التركيب من الأب (يُركَّب فقط عند وجود باركود، وبمفتاح
 * الباركود) لا بمؤثّر يستدعي setState — فلا حاجة لإعادة تهيئة يدوية هنا.
 */
export function NewProductModal({ visible, barcode, branchId, onClose, onCreated }: NewProductModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseCost, setBaseCost] = useState('')
  const [minimumStock, setMinimumStock] = useState('')
  const [expiry, setExpiry] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [isPrepaid, setIsPrepaid] = useState(false)
  const [units, setUnits] = useState<UnitInput[]>([
    { name: 'قطعة', conversion: '1', barcode, price: '', initialQty: '' },
  ])
  const [formError, setFormError] = useState<string | null>(null)
  /** أي قائمة اختيار مفتوحة حاليًا — تُعرض كطبقة داخل نفس الورقة */
  const [picker, setPicker] = useState<'category' | 'supplier' | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: visible,
    staleTime: 5 * 60_000,
  })
  const suppliersQuery = useQuery({
    queryKey: ['suppliers', branchId ?? 'all'],
    queryFn: () => fetchSuppliers(branchId),
    enabled: visible,
    staleTime: 5 * 60_000,
  })

  const totalBaseQty = units.reduce(
    (sum, u) => sum + (Number(u.initialQty) || 0) * (Number(u.conversion) || 1),
    0,
  )

  const categories = categoriesQuery.data ?? []
  const suppliers = suppliersQuery.data ?? []
  const selectedCategoryName = categories.find(c => c.id === categoryId)?.name
  const selectedSupplierName = suppliers.find(s => s.id === supplierId)?.name

  const openPicker = (which: 'category' | 'supplier') => {
    setPickerSearch('')
    setPicker(which)
  }

  const pickerConfig =
    picker === 'category'
      ? {
          title: t.category,
          emptyLabel: t.noCategory,
          options: categories.map(c => ({ id: c.id, name: c.name })),
          selectedId: categoryId,
          onSelect: (id: string | null) => setCategoryId(id),
        }
      : picker === 'supplier'
        ? {
            title: t.supplier,
            emptyLabel: t.noSupplier,
            options: suppliers.map(s => ({ id: s.id, name: s.name })),
            selectedId: supplierId,
            // تغيير المورد يُلغي «مدفوع مسبقًا» — نفس سلوك الويب
            onSelect: (id: string | null) => {
              setSupplierId(id)
              setIsPrepaid(false)
            },
          }
        : null

  const pickerResults =
    pickerConfig && pickerSearch.trim()
      ? pickerConfig.options.filter(o => o.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
      : (pickerConfig?.options ?? [])

  const updateUnit = (index: number, field: keyof UnitInput, value: string) =>
    setUnits(list => list.map((unit, i) => (i === index ? { ...unit, [field]: value } : unit)))

  const addUnit = () =>
    setUnits(list => [...list, { name: '', conversion: '1', barcode: '', price: '', initialQty: '' }])

  const removeUnit = (index: number) =>
    setUnits(list => (list.length > 1 ? list.filter((_, i) => i !== index) : list))

  const mutation = useMutation({
    mutationFn: () =>
      createProduct({
        name: name.trim(),
        description: description.trim(),
        baseCost: Number(baseCost) || 0,
        minimumStock: Number(minimumStock) || 0,
        categoryId,
        supplierId,
        expiryDate: expiry.trim() || null,
        isPrepaid,
        units: units.map(u => ({
          name: u.name.trim(),
          conversion: Number(u.conversion) || 1,
          barcode: u.barcode.trim(),
          price: Number(u.price) || 0,
          initialQty: Number(u.initialQty) || 0,
        })),
      }),
    onSuccess: () => onCreated(name.trim()),
    onError: (err: unknown) => setFormError(err instanceof ApiError ? err.message : ar.common.unexpectedError),
  })

  const submit = () => {
    if (!name.trim()) return setFormError(t.nameRequired)
    if (units.some(u => !u.name.trim())) return setFormError(t.unitNameRequired)
    if (units.some(u => (Number(u.conversion) || 0) < 1)) return setFormError(t.conversionRequired)
    // الخادم يقبل سعر 0 — نمنعه هنا حتى لا تُنشأ وحدة غير قابلة للبيع على الصندوق
    if (units.some(u => !(Number(u.price) > 0))) return setFormError(t.priceRequired)
    if (expiry.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(expiry.trim())) return setFormError(t.expiryInvalid)
    setFormError(null)
    mutation.mutate()
  }

  const saving = mutation.isPending

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={saving ? undefined : onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView style={styles.flexEnd} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{t.title}</Text>
                <Text style={styles.subtitle}>{t.subtitle}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8} disabled={saving}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <SectionTitle icon="cube-outline" label={t.basics} />

              <Field label={t.name}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t.namePlaceholder}
                  placeholderTextColor={colors.textMuted}
                  textAlign="right"
                  editable={!saving}
                  autoFocus
                />
              </Field>

              <Field label={t.description}>
                <TextInput
                  style={styles.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t.descriptionPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  textAlign="right"
                  editable={!saving}
                />
              </Field>

              <Field label={t.category}>
                <SelectField
                  value={selectedCategoryName}
                  placeholder={t.pickCategory}
                  emptyLabel={t.noCategory}
                  isEmptySelection={categoryId === null}
                  onPress={() => openPicker('category')}
                  loading={categoriesQuery.isPending}
                  failed={categoriesQuery.isError}
                  onRetry={() => categoriesQuery.refetch()}
                  disabled={saving}
                />
              </Field>

              <Field label={t.supplier}>
                <SelectField
                  value={selectedSupplierName}
                  placeholder={t.pickSupplier}
                  emptyLabel={t.noSupplier}
                  isEmptySelection={supplierId === null}
                  onPress={() => openPicker('supplier')}
                  loading={suppliersQuery.isPending}
                  failed={suppliersQuery.isError}
                  onRetry={() => suppliersQuery.refetch()}
                  disabled={saving}
                />
              </Field>

              {/* نفس شرط الويب: يظهر خيار الدفع المسبق عند وجود مورد وكمية ابتدائية */}
              {supplierId && totalBaseQty > 0 ? (
                <>
                  <Pressable style={styles.checkRow} onPress={() => setIsPrepaid(v => !v)} disabled={saving}>
                    <View style={[styles.checkBox, isPrepaid && styles.checkBoxOn]}>
                      {isPrepaid ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
                    </View>
                    <View style={styles.checkTextWrap}>
                      <Text style={styles.checkLabel}>{t.prepaid}</Text>
                      <Text style={styles.checkNote}>{t.prepaidNote}</Text>
                    </View>
                  </Pressable>
                  {!isPrepaid ? (
                    <View style={styles.warnBox}>
                      <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
                      <Text style={styles.warnText}>{t.supplierDebtNote}</Text>
                    </View>
                  ) : null}
                </>
              ) : null}

              <View style={styles.pairRow}>
                <Field label={t.baseCost} style={styles.pairItem}>
                  <TextInput
                    style={styles.input}
                    value={baseCost}
                    onChangeText={setBaseCost}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    textAlign="right"
                    editable={!saving}
                  />
                </Field>
                <Field label={t.minimumStock} style={styles.pairItem}>
                  <TextInput
                    style={styles.input}
                    value={minimumStock}
                    onChangeText={setMinimumStock}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    textAlign="right"
                    editable={!saving}
                  />
                </Field>
              </View>

              <Field label={t.expiry}>
                <TextInput
                  style={styles.input}
                  value={expiry}
                  onChangeText={setExpiry}
                  placeholder={t.expiryPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  textAlign="center"
                  editable={!saving}
                />
              </Field>

              <View style={styles.unitsHeader}>
                <SectionTitle icon="layers-outline" label={t.units} />
                <View style={styles.unitCountChip}>
                  <Text style={styles.unitCountText}>{t.unitCount(units.length)}</Text>
                </View>
              </View>

              {units.map((unit, index) => (
                <View key={index} style={styles.unitCard}>
                  <View style={styles.unitCardHeader}>
                    <Text style={styles.unitCardTitle}>{unit.name.trim() || t.unitNamePlaceholder}</Text>
                    {units.length > 1 ? (
                      <Pressable onPress={() => removeUnit(index)} hitSlop={8} disabled={saving}>
                        <Ionicons name="trash-outline" size={17} color={colors.danger} />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.pairRow}>
                    <Field label={t.unitName} style={styles.unitNameItem}>
                      <TextInput
                        style={styles.inputSm}
                        value={unit.name}
                        onChangeText={value => updateUnit(index, 'name', value)}
                        placeholder={t.unitNamePlaceholder}
                        placeholderTextColor={colors.textMuted}
                        textAlign="right"
                        editable={!saving}
                      />
                    </Field>
                    <Field label={t.conversion} style={styles.pairItem}>
                      <TextInput
                        style={styles.inputSm}
                        value={unit.conversion}
                        onChangeText={value => updateUnit(index, 'conversion', value)}
                        keyboardType="number-pad"
                        textAlign="center"
                        editable={!saving}
                      />
                    </Field>
                  </View>

                  <Field label={t.barcode}>
                    <View style={styles.barcodeWrap}>
                      <Ionicons name="barcode-outline" size={17} color={colors.primary} />
                      <TextInput
                        style={styles.barcodeInput}
                        value={unit.barcode}
                        onChangeText={value => updateUnit(index, 'barcode', value)}
                        keyboardType="number-pad"
                        textAlign="right"
                        editable={!saving}
                      />
                    </View>
                  </Field>

                  <View style={styles.pairRow}>
                    <Field label={t.price} style={styles.pairItem}>
                      <TextInput
                        style={styles.inputSm}
                        value={unit.price}
                        onChangeText={value => updateUnit(index, 'price', value)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        textAlign="right"
                        editable={!saving}
                      />
                    </Field>
                    <Field label={t.initialQty} style={styles.pairItem}>
                      <TextInput
                        style={styles.inputSm}
                        value={unit.initialQty}
                        onChangeText={value => updateUnit(index, 'initialQty', value)}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        textAlign="right"
                        editable={!saving}
                      />
                    </Field>
                  </View>
                </View>
              ))}

              <Pressable style={styles.addUnitButton} onPress={addUnit} disabled={saving}>
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={styles.addUnitText}>{t.addUnit}</Text>
              </Pressable>

              {totalBaseQty > 0 ? (
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>{t.totalBase}</Text>
                  <Text style={styles.totalValue}>
                    {formatMoney(totalBaseQty)} <Text style={styles.totalUnit}>{t.baseUnit}</Text>
                  </Text>
                  <Text style={styles.totalNote}>{t.totalBaseNote}</Text>
                </View>
              ) : null}

              {formError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}
            </ScrollView>

            <Pressable style={[styles.saveButton, saving && styles.saveDisabled]} onPress={submit} disabled={saving}>
              {saving ? (
                <>
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                  <Text style={styles.saveText}>{t.saving}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="save-outline" size={19} color={colors.onPrimary} />
                  <Text style={styles.saveText}>{t.save}</Text>
                </>
              )}
            </Pressable>

            {/* قائمة الاختيار: طبقة داخل الورقة نفسها لا نافذة أصلية متداخلة */}
            {pickerConfig ? (
              <View style={styles.pickerOverlay}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>{pickerConfig.title}</Text>
                  <Pressable style={styles.closeButton} onPress={() => setPicker(null)} hitSlop={8}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.pickerSearchWrap}>
                  <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={styles.pickerSearchInput}
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    placeholder={t.pickerSearch}
                    placeholderTextColor={colors.textMuted}
                    textAlign="right"
                    autoFocus
                    autoCorrect={false}
                  />
                  {pickerSearch.length > 0 ? (
                    <Pressable onPress={() => setPickerSearch('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>

                <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
                  {/* خيار «بدون» يبقى ظاهرًا دائمًا مهما كان البحث */}
                  <PickerRow
                    label={pickerConfig.emptyLabel}
                    muted
                    selected={pickerConfig.selectedId === null}
                    onPress={() => {
                      pickerConfig.onSelect(null)
                      setPicker(null)
                    }}
                  />
                  {pickerResults.map(option => (
                    <PickerRow
                      key={option.id}
                      label={option.name}
                      selected={pickerConfig.selectedId === option.id}
                      onPress={() => {
                        pickerConfig.onSelect(option.id)
                        setPicker(null)
                      }}
                    />
                  ))}
                  {pickerResults.length === 0 && pickerSearch.trim() ? (
                    <Text style={styles.pickerEmpty}>{t.pickerEmpty}</Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

function SectionTitle({ icon, label }: { icon: 'cube-outline' | 'layers-outline'; label: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.sectionTitleText}>{label}</Text>
    </View>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

/** زرّ اختيار يفتح قائمة قابلة للبحث — يُظهر فشل التحميل بدل ابتلاعه صامتًا. */
function SelectField({
  value,
  placeholder,
  emptyLabel,
  isEmptySelection,
  onPress,
  loading,
  failed,
  onRetry,
  disabled,
}: {
  value?: string
  placeholder: string
  emptyLabel: string
  isEmptySelection: boolean
  onPress: () => void
  loading: boolean
  failed: boolean
  onRetry: () => void
  disabled: boolean
}) {
  if (loading) {
    return (
      <View style={styles.selectButton}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    )
  }
  if (failed) {
    return (
      <Pressable style={styles.loadFailed} onPress={onRetry}>
        <Ionicons name="refresh" size={15} color={colors.danger} />
        <Text style={styles.loadFailedText}>{t.loadFailed} — {t.retry}</Text>
      </Pressable>
    )
  }
  // لا شيء مختار → نص «بدون…» رماديًا كي يتضح أنه ليس اسم عنصر
  const label = value ?? (isEmptySelection ? emptyLabel : placeholder)
  return (
    <Pressable style={styles.selectButton} onPress={onPress} disabled={disabled}>
      <Text style={[styles.selectValue, !value && styles.selectPlaceholder]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={17} color={colors.textMuted} />
    </Pressable>
  )
}

function PickerRow({
  label,
  selected,
  muted,
  onPress,
}: {
  label: string
  selected: boolean
  muted?: boolean
  onPress: () => void
}) {
  return (
    <Pressable style={[styles.pickerRow, selected && styles.pickerRowSelected]} onPress={onPress}>
      <Text style={[styles.pickerRowText, muted && styles.pickerRowMuted, selected && styles.pickerRowTextSelected]}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  flexEnd: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '94%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: ROW, alignItems: 'flex-start', gap: spacing.sm },
  headerText: { flex: 1, alignItems: ALIGN_RIGHT, gap: 2 },
  title: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'right' },
  subtitle: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'right', lineHeight: 18 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { gap: spacing.md, paddingBottom: spacing.md },
  sectionTitle: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  sectionTitleText: { fontSize: fontSize.sm, fontWeight: '800', color: colors.text },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary, textAlign: 'right' },
  input: {
    height: control.inputHeight,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputSm: {
    height: 42,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  barcodeWrap: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    height: 42,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  barcodeInput: { flex: 1, fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  pairRow: { flexDirection: ROW, gap: spacing.sm },
  pairItem: { flex: 1 },
  unitNameItem: { flex: 2 },
  selectButton: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    height: control.inputHeight,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  selectValue: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  selectPlaceholder: { color: colors.textMuted, fontWeight: '600' },
  // طبقة القائمة تغطي الورقة كاملة داخل نفس النافذة الأصلية
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pickerHeader: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pickerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'right' },
  pickerSearchWrap: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    height: control.inputHeight,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  pickerSearchInput: { flex: 1, fontSize: fontSize.md, color: colors.text },
  pickerList: { flex: 1 },
  pickerRow: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerRowSelected: { backgroundColor: colors.primarySoft, borderRadius: radius.md },
  pickerRowText: { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.text, textAlign: 'right' },
  pickerRowMuted: { color: colors.textMuted },
  pickerRowTextSelected: { color: colors.primary, fontWeight: '800' },
  pickerEmpty: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  loadFailed: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: ALIGN_RIGHT,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadFailedText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.danger },
  checkRow: { flexDirection: ROW, alignItems: 'flex-start', gap: spacing.sm },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkTextWrap: { flex: 1, alignItems: ALIGN_RIGHT },
  checkLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'right' },
  checkNote: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  warnBox: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  warnText: { flex: 1, fontSize: fontSize.xs, fontWeight: '700', color: '#B45309', textAlign: 'right' },
  unitsHeader: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  unitCountChip: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  unitCountText: { fontSize: fontSize.xs, fontWeight: '800', color: colors.success },
  unitCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  unitCardHeader: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' },
  unitCardTitle: { fontSize: fontSize.sm, fontWeight: '800', color: colors.text, textAlign: 'right' },
  addUnitButton: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.sm + 2,
  },
  addUnitText: { fontSize: fontSize.sm, fontWeight: '800', color: colors.primary },
  totalBox: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
    alignItems: ALIGN_RIGHT,
  },
  totalLabel: { fontSize: fontSize.xs, fontWeight: '800', color: colors.success },
  totalValue: { fontSize: fontSize.lg, fontWeight: '900', color: colors.success },
  totalUnit: { fontSize: fontSize.sm, fontWeight: '700' },
  totalNote: { fontSize: fontSize.xs, color: colors.success, opacity: 0.8 },
  errorBox: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSize.sm, textAlign: 'right' },
  saveButton: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: control.buttonHeight,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    ...shadow.button,
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '800' },
})
