import type { PropsWithChildren, ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fontSize, spacing } from '@/theme'

interface ScreenProps {
  /** عنوان يظهر أعلى الشاشة (اختياري) */
  title?: string
  /** سطر وصفي مختصر أسفل العنوان (اختياري) */
  subtitle?: string
  /** عنصر إضافي بجانب العنوان (زر/فلتر) */
  headerAction?: ReactNode
  /** لفّ المحتوى بـ ScrollView (الافتراضي true) */
  scroll?: boolean
  refreshing?: boolean
  onRefresh?: () => void
}

export function Screen({
  title,
  subtitle,
  headerAction,
  scroll = true,
  refreshing,
  onRefresh,
  children,
}: PropsWithChildren<ScreenProps>) {
  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {headerAction}
      </View>
    </View>
  ) : null

  if (!scroll) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {header}
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTextWrap: { flex: 1, gap: 2 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'right', letterSpacing: -0.3 },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right' },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  scrollBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
})
