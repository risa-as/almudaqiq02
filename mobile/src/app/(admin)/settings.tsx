import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AccountCard } from '@/components/AccountCard'
import { Card, SectionTitle } from '@/components/admin/Card'
import { Screen } from '@/components/Screen'
import { useFeature } from '@/hooks/useFeature'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { ALL_BRANCHES, ALL_BRANCHES_LABEL, useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const t = {
  branchSwitcher: 'الفرع المعروض',
  sections: 'أقسام الإدارة',
  sectionsHint: 'اختصارات لإدارة متجرك',
  inventory: 'نظرة المخزون',
  inventoryHint: 'المنخفض والقريب من الانتهاء',
  approvals: 'الموافقات',
  approvalsHint: 'التحويلات وأوامر الشراء المعلقة',
  users: 'المستخدمون',
  usersHint: 'قائمة الموظفين وسجل التدقيق',
  assistant: 'المساعد الذكي',
  assistantHint: 'اسأل عن بياناتك بالعربية',
}

interface SectionDef {
  key: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  hint: string
  tint: string
  soft: string
  route: string
}

/** بلاطة قسم إدارية ضمن الشبكة — أيقونة ملوّنة أعلى اليمين، عنوان ووصف تحتها. */
function SectionTile({ def, onPress }: { def: SectionDef; onPress: () => void }) {
  return (
    <Pressable style={styles.tileWrap} onPress={onPress}>
      {({ pressed }) => (
        <View style={[styles.tile, pressed && styles.tilePressed]}>
          <View style={[styles.bubble, { backgroundColor: def.soft }]}>
            <Ionicons name={def.icon} size={22} color={def.tint} />
          </View>
          <Text style={styles.tileLabel} numberOfLines={1}>
            {def.label}
          </Text>
          <Text style={styles.tileHint} numberOfLines={2}>
            {def.hint}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

export default function AdminSettings() {
  const router = useRouter()
  const aiEnabled = useFeature('ai_assistant')
  const tenantName = useAuthStore(s => s.user?.tenantName)
  const { branches, selectedBranchId, canSwitch, select } = useBranchSelection()

  // خيارات المبدّل: "جميع الفروع" تظهر فقط عند وجود أكثر من فرع (كما في الويب)
  const options =
    branches.length > 1
      ? [{ id: ALL_BRANCHES, name: ALL_BRANCHES_LABEL }, ...branches]
      : branches

  const sections: SectionDef[] = [
    {
      key: 'inventory',
      icon: 'cube',
      label: t.inventory,
      hint: t.inventoryHint,
      tint: colors.primary,
      soft: colors.primarySoft,
      route: '/(admin)/inventory',
    },
    {
      key: 'approvals',
      icon: 'checkmark-done',
      label: t.approvals,
      hint: t.approvalsHint,
      tint: colors.success,
      soft: colors.successSoft,
      route: '/(admin)/approvals',
    },
    {
      key: 'users',
      icon: 'people',
      label: t.users,
      hint: t.usersHint,
      tint: colors.violet,
      soft: colors.violetSoft,
      route: '/(admin)/users',
    },
  ]
  if (aiEnabled) {
    sections.push({
      key: 'assistant',
      icon: 'sparkles',
      label: t.assistant,
      hint: t.assistantHint,
      tint: colors.warning,
      soft: colors.warningSoft,
      route: '/(admin)/assistant',
    })
  }

  return (
    <Screen title={ar.tabs.more} subtitle={tenantName ?? undefined}>
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

      {/* ── أقسام الإدارة خارج شريط التبويب — شبكة بلاطات ── */}
      <SectionTitle>{t.sections}</SectionTitle>
      <Text style={styles.sectionsHint}>{t.sectionsHint}</Text>
      <View style={styles.grid}>
        {sections.map(s => (
          <SectionTile key={s.key} def={s} onPress={() => router.push(s.route as never)} />
        ))}
      </View>
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

  // ── شبكة أقسام الإدارة ──
  sectionsHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: ROW,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  tileWrap: { width: '48%' },
  tile: {
    minHeight: 138,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: ALIGN_RIGHT,
    gap: spacing.sm,
    overflow: 'hidden',
    ...shadow.card,
  },
  tilePressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    alignSelf: 'stretch',
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  tileHint: {
    alignSelf: 'stretch',
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 16,
  },
})
