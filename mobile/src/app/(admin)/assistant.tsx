import { useCallback, useRef, useState } from 'react'
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
import { Ionicons } from '@expo/vector-icons'
import { ApiError } from '@/api/client'
import { sendChatMessage, type ChatHistoryItem } from '@/api/endpoints/ai'
import { Screen } from '@/components/Screen'
import { UpgradeState } from '@/components/UpgradeState'
import { useFeature } from '@/hooks/useFeature'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

const t = {
  title: 'المساعد الذكي',
  placeholder: 'اسأل عن مبيعاتك ومخزونك…',
  emptyTitle: 'مرحبًا! أنا مساعدك الذكي',
  emptyHint: 'اسألني بالعربية عن بياناتك، مثل:',
  examples: ['ما هي مبيعات اليوم؟', 'ما أكثر المنتجات مبيعًا هذا الأسبوع؟', 'كم عدد المنتجات المنخفضة في المخزون؟'],
  remaining: (n: number) => `المتبقي اليوم: ${n} استفسار`,
  thinking: 'يفكر…',
  connectionError: 'عذرًا، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.',
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

let nextId = 0
const makeId = () => `m${++nextId}`

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          msg.isError && styles.bubbleError,
        ]}
      >
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser, msg.isError && styles.bubbleTextError]}>
          {msg.content}
        </Text>
      </View>
    </View>
  )
}

export default function AdminAssistant() {
  // بوابة الميزة: مقفلة بالخطة → حالة الترقية، بلا أي نداء للخادم (FR-017)
  const aiEnabled = useFeature('ai_assistant')
  const { selectedBranchId } = useBranchSelection()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
  }, [])

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim()
      if (!text || sending) return
      setInput('')
      setSending(true)

      // التاريخ = الرسائل الناجحة السابقة (الخادم يتجاهله عند وجود conversationId)
      const history: ChatHistoryItem[] = messages
        .filter(m => !m.isError && m.content)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }))

      setMessages(prev => [...prev, { id: makeId(), role: 'user', content: text }])
      scrollToEnd()

      try {
        const res = await sendChatMessage({
          message: text,
          history,
          branchId: selectedBranchId,
          conversationId: conversationIdRef.current,
        })
        if (res.conversationId) conversationIdRef.current = res.conversationId
        if (typeof res.remaining === 'number') setRemaining(res.remaining)
        setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: res.reply }])
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : t.connectionError
        // الخطأ يظهر كرسالة عربية داخل المحادثة — لا انهيار ولا نص تقني (FR-018)
        setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: msg, isError: true }])
      } finally {
        setSending(false)
        scrollToEnd()
      }
    },
    [input, sending, messages, selectedBranchId, scrollToEnd]
  )

  if (!aiEnabled) {
    return (
      <Screen title={t.title} scroll={false}>
        <UpgradeState />
      </Screen>
    )
  }

  return (
    <Screen title={t.title} scroll={false}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={styles.messagesBody}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="sparkles-outline" size={30} color={colors.violet} />
              </View>
              <Text style={styles.emptyTitle}>{t.emptyTitle}</Text>
              <Text style={styles.emptyHint}>{t.emptyHint}</Text>
              {t.examples.map(ex => (
                <Pressable key={ex} style={styles.exampleChip} onPress={() => void send(ex)}>
                  <Text style={styles.exampleText}>{ex}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            messages.map(m => <Bubble key={m.id} msg={m} />)
          )}

          {sending ? (
            <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
              <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>{t.thinking}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {remaining !== null ? <Text style={styles.remaining}>{t.remaining(remaining)}</Text> : null}

        {/* شريط الإدخال */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t.placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            editable={!sending}
            textAlign="right"
          />
          <Pressable
            style={[styles.sendBtn, (sending || !input.trim()) && styles.sendBtnDisabled]}
            onPress={() => void send()}
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              // سهم الإرسال معكوس في RTL
              <Ionicons name="send" size={18} color={colors.onPrimary} style={styles.sendIcon} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  messagesBody: { paddingVertical: spacing.md, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  // في تخطيط RTL: flex-start = يمين الشاشة (رسائل المستخدم)، flex-end = يسارها
  bubbleRowUser: { justifyContent: 'flex-start' },
  bubbleRowAssistant: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubbleUser: { backgroundColor: colors.primary, borderTopRightRadius: radius.sm },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: radius.sm,
    ...shadow.card,
  },
  bubbleError: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  bubbleText: { fontSize: fontSize.md, color: colors.text, textAlign: 'right', lineHeight: 22 },
  bubbleTextUser: { color: colors.onPrimary },
  bubbleTextError: { color: colors.danger },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typingText: { fontSize: fontSize.sm, color: colors.textSecondary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyHint: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  exampleChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  exampleText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  remaining: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingBottom: spacing.xs,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
    fontSize: fontSize.md,
    color: colors.text,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendIcon: { transform: [{ scaleX: -1 }] },
})
