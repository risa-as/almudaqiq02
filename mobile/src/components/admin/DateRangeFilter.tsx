import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { DateRange } from '@/api/endpoints/reports'
import { DateRangeModal } from './DateRangeModal'
import { colors, fontSize, radius, spacing } from '@/theme'

const t = {
  open: 'مخصص',
}

interface DateRangeFilterProps {
  /** الفترة المخصصة الحالية أو null (المعروض حينها: الفترات الجاهزة) */
  value: DateRange | null
  onChange: (range: DateRange | null) => void
}

/**
 * فلتر فترة مخصصة (من → إلى): شريحة "مخصص" تفتح نافذة إدخال التواريخ، وعند
 * التفعيل تتحوّل إلى شريحة نشطة قابلة للمسح (✕) للعودة للفترة الافتراضية.
 */
export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {value ? (
        <View style={styles.activeChip}>
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.onPrimary} />
          </Pressable>
          <Pressable onPress={() => setOpen(true)} hitSlop={4}>
            <Text style={styles.activeChipText}>
              {value.startDate.replace(/-/g, '/')} – {value.endDate.replace(/-/g, '/')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.openChip} onPress={() => setOpen(true)}>
          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
          <Text style={styles.openChipText}>{t.open}</Text>
        </Pressable>
      )}

      <DateRangeModal
        visible={open}
        initial={value}
        onApply={range => {
          setOpen(false)
          onChange(range)
        }}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  openChip: {
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
  openChipText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  activeChipText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '700' },
})
