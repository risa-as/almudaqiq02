import type { PropsWithChildren, ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

/** بطاقة سطح موحّدة لشاشات المدير. */
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>
}

/** عنوان قسم مع عنصر إجراء اختياري في الطرف المقابل. */
export function SectionTitle({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title}>{children}</Text>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    ...shadow.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
})
