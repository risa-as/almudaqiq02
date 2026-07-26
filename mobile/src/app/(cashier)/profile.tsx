import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { fetchActiveShift, shiftKeys } from '@/api/endpoints/shifts'
import { Hero } from '@/components/Hero'
import { Screen } from '@/components/Screen'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDate, formatDateTime } from '@/utils/format'
import { greetingFor } from '@/utils/greeting'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const t = {
  shiftStatus: 'حالة الوردية',
  shiftOpen: 'وردية مفتوحة',
  shiftClosed: 'لا توجد وردية مفتوحة',
  openedAt: 'فُتحت في',
  goToShift: 'عرض ورديتي',
  openShift: 'فتح وردية',
  accountInfo: 'معلومات الحساب',
  username: 'اسم المستخدم',
  email: 'البريد الإلكتروني',
  role: 'الدور',
  roleCashier: 'كاشير',
  store: 'المتجر',
}

export default function CashierProfile() {
  const user = useAuthStore(s => s.user)
  const signOut = useAuthStore(s => s.signOut)
  const brand = user?.tenantName || ar.appName

  const shiftQuery = useQuery({ queryKey: shiftKeys.active, queryFn: fetchActiveShift })
  const activeShift = shiftQuery.data?.activeShift ?? null

  return (
    <Screen title={ar.tabs.profile}>
      <Hero
        greeting={greetingFor(user?.username)}
        title={brand}
        icon="person"
        chips={[
          { icon: 'calendar-outline', text: formatDate(new Date()) },
          { icon: 'card-outline', text: t.roleCashier },
        ]}
      />

      {/* ── حالة الوردية ── */}
      <SectionHeader icon="time-outline" title={t.shiftStatus} />
      <Pressable
        style={({ pressed }) => [styles.shiftCard, pressed && styles.cardPressed]}
        onPress={() => router.navigate('/(cashier)/shift' as never)}
      >
        <View style={[styles.shiftDotWrap, { backgroundColor: activeShift ? colors.successSoft : colors.background }]}>
          <View style={[styles.shiftDot, { backgroundColor: activeShift ? colors.success : colors.textMuted }]} />
        </View>
        <View style={styles.shiftInfo}>
          <Text style={styles.shiftTitle}>{activeShift ? t.shiftOpen : t.shiftClosed}</Text>
          <Text style={styles.shiftHint} numberOfLines={1}>
            {activeShift ? `${t.openedAt} ${formatDateTime(activeShift.openedAt)}` : t.openShift}
          </Text>
        </View>
        <View style={styles.shiftAction}>
          <Text style={styles.shiftActionText}>{t.goToShift}</Text>
          <Ionicons name="chevron-back" size={14} color={colors.primary} />
        </View>
      </Pressable>

      {/* ── معلومات الحساب ── */}
      <SectionHeader icon="person-outline" title={t.accountInfo} />
      <View style={styles.card}>
        <InfoRow icon="person-circle-outline" label={t.username} value={user?.username || '—'} />
        {user?.email ? <InfoRow icon="mail-outline" label={t.email} value={user.email} divider /> : null}
        <InfoRow icon="card-outline" label={t.role} value={t.roleCashier} divider />
        <InfoRow icon="storefront-outline" label={t.store} value={brand} divider />
      </View>

      {/* ── تسجيل الخروج ── */}
      <Pressable style={styles.signOut} onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>{ar.common.signOut}</Text>
      </Pressable>
    </Screen>
  )
}

/** رأس قسم موحّد: أيقونة + عنوان — نفس نمط بقية الشاشات. */
function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
    </View>
  )
}

/** صف معلومة: أيقونة يمينًا ← التسمية ← القيمة يسارًا. */
function InfoRow({
  icon,
  label,
  value,
  divider,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  divider?: boolean
}) {
  return (
    <View style={[styles.infoRow, divider && styles.infoRowDivider]}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeaderTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },

  // ── بطاقة حالة الوردية ──
  shiftCard: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...shadow.card,
  },
  cardPressed: { opacity: 0.7 },
  shiftDotWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftDot: { width: 12, height: 12, borderRadius: radius.full },
  shiftInfo: { flex: 1, gap: 1, alignItems: ALIGN_RIGHT },
  shiftTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700', textAlign: 'right' },
  shiftHint: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right' },
  shiftAction: { flexDirection: ROW, alignItems: 'center', gap: 2 },
  shiftActionText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '700' },

  // ── بطاقة معلومات الحساب ──
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
  infoRow: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  infoRowDivider: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'right' },
  infoValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700', maxWidth: '55%' },

  // ── تسجيل الخروج ──
  signOut: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.pill,
    height: 48,
    marginTop: spacing.lg,
  },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: fontSize.md },
})
