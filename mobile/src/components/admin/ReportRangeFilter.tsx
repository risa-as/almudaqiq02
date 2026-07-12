import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { format, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import type { DateRange } from '@/api/endpoints/reports'
import { DateRangeModal } from './DateRangeModal'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

export type RangePreset = 'today' | 'week' | 'month' | 'custom'

const PRESETS: { key: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'هذا الأسبوع' },
  { key: 'month', label: 'هذا الشهر' },
]

const t = {
  custom: 'مخصص',
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

/** يحسب فترة (startDate/endDate) لكل زر جاهز — الأسبوع يبدأ السبت (المحلية العربية). */
function presetRange(p: Exclude<RangePreset, 'custom'>): DateRange {
  const now = new Date()
  switch (p) {
    case 'today':
      return { startDate: fmt(startOfDay(now)), endDate: fmt(now) }
    case 'week':
      return { startDate: fmt(startOfWeek(now, { weekStartsOn: 6 })), endDate: fmt(now) }
    case 'month':
      return { startDate: fmt(startOfMonth(now)), endDate: fmt(now) }
  }
}

interface ReportRangeFilterProps {
  /** يُستدعى بالفترة الفعّالة: null = الفترة الافتراضية للخادم (بدون تحديد). */
  onRangeChange: (range: DateRange | null) => void
}

/**
 * فلتر تقارير موحّد: أزرار جاهزة (اليوم/هذا الأسبوع/هذا الشهر) على شكل شريط
 * مقسّم + زر "مخصص" يفتح نافذة إدخال فترة. إعادة الضغط على الزر النشط تلغيه.
 */
export function ReportRangeFilter({ onRangeChange }: ReportRangeFilterProps) {
  const [preset, setPreset] = useState<RangePreset | null>(null)
  const [customRange, setCustomRange] = useState<DateRange | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const selectPreset = (p: Exclude<RangePreset, 'custom'>) => {
    if (preset === p) {
      setPreset(null)
      onRangeChange(null)
      return
    }
    setPreset(p)
    onRangeChange(presetRange(p))
  }

  const applyCustom = (range: DateRange) => {
    setCustomRange(range)
    setPreset('custom')
    setModalOpen(false)
    onRangeChange(range)
  }

  const clearCustom = () => {
    setPreset(null)
    setCustomRange(null)
    onRangeChange(null)
  }

  const customActive = preset === 'custom' && !!customRange
  const customLabel = customActive
    ? `${customRange!.startDate.replace(/-/g, '/')} – ${customRange!.endDate.replace(/-/g, '/')}`
    : t.custom

  return (
    <View style={styles.wrap}>
      {/* شريط الأزرار الجاهزة (مقسّم) */}
      <View style={styles.segment}>
        {PRESETS.map(opt => {
          const active = preset === opt.key
          return (
            <Pressable
              key={opt.key}
              style={[styles.segChip, active && styles.segChipActive]}
              onPress={() => selectPreset(opt.key)}
            >
              <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* زر الفترة المخصصة */}
      <Pressable
        style={[styles.customBtn, customActive && styles.customBtnActive]}
        onPress={() => setModalOpen(true)}
      >
        <Ionicons
          name="calendar-outline"
          size={15}
          color={customActive ? colors.onPrimary : colors.primary}
        />
        <Text style={[styles.customText, customActive && styles.customTextActive]} numberOfLines={1}>
          {customLabel}
        </Text>
        {customActive ? (
          <Pressable onPress={clearCustom} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.onPrimary} />
          </Pressable>
        ) : null}
      </Pressable>

      <DateRangeModal
        visible={modalOpen}
        initial={customRange}
        onApply={applyCustom}
        onClose={() => setModalOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  // شريط مقسّم بخلفية فاتحة والأزرار بداخله
  segment: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 4,
  },
  segChip: {
    flex: 1,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segChipActive: { backgroundColor: colors.primary, ...shadow.button },
  segText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  segTextActive: { color: colors.onPrimary, fontWeight: '700' },
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  customBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.button },
  customText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700', flexShrink: 1 },
  customTextActive: { color: colors.onPrimary },
})
