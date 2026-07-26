import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { createUser, updateUser, type StaffUser } from '@/api/endpoints/users'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { normalizeBranchId, useBranchSelection } from '@/stores/branch'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { assignableRoles, roleMeta } from '@/utils/roles'
import { ROW } from '@/utils/rtl'

const t = {
  addTitle: 'إضافة مستخدم',
  editTitle: 'تعديل المستخدم',
  username: 'اسم المستخدم',
  usernamePlaceholder: 'اختياري — يُولَّد تلقائيًا إن تُرك فارغًا',
  usernameShort: 'اسم المستخدم قصير جدًا (حرفان على الأقل)',
  email: 'البريد الإلكتروني',
  emailPlaceholder: 'user@example.com',
  emailRequired: 'البريد الإلكتروني مطلوب',
  emailInvalid: 'صيغة البريد الإلكتروني غير صحيحة',
  password: 'كلمة المرور',
  newPassword: 'كلمة مرور جديدة',
  passwordPlaceholder: '8 أحرف على الأقل',
  passwordKeepHint: 'اتركه فارغًا للإبقاء على كلمة المرور الحالية',
  passwordRequired: 'كلمة المرور مطلوبة',
  passwordShort: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
  role: 'الدور',
  branch: 'الفرع',
  create: 'إضافة',
  saveEdit: 'حفظ التعديل',
}

interface FieldErrors {
  username?: string
  email?: string
  password?: string
}

interface UserFormModalProps {
  visible: boolean
  /** وجود المستخدم ⇐ وضع التعديل؛ null ⇐ وضع الإضافة. */
  user?: StaffUser | null
  onClose: () => void
  /** يُستدعى بعد نجاح الحفظ — على الأب إبطال الاستعلامات وإظهار التأكيد. */
  onSaved: (mode: 'create' | 'edit') => void
}

/**
 * نموذج إضافة/تعديل مستخدم. القيم الأوّلية تأتي من صف القائمة مباشرةً (لا جلب
 * تفاصيل)، والأب يعيد التركيب بمفتاح متغيّر عند كل فتح فتُصفَّر الحقول تلقائيًا.
 */
