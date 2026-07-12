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
      <View style={[styles.headerTextWrap, headerAction ? styles.headerTextPadded : null]}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.accentBar} />
      </View>
      {headerAction ? <View style={styles.actionWrap}>{headerAction}</View> : null}
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
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    justifyContent: 'center',
  },
  headerTextWrap: { alignItems: 'center', gap: 3 },
  // عند وجود زر جانبي: هامش يمنع العنوان الطويل من الدخول تحته
  headerTextPadded: { paddingHorizontal: 52 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', letterSpacing: -0.3 },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
  accentBar: {
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: spacing.xs + 2,
  },
  actionWrap: {
    position: 'absolute',
    end: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  scrollBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
})
