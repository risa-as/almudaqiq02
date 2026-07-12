import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

/** شريط اختيارات (فترة/فلتر) على شكل شرائح — عام على نوع القيمة. */
interface PeriodFilterProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

export function PeriodFilter<T extends string>({ options, value, onChange }: PeriodFilterProps<T>) {
  return (
    <View style={styles.row}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <Pressable
            key={opt.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary, ...shadow.button },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
})
