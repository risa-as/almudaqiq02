import { useState } from 'react'
import {
  ActivityIndicator,
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
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ApiError } from '@/api/client'
import { ar } from '@/i18n/ar'
import { homePathForRole, useAuthStore } from '@/stores/auth'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'

export default function LoginScreen() {
  const status = useAuthStore(s => s.status)
  const user = useAuthStore(s => s.user)
  const signIn = useAuthStore(s => s.signIn)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'signedIn' && user) {
    return <Redirect href={homePathForRole(user.role) as never} />
  }

  const submit = async () => {
    if (submitting) return
    if (!identifier.trim() || !password) {
      setError('أدخل بيانات الدخول كاملة')
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

  return (
    <LinearGradient colors={[colors.gradientFrom, colors.gradientTo]} style={styles.gradient}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.logoWrap}>
              <View style={styles.logoBadge}>
                <Ionicons name="storefront" size={38} color={colors.onPrimary} />
              </View>
              <Text style={styles.appName}>{ar.appName}</Text>
              <Text style={styles.subtitle}>{ar.login.subtitle}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>{ar.login.identifier}</Text>
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textAlign="right"
                editable={!submitting}
              />

              <Text style={styles.label}>{ar.login.password}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textAlign="right"
                  editable={!submitting}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />
                <Pressable style={styles.eyeButton} onPress={() => setShowPassword(v => !v)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable style={[styles.submit, submitting && styles.submitDisabled]} onPress={submit} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>{ar.login.submit}</Text>
                )}
              </Pressable>
            </View>
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
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  logoWrap: { alignItems: 'center', gap: spacing.sm },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  appName: { fontSize: fontSize.xxl + 2, fontWeight: '800', color: colors.onPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.8)' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadow.elevated,
  },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, textAlign: 'right', marginTop: spacing.sm },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    height: control.inputHeight,
    fontSize: fontSize.md,
    color: colors.text,
  },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingLeft: 44 },
  eyeButton: { position: 'absolute', left: spacing.md },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSize.sm, textAlign: 'right' },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    ...shadow.button,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: '800' },
})
