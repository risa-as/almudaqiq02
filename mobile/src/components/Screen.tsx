import type { PropsWithChildren, ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fontSize, spacing } from '@/theme'

interface ScreenProps {
  /** عنوان يظهر أعلى الشاشة (اختياري) */
  title?: string
  /** عنصر إضافي بجانب العنوان (زر/فلتر) */
  headerAction?: ReactNode
  /** لفّ المحتوى بـ ScrollView (الافتراضي true) */
  scroll?: boolean
  refreshing?: boolean
  onRefresh?: () => void
}

export function Screen({ title, headerAction, scroll = true, refreshing, onRefresh, children }: PropsWithChildren<ScreenProps>) {
  const header = title ? (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {headerAction}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.title, fontWeight: '800', color: colors.text, textAlign: 'right', letterSpacing: -0.3 },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  scrollBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
})
