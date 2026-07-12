import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, radius, spacing } from '@/theme'

/**
 * مخطط أعمدة يدوي (لا توجد مكتبة رسوم في التطبيق): أعمدة View بارتفاعات
 * متناسبة مع القيم، والتسميات أسفلها. يعمل مع RTL تلقائيًا (flexDirection: row).
 */
interface BarChartProps {
  data: { label: string; value: number }[]
  /** ارتفاع منطقة الأعمدة بالنقاط (الافتراضي 120) */
  height?: number
  tint?: string
}

/** صيغة مختصرة للقيمة فوق العمود: 1250000 → 1.3م، 12500 → 12.5ك */
function compact(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}م`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}ك`
  return `${Math.round(v)}`
}

export function BarChart({ data, height = 120, tint = colors.primary }: BarChartProps) {
  const max = Math.max(...data.map(d => d.value), 0)

  return (
    <View style={styles.root}>
      <View style={[styles.columns, { height: height + 18 }]}>
        {data.map((d, i) => {
          const barHeight = max > 0 ? Math.max((d.value / max) * height, d.value > 0 ? 4 : 2) : 2
          return (
            <View key={`${d.label}-${i}`} style={styles.column}>
              <Text style={styles.value} numberOfLines={1}>
                {compact(d.value)}
              </Text>
              <View
                style={[
                  styles.bar,
                  { height: barHeight, backgroundColor: d.value > 0 ? tint : colors.border },
                ]}
              />
            </View>
          )
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text key={`${d.label}-${i}`} style={styles.label} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  bar: {
    width: '70%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  value: { fontSize: 9, color: colors.textMuted },
  labels: { flexDirection: 'row', gap: spacing.xs },
  label: { flex: 1, textAlign: 'center', fontSize: fontSize.xs, color: colors.textSecondary },
})