export function UserFormModal({ visible, user, onClose, onSaved }: UserFormModalProps) {
  const isEdit = !!user
  const callerRole = useAuthStore(s => s.user?.role)
  const { branches, selectedBranchId, canSwitch } = useBranchSelection()

  const roles = assignableRoles(callerRole)

  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState(user?.role ?? 'CASHIER')
  // فرع المستخدم الجديد: الفرع المختار في الواجهة، وإلا أول فرع (يظهر عند الإضافة فقط)
  const [branchId, setBranchId] = useState<string | null>(
    normalizeBranchId(selectedBranchId) ?? branches[0]?.id ?? null,
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return updateUser({
          id: (user as StaffUser).id,
          username: username.trim() || undefined,
          email: email.trim() || undefined,
          password: password.trim() || undefined,
          role,
        })
      }
      return createUser({
        username: username.trim() || undefined,
        email: email.trim(),
        password: password.trim(),
        role,
        // المنشئ المقيّد بفرع يُجبر على فرعه خادميًا — لا نرسل الحقل أصلًا
        branchId: canSwitch ? (branchId ?? undefined) : undefined,
      })
    },
    onSuccess: () => {
      onSaved(isEdit ? 'edit' : 'create')
      onClose()
    },
    onError: err => {
      setApiError(err instanceof ApiError ? err.message : ar.common.unexpectedError)
    },
  })

  const submit = () => {
    if (mutation.isPending) return
    const errs: FieldErrors = {}
    const uName = username.trim()
    const mail = email.trim()
    const pass = password.trim()
    if (uName && uName.length < 2) errs.username = t.usernameShort
    if (!isEdit && !mail) errs.email = t.emailRequired
    else if (mail && !/^\S+@\S+\.\S+$/.test(mail)) errs.email = t.emailInvalid
    if (!isEdit && !pass) errs.password = t.passwordRequired
    else if (pass && pass.length < 8) errs.password = t.passwordShort
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setApiError(null)
    mutation.mutate()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{isEdit ? t.editTitle : t.addTitle}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <View style={styles.field}>
              <Text style={styles.label}>{t.username}</Text>
              <TextInput
                style={[styles.input, errors.username ? styles.inputError : null]}
                value={username}
                onChangeText={v => {
                  setUsername(v)
                  if (errors.username) setErrors(e => ({ ...e, username: undefined }))
                }}
                autoCapitalize="none"
                placeholder={isEdit ? '' : t.usernamePlaceholder}
                placeholderTextColor={colors.textMuted}
              />
              {errors.username ? <Text style={styles.fieldError}>{errors.username}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t.email}</Text>
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : null]}
                value={email}
                onChangeText={v => {
                  setEmail(v)
                  if (errors.email) setErrors(e => ({ ...e, email: undefined }))
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t.emailPlaceholder}
                placeholderTextColor={colors.textMuted}
              />
              {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{isEdit ? t.newPassword : t.password}</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, errors.password ? styles.inputError : null]}
                  value={password}
                  onChangeText={v => {
                    setPassword(v)
                    if (errors.password) setErrors(e => ({ ...e, password: undefined }))
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholder={t.passwordPlaceholder}
                  placeholderTextColor={colors.textMuted}
                />
                <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
              {isEdit && !errors.password ? <Text style={styles.hint}>{t.passwordKeepHint}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t.role}</Text>
              <View style={styles.chipsWrap}>
                {roles.map(r => {
                  const m = roleMeta(r)
                  const selected = role === r
                  return (
                    <Pressable
                      key={r}
                      style={[styles.chip, selected && { backgroundColor: m.tintSoft, borderColor: m.tint }]}
                      onPress={() => setRole(r)}
                    >
                      <Ionicons name={m.icon} size={14} color={selected ? m.tint : colors.textSecondary} />
                      <Text style={[styles.chipText, selected && { color: m.tint, fontWeight: '800' }]}>{m.label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            {/* اختيار الفرع: عند الإضافة فقط، للمالك متعدد الفروع (التعديل لا يدعم نقل الفرع) */}
            {!isEdit && canSwitch && branches.length > 1 ? (
              <View style={styles.field}>
                <Text style={styles.label}>{t.branch}</Text>
                <View style={styles.chipsWrap}>
                  {branches.map(b => {
                    const selected = branchId === b.id
                    return (
                      <Pressable
                        key={b.id}
                        style={[styles.chip, selected && styles.chipSelectedPrimary]}
                        onPress={() => setBranchId(b.id)}
                      >
                        <Ionicons
                          name="storefront-outline"
                          size={14}
                          color={selected ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[styles.chipText, selected && styles.chipTextPrimary]}>{b.name}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : null}

            {apiError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.errorText}>{apiError}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{ar.common.cancel}</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, mutation.isPending && styles.disabled]}
              onPress={submit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.submitText}>{isEdit ? t.saveEdit : t.create}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.elevated,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'right' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  field: { gap: spacing.xs, marginBottom: spacing.md },
  label: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: control.inputHeight,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'right',
    backgroundColor: colors.background,
  },
  inputError: { borderColor: colors.danger },
  passwordWrap: { justifyContent: 'center' },
  // متسع لزر العين — يجلس في الطرف الأيسر بينما النص يبدأ من اليمين
  passwordInput: { paddingLeft: spacing.xl + spacing.md },
  eyeBtn: { position: 'absolute', left: spacing.md },
  fieldError: { fontSize: fontSize.xs, color: colors.danger, textAlign: 'right' },
  hint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right', lineHeight: 18 },
  chipsWrap: { flexDirection: ROW, flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelectedPrimary: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  chipTextPrimary: { color: colors.primary, fontWeight: '800' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSize.xs, textAlign: 'right', lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    height: control.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.md },
  submitBtn: {
    flex: 1,
    height: control.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.button,
  },
  submitText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },
  disabled: { opacity: 0.5 },
})
