import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Redirect } from 'expo-router'
import Constants from 'expo-constants'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ApiError } from '@/api/client'
import { ar } from '@/i18n/ar'
import { homePathForRole, useAuthStore } from '@/stores/auth'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { ROW } from '@/utils/rtl'

type Field = 'identifier' | 'password'

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0'

export default function LoginScreen() {
  const status = useAuthStore(s => s.status)
  const user = useAuthStore(s => s.user)
  const signIn = useAuthStore(s => s.signIn)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** الحقل المركَّز عليه — يلوّن الإطار والأيقونة بلون الهوية. */
  const [focused, setFocused] = useState<Field | null>(null)

  const passwordRef = useRef<TextInput>(null)
  const [enter] = useState(() => new Animated.Value(0))

  // دخول ناعم للمحتوى عند فتح الشاشة — يمنع «قفزة» الظهور المفاجئ
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [enter])

  if (status === 'signedIn' && user) {
    return <Redirect href={homePathForRole(user.role) as never} />
  }

  const submit = async () => {
    if (submitting) return
    if (!identifier.trim() || !password) {
      setError(ar.login.incomplete)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await signIn(identifier, password)
      // التوجيه يتم تلقائيًا عبر <Redirect> أعلاه بعد تحديث الحالة
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ar.common.unexpectedError)
    } finally {
      setSubmitting(false)
    }
  }

  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })

  return (
    <LinearGradient
      colors={[colors.gradientFrom, colors.gradientTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      {/* دوائر زخرفية بنفس لغة بطاقة الهيدر في الرئيسية */}
      <View style={styles.blobTop} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <StatusBar style="light" />
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.brand, { opacity: enter }]}>
              <View style={styles.logoBadge}>
                <Ionicons name="storefront" size={34} color={colors.onPrimary} />
              </View>
              <Text style={styles.appName}>{ar.appName}</Text>
              <Text style={styles.subtitle}>{ar.login.subtitle}</Text>
            </Animated.View>

            <Animated.View style={[styles.card, { opacity: enter, transform: [{ translateY: rise }] }]}>
              <View style={styles.cardHeading}>
                <View style={styles.headingAccent} />
                <Text style={styles.headingText}>{ar.login.title}</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{ar.login.identifier}</Text>
                <View style={[styles.inputRow, focused === 'identifier' && styles.inputRowFocused]}>
                  <Ionicons
                    name="person-outline"
                    size={19}
                    color={focused === 'identifier' ? colors.primary : colors.textMuted}
                  />
                  <TextInput
                    style={styles.input}
                    value={identifier}
                    onChangeText={setIdentifier}
                    onFocus={() => setFocused('identifier')}
                    onBlur={() => setFocused(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    keyboardType="email-address"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    submitBehavior="submit"
                    placeholder={ar.login.identifierPlaceholder}
                    placeholderTextColor={colors.textMuted}
                    textAlign="right"
                    editable={!submitting}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{ar.login.password}</Text>
                <View style={[styles.inputRow, focused === 'password' && styles.inputRowFocused]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color={focused === 'password' ? colors.primary : colors.textMuted}
                  />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    placeholder={ar.login.passwordPlaceholder}
                    placeholderTextColor={colors.textMuted}
                    textAlign="right"
                    editable={!submitting}
                  />
                  <Pressable
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? ar.login.hidePassword : ar.login.showPassword}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={submitting}
                accessibilityRole="button"
                style={({ pressed }) => [styles.submit, (submitting || pressed) && styles.submitDimmed]}
              >
                <LinearGradient
                  colors={[colors.gradientFrom, colors.gradientTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitFill}
                >
                  {submitting ? (
                    <>
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                      <Text style={styles.submitText}>{ar.login.submitting}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.submitText}>{ar.login.submit}</Text>
                      <Ionicons name="arrow-back" size={19} color={colors.onPrimary} />
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <Animated.View style={[styles.footer, { opacity: enter }]}>
              <View style={styles.secureRow}>
                <Ionicons name="shield-checkmark" size={14} color="rgba(255,255,255,0.75)" />
                <Text style={styles.secureText}>{ar.login.secureNote}</Text>
              </View>
              <Text style={styles.versionText}>{ar.login.version(APP_VERSION)}</Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },

  blobTop: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.09)',
    top: -110,
    left: -70,
  },
  blobBottom: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
    bottom: -70,
    right: -50,
  },

  brand: { alignItems: 'center', gap: spacing.xs },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  appName: { fontSize: fontSize.title, fontWeight: '800', color: colors.onPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.82)', textAlign: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadow.elevated,
  },
  cardHeading: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  headingAccent: { width: 3, height: 20, borderRadius: radius.sm, backgroundColor: colors.primary },
  headingText: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'right' },

  field: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, textAlign: 'right' },
  inputRow: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: control.inputHeight,
  },
  inputRowFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  // paddingVertical: 0 يمنع حشوة أندرويد الافتراضية من إزاحة النص داخل الصف
  input: { flex: 1, fontSize: fontSize.md, color: colors.text, height: '100%', paddingVertical: 0 },

  errorBox: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRightWidth: 3,
    borderRightColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSize.sm, textAlign: 'right', lineHeight: 20 },

  // الظل على العنصر الخارجي والتدوير على التدرّج نفسه: overflow:'hidden' هنا
  // كان سيقصّ ظلّ iOS بالكامل.
  submit: { borderRadius: radius.pill, marginTop: spacing.xs, ...shadow.button },
  submitFill: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: control.buttonHeight,
    borderRadius: radius.pill,
  },
  submitDimmed: { opacity: 0.75 },
  submitText: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: '800' },

  footer: { alignItems: 'center', gap: spacing.xs },
  secureRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  secureText: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.xs, fontWeight: '600' },
  versionText: { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.xs },
})
