import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AccountCard } from '@/components/AccountCard'
import { Card, SectionTitle } from '@/components/admin/Card'
import { Screen } from '@/components/Screen'
import { useFeature } from '@/hooks/useFeature'
import { ar } from '@/i18n/ar'
import { ALL_BRANCHES, ALL_BRANCHES_LABEL, useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, spacing } from '@/theme'

const t = {
  branchSwitcher: 'الفرع المعروض',
  sections: 'أقسام الإدارة',
  inventory: 'نظرة المخزون',
  inventoryHint: 'المنخفض والقريب من الانتهاء',
  approvals: 'الموافقات',
  approvalsHint: 'التحويلات وأوامر الشراء المعلقة',
  users: 'المستخدمون',
  usersHint: 'قائمة الموظفين وسجل التدقيق',
  assistant: 'المساعد الذكي',
  assistantHint: 'اسأل عن بياناتك بالعربية',
}

interface NavRowProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  hint: string
  divider?: boolean
  onPress: () => void
}

function NavRow({ icon, label, hint, divider, onPress }: NavRowProps) {
  return (
    <Pressable style={[styles.navRow, divider && styles.rowDivider]} onPress={onPress}>
      <View style={styles.navIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.navInfo}>
        <Text style={styles.navLabel}>{label}</Text>
        <Text style={styles.navHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
    </Pressable>
  )
}

export default function AdminSettings() {
  const router = useRouter()
  const aiEnabled = useFeature('ai_assistant')
  const { branches, selectedBranchId, canSwitch, select } = useBranchSelection()

  // خيارات المبدّل: "جميع الفروع" تظهر فقط عند وجود أكثر من فرع (كما في الويب)
  const options =
    branches.length > 1
      ? [{ id: ALL_BRANCHES, name: ALL_BRANCHES_LABEL }, ...branches]
      : branches

  return (
    <Screen title={ar.tabs.more}>
      <AccountCard />

      {/* ── مبدّل الفروع — ADMIN فقط (مدير الفرع مثبّت على فرعه، US4-AS3) ── */}
      {canSwitch ? (
        <>
          <SectionTitle>{t.branchSwitcher}</SectionTitle>
          <Card>
            {options.map((b, i) => {
              const active = selectedBranchId === b.id
              return (
                <Pressable
                  key={b.id}
                  style={[styles.branchRow, i > 0 && styles.rowDivider]}
                  onPress={() => select(b.id)}
                >
                  <View style={styles.branchInfo}>
                    <Ionicons
                      name={b.id === ALL_BRANCHES ? 'business-outline' : 'storefront-outline'}
                      size={18}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.branchName, active && styles.branchNameActive]}>{b.name}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              )
            })}
          </Card>
        </>
      ) : null}

      {/* ── أقسام الإدارة خارج شريط التبويب ── */}
      <SectionTitle>{t.sections}</SectionTitle>
      <Card style={styles.navCard}>
        <NavRow
          icon="cube-outline"
          label={t.inventory}
          hint={t.inventoryHint}
          onPress={() => router.push('/(admin)/inventory' as never)}
        />
        <NavRow
          icon="checkmark-done-outline"
          label={t.approvals}
          hint={t.approvalsHint}
          divider
          onPress={() => router.push('/(admin)/approvals' as never)}
        />
        <NavRow
          icon="people-outline"
          label={t.users}
          hint={t.usersHint}
          divider
          onPress={() => router.push('/(admin)/users' as never)}
        />
        {aiEnabled ? (
          <NavRow
            icon="sparkles-outline"
            label={t.assistant}
            hint={t.assistantHint}
            divider
            onPress={() => router.push('/(admin)/assistant' as never)}
          />
        ) : null}
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  branchInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  branchName: { fontSize: fontSize.md, color: colors.text, textAlign: 'right' },
  branchNameActive: { color: colors.primary, fontWeight: '700' },
  navCard: { paddingVertical: spacing.xs },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navInfo: { flex: 1, gap: 2 },
  navLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, textAlign: 'right' },
  navHint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
})
