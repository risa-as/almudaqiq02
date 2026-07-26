/**
 * تنبيهات التطبيق — بديل مصمَّم عن `Alert.alert` الأصلي.
 *
 * لماذا لا نستخدم `Modal`؟ لأن `Modal` على iOS يُقدَّم عبر
 * `[reactViewController presentViewController:]`، وإذا كانت هناك نافذة مفتوحة أصلًا
 * (ورقة الفاتورة، سلة البيع…) يرفض النظام تقديم نافذة ثانية من جذر الشجرة فلا يظهر
 * التنبيه إطلاقًا. وعلى أندرويد الـ Modal نافذة Dialog مستقلة لا تستطيع طبقةٌ في الجذر
 * الرسمَ فوقها. لذا التنبيه هنا مجرد طبقة مطلقة (absolute overlay) + سجلّ مضيفين:
 * أي `<AlertHost />` يُركَّب داخل نافذة مفتوحة يصبح هو المضيف النشط، ويعود الجذر
 * مضيفًا عند إغلاقها — فيظهر التنبيه فوق كل شيء على المنصتين.
 *
 * الاستخدام:
 *   appAlert.success('تم', 'حُفظ المستخدم')
 *   appAlert.error('تعذر التنفيذ', err.message)
 *   appAlert.confirm({ title, message, destructive: true, onConfirm })
 */

import { useEffect, useState } from 'react'
import { Animated, BackHandler, Easing, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { create } from 'zustand'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { ROW } from '@/utils/rtl'

// ── الأنواع ────────────────────────────────────────────────────────────────

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive'

export interface AlertButton {
  text: string
  style?: AlertButtonStyle
  onPress?: () => void
}

/** نبرة التنبيه — تحدّد الأيقونة ولون الهالة فقط، لا شكل الأزرار. */
export type AlertTone = 'success' | 'error' | 'warning' | 'danger' | 'question' | 'info'

export interface AlertOptions {
  title: string
  message?: string
  tone?: AlertTone
  buttons?: AlertButton[]
}

interface AlertRequest extends Required<Pick<AlertOptions, 'title' | 'tone' | 'buttons'>> {
  id: number
  message?: string
}

// ── المخزن ─────────────────────────────────────────────────────────────────

interface AlertStore {
  /** يبقى بعد الإغلاق حتى تنتهي حركة الخروج، ثم يُمسح. */
  request: AlertRequest | null
  visible: boolean
  /** معرّفات المضيفين بترتيب التركيب — الأخير هو الأعمق (داخل نافذة مفتوحة). */
  hosts: number[]
}

const useAlertStore = create<AlertStore>(() => ({ request: null, visible: false, hosts: [] }))

let nextId = 1

/** نبرة افتراضية معقولة حين لا تُحدَّد: هدم → خطر، سؤال بخيارين → سؤال، غير ذلك → معلومة. */
function inferTone(buttons: AlertButton[]): AlertTone {
  if (buttons.some(b => b.style === 'destructive')) return 'danger'
  if (buttons.length > 1) return 'question'
  return 'info'
}

function openAlert(options: AlertOptions): void {
  // التنبيه الأصلي يُسقط لوحة المفاتيح عند ظهوره؛ بدونها تختفي الأزرار خلفها
  // في الشاشات القصيرة (تأكيد إغلاق الوردية يأتي مباشرة بعد الكتابة في الحقل).
  Keyboard.dismiss()
  const buttons = options.buttons?.length ? options.buttons : [{ text: ar.common.ok, style: 'default' as const }]
  useAlertStore.setState({
    request: {
      id: nextId++,
      title: options.title,
      message: options.message,
      tone: options.tone ?? inferTone(buttons),
      buttons,
    },
    visible: true,
  })
}

/** يخفي التنبيه فورًا؛ ومحتواه يُمسح بعد انتهاء حركة الخروج. */
function closeAlert(): void {
  useAlertStore.setState({ visible: false })
}

/** ينفّذ إجراء الزر بعد إخفاء التنبيه — كما يفعل التنبيه الأصلي. */
function pressButton(button: AlertButton): void {
  closeAlert()
  button.onPress?.()
}

/** الضغط خارج البطاقة أو زر الرجوع = المسار الآمن: زر التراجع إن وُجد. */
function dismissAlert(): boolean {
  const { request, visible } = useAlertStore.getState()
  if (!request || !visible) return false
  const safe =
    request.buttons.find(b => b.style === 'cancel') ?? (request.buttons.length === 1 ? request.buttons[0] : undefined)
  closeAlert()
  safe?.onPress?.()
  return true
}

// ── الواجهة البرمجية ───────────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string
  message?: string
  /** نص زر التنفيذ — الافتراضي «تأكيد». */
  confirmText?: string
  /** نص زر التراجع — الافتراضي «إلغاء». */
  cancelText?: string
  /** إجراء لا رجعة فيه (حذف/إلغاء/استرداد) — زر أحمر ونبرة خطر. */
  destructive?: boolean
  tone?: AlertTone
  onConfirm: () => void
  onCancel?: () => void
}

