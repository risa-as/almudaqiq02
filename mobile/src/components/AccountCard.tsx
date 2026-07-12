import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'مدير المنظمة',
  BRANCH_MANAGER: 'مدير فرع',
  CASHIER: 'كاشير',
  STOCK_KEEPER: 'أمين مخزن',
}

/** بطاقة الحساب المشتركة: معلومات المستخدم + زر تسجيل الخروج (FR-005). */
export function AccountCard() {
  const user = useAuthStore(s => s.user)
  const signOut = useAuthStore(s => s.signOut)

  if (!user) return null

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={26} color={colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{user.username || user.email || '—'}</Text>
          <Text style={styles.role}>{ROLE_LABELS[user.role] ?? user.role}</Text>
          {user.tenantName ? <Text style={styles.tenant}>{user.tenantName}</Text> : null}
        </View>
      </View>
      <Pressable style={styles.signOut} onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>{ar.common.signOut}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  role: { fontSize: fontSize.sm, color: colors.primary, textAlign: 'right' },
  tenant: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  signOutText: { color: colors.danger, fontWeight: '600', fontSize: fontSize.md },
})
