import { StyleSheet, Text, View } from 'react-native'
import { ar } from '@/i18n/ar'
import { colors, fontSize, spacing } from '@/theme'

/**
 * مخطط أعمدة يدوي (لا توجد مكتبة رسوم في التطبيق):
 * خطوط شبكة أفقية خفيفة + قيمة فوق كل عمود + تسمية اليوم أسفله.
 * أعلى قيمة تُميَّز باللون الأساسي والبقية بدرجة باهتة منه.
 * يعمل مع RTL تلقائيًا (flexDirection: row).
 */
interface BarChartProps {
  data: { label: string; value: number }[]
  /** ارتفاع منطقة الأعمدة بالنقاط (الافتراضي 120) */
  height?: number
  tint?: string
}

const GRID_LINES = 4 // عدد خطوط الشبكة الأفقية

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
  const isEmpty = data.length === 0 || max <= 0
  const mutedBar = `${tint}33` // نفس اللون بشفافية ~20% للأعمدة غير القصوى

  return (
    <View style={styles.root}>
      <View style={[styles.plot, { height: height + VALUE_LANE }]}>
        {/* خطوط الشبكة الأفقية الخفيفة */}
        {Array.from({ length: GRID_LINES }).map((_, i) => (
          <View
            key={`grid-${i}`}
            pointerEvents="none"
            style={[styles.gridLine, { bottom: (height / (GRID_LINES - 1)) * i }]}
          />
        ))}

        {isEmpty ? (
          <View style={[styles.emptyWrap, { height }]}>
            <Text style={styles.emptyText}>{ar.common.empty}</Text>
          </View>
        ) : (
          <View style={styles.columns}>
            {data.map((d, i) => {
              const barHeight = max > 0 ? Math.max((d.value / max) * height, d.value > 0 ? 4 : 2) : 2
              const isMax = d.value === max && d.value > 0
              return (
                <View key={`${d.label}-${i}`} style={styles.column}>
                  <Text style={[styles.value, isMax && { color: tint, fontWeight: '800' }]} numberOfLines={1}>
                    {compact(d.value)}
                  </Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: d.value > 0 ? (isMax ? tint : mutedBar) : colors.border,
                      },
                    ]}
                  />
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* تسميات الأيام أسفل الأعمدة */}
      {!isEmpty ? (
        <View style={styles.labels}>
          {data.map((d, i) => (
            <Text key={`${d.label}-${i}`} style={styles.label} numberOfLines={1}>
              {d.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** مساحة سطر القيمة فوق الأعمدة */
const VALUE_LANE = 18

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  plot: { justifyContent: 'flex-end' },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  bar: {
    width: '68%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  value: { fontSize: 9, color: colors.textMuted, fontWeight: '600' },
  labels: { flexDirection: 'row', gap: spacing.xs, marginTop: 2 },
  label: { flex: 1, textAlign: 'center', fontSize: fontSize.xs, color: colors.textSecondary },
  emptyWrap: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: fontSize.sm },
})