export const appAlert = {
  /** تنبيه بخيارات كاملة. */
  show: openAlert,

  /** نجاح عملية — علامة صح خضراء وزر واحد. */
  success(title: string, message?: string, onClose?: () => void) {
    openAlert({ title, message, tone: 'success', buttons: [{ text: ar.common.ok, onPress: onClose }] })
  },

  /** فشل عملية — علامة × حمراء وزر واحد. */
  error(title: string, message?: string) {
    openAlert({ title, message, tone: 'error', buttons: [{ text: ar.common.ok }] })
  },

  /** معلومة محايدة. */
  info(title: string, message?: string) {
    openAlert({ title, message, tone: 'info', buttons: [{ text: ar.common.ok }] })
  },

  /** تأكيد بخيارين — زر التنفيذ يمينًا وزر التراجع يساره. */
  confirm({ title, message, confirmText, cancelText, destructive, tone, onConfirm, onCancel }: ConfirmOptions) {
    openAlert({
      title,
      message,
      tone: tone ?? (destructive ? 'danger' : 'question'),
      buttons: [
        { text: cancelText ?? ar.common.cancel, style: 'cancel', onPress: onCancel },
        {
          text: confirmText ?? ar.common.confirm,
          style: destructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ],
    })
  },

  /** إغلاق التنبيه المعروض برمجيًا (نادر — الأزرار تغلق نفسها). */
  dismiss: closeAlert,

  /**
   * لزر الرجوع داخل `Modal` مفتوحة: على أندرويد الـ Modal حوارٌ أصلي يبتلع زر الرجوع
   * فلا يصل إلى BackHandler. تُستدعى من `onRequestClose`؛ تُعيد true إن أغلقت تنبيهًا
   * (فلا تُغلق النافذة نفسها).
   */
  handleBack: dismissAlert,
}

// ── العرض ──────────────────────────────────────────────────────────────────

const TONES: Record<AlertTone, { icon: keyof typeof Ionicons.glyphMap; color: string; soft: string }> = {
  success: { icon: 'checkmark', color: colors.success, soft: colors.successSoft },
  error: { icon: 'close', color: colors.danger, soft: colors.dangerSoft },
  warning: { icon: 'alert', color: colors.warning, soft: colors.warningSoft },
  danger: { icon: 'alert', color: colors.danger, soft: colors.dangerSoft },
  question: { icon: 'help', color: colors.primary, soft: colors.primarySoft },
  info: { icon: 'information', color: colors.info, soft: colors.infoSoft },
}

/** يصير الزرّان صفًّا واحدًا ما لم يطُل نصّهما أو يزد عددهما. */
const STACK_TEXT_LENGTH = 14

/**
 * مضيف التنبيهات. يُركَّب مرة في جذر التطبيق، ومرة إضافية داخل أي `Modal` قد يُطلق
 * تنبيهًا وهو مفتوح — فيتولّى العرض ما دام مركَّبًا.
 */
export function AlertHost() {
  const [hostId] = useState(() => nextId++)

  useEffect(() => {
    useAlertStore.setState(s => ({ hosts: [...s.hosts, hostId] }))
    return () => useAlertStore.setState(s => ({ hosts: s.hosts.filter(h => h !== hostId) }))
  }, [hostId])

  // المضيف الأعمق (آخر من رُكِّب) هو وحده من يعرض — فلا يتكرر التنبيه مرتين.
  const active = useAlertStore(s => s.hosts[s.hosts.length - 1] === hostId)
  const request = useAlertStore(s => s.request)
  const visible = useAlertStore(s => s.visible)
  const [anim] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (!active || !request) return
    if (visible) {
      anim.setValue(0)
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 20,
        stiffness: 260,
        mass: 0.85,
      }).start()
      return
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // قد يكون تنبيهٌ جديد قد فُتح أثناء الخروج (زر يفتح تنبيهًا آخر) — لا نمسحه.
      if (finished) useAlertStore.setState(s => (s.visible ? s : { request: null }))
    })
  }, [active, request, visible, anim])

  useEffect(() => {
    if (!active || !visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissAlert()
      return true // يمنع زر الرجوع من مغادرة الشاشة خلف التنبيه
    })
    return () => sub.remove()
  }, [active, visible])

  if (!active || !request) return null

  const tone = TONES[request.tone]

  // في صفّ معكوس (RTL) أول عنصر في JSX يظهر أقصى اليمين: التنفيذ يمينًا، التراجع يساره.
  const actions = request.buttons.filter(b => b.style !== 'cancel')
  const cancels = request.buttons.filter(b => b.style === 'cancel')
  const ordered = [...actions, ...cancels]
  const stacked = ordered.length > 2 || ordered.some(b => b.text.length > STACK_TEXT_LENGTH)

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={dismissAlert} accessibilityLabel={ar.common.close} />

      <Animated.View
        style={[
          styles.card,
          {
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) },
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            ],
          },
        ]}
      >
        <View style={[styles.halo, { backgroundColor: tone.soft }]}>
          <View style={[styles.iconCircle, { backgroundColor: tone.color }]}>
            <Ionicons name={tone.icon} size={26} color={colors.onPrimary} />
          </View>
        </View>

        <Text style={styles.title}>{request.title}</Text>
        {request.message ? <Text style={styles.message}>{request.message}</Text> : null}

        <View style={[styles.actions, stacked && styles.actionsStacked]}>
          {ordered.map((button, index) => {
            const isCancel = button.style === 'cancel'
            const isDestructive = button.style === 'destructive'
            return (
              <Pressable
                key={`${button.text}:${index}`}
                onPress={() => pressButton(button)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.button,
                  isCancel ? styles.buttonCancel : isDestructive ? styles.buttonDestructive : styles.buttonPrimary,
                  stacked ? styles.buttonFull : styles.buttonFlex,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={[styles.buttonText, isCancel ? styles.buttonTextCancel : styles.buttonTextSolid]}>
                  {button.text}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 100, // فوق محتوى الشاشة وشريط التبويب على أندرويد
  },
  backdrop: { backgroundColor: 'rgba(15,23,42,0.55)' },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    ...shadow.elevated,
  },
  halo: {
    width: 76,
    height: 76,
    borderRadius: radius.full, // دائرة فعلية — الاستثناء الوحيد المسموح للتدوير الكامل
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    flexDirection: ROW,
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.xl,
  },
  // عموديًا: زر التنفيذ أعلى وزر التراجع أسفله (نفس ترتيب المصفوفة)
  actionsStacked: { flexDirection: 'column' },
  button: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
  },
  buttonFlex: { flex: 1 },
  buttonFull: { alignSelf: 'stretch' },
  buttonPressed: { opacity: 0.85 },
  buttonPrimary: { backgroundColor: colors.primary, ...shadow.button },
  buttonDestructive: { backgroundColor: colors.danger, ...shadow.button, shadowColor: colors.danger, shadowOpacity: 0.18 },
  buttonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: fontSize.md, fontWeight: '700' },
  buttonTextSolid: { color: colors.onPrimary },
  buttonTextCancel: { color: colors.textSecondary },
})
