'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import type { MessageChart } from '@/lib/ai/charts'
import type { ActionProposal } from '@/lib/ai/proposals'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolsInvoked?: string[]
  charts?: MessageChart[]
  proposals?: ActionProposal[]
  isLoading?: boolean
  /** True while tokens are still arriving for this message. */
  isStreaming?: boolean
  isError?: boolean
}

export interface AiUsage {
  used: number
  limit: number
  remaining: number
}

interface UseChatOptions {
  storageKey: string
  branchId?: string | null
  /**
   * هل واجهة المحادثة ظاهرة الآن؟ عداد الاستهلاك لا يُعرض إلا داخل اللوحة
   * المفتوحة، فجلبه عند التركيب كان يُطلق طلبًا على كل صفحة في النظام يزاحم
   * بيانات الصفحة نفسها على الاتصال. صفحة المساعد تمرّر true (الافتراضي)،
   * والودجة العائمة تمرّر isOpen.
   */
  active?: boolean
}

interface CallResult {
  ok: boolean
  status: number
  data: {
    reply: string
    toolsInvoked?: string[]
    charts?: MessageChart[]
    proposals?: ActionProposal[]
    error?: string
    used?: number
    limit?: number
    remaining?: number
  }
}

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
  messagesCount: number
}

export function useChat({ storageKey, branchId, active = true }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [usage, setUsage]       = useState<AiUsage | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const convKey = `${storageKey}:conversation`

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) setMessages(JSON.parse(saved))
      const savedConv = sessionStorage.getItem(convKey)
      if (savedConv) setConversationId(savedConv)
    } catch { /* ignore */ }
  }, [storageKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      if (conversationId) sessionStorage.setItem(convKey, conversationId)
      else sessionStorage.removeItem(convKey)
    } catch { /* ignore */ }
  }, [conversationId, convKey])

  useEffect(() => {
    if (messages.length === 0) return
    try { sessionStorage.setItem(storageKey, JSON.stringify(messages)) } catch { /* ignore */ }
  }, [messages, storageKey])

  // Fetch current usage once the chat is actually visible
  useEffect(() => {
    if (!active) return
    fetch('/api/ai/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUsage(d) })
      .catch(() => {})
  }, [active])

  const buildHistory = useCallback((msgs: ChatMessage[]) =>
    msgs
      .filter(m => !m.isLoading && !m.isError && m.content)
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }))
  , [])

  /** Update the in-flight assistant message (the one that is loading/streaming). */
  function patchPending(patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) {
    setMessages(prev =>
      prev.map(m => (m.isLoading || m.isStreaming)
        ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) }
        : m
      )
    )
  }

  /**
   * Streaming call: reads NDJSON events (delta / tool / done / error) and
   * paints the reply token-by-token. Falls back to plain JSON for guard
   * responses (limits, auth) which the server returns without streaming.
   */
  async function callAPI(userText: string, historyMsgs: ChatMessage[]): Promise<CallResult> {
    const history = buildHistory(historyMsgs)
    const res = await fetch('/api/ai/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message: userText,
        history,
        branchId: branchId ?? null,
        conversationId,
        stream: true,
      }),
    })

    const contentType = res.headers.get('content-type') ?? ''
    if (!res.body || contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({ reply: '' }))
      if (data.limit !== undefined) {
        setUsage({ used: data.used, limit: data.limit, remaining: data.remaining })
      }
      if (data.conversationId) setConversationId(data.conversationId)
      return { ok: res.ok, status: res.status, data }
    }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''
    const tools: string[] = []
    const chartList: MessageChart[] = []
    const proposalList: ActionProposal[] = []
    let errored = false
    let finalData: CallResult['data'] = { reply: '' }

    const handleEvent = (evt: any) => {
      if (evt.type === 'delta' && typeof evt.text === 'string') {
        accumulated += evt.text
        patchPending({ content: accumulated, isLoading: false, isStreaming: true })
      } else if (evt.type === 'tool' && evt.name) {
        tools.push(evt.name)
        patchPending({ toolsInvoked: [...tools] })
      } else if (evt.type === 'chart' && evt.chart) {
        chartList.push(evt.chart)
        patchPending({ charts: [...chartList] })
      } else if (evt.type === 'proposal' && evt.proposal) {
        proposalList.push(evt.proposal)
        patchPending({ proposals: [...proposalList] })
      } else if (evt.type === 'done') {
        if (evt.conversationId) setConversationId(evt.conversationId)
        finalData = {
          reply:        accumulated,
          toolsInvoked: evt.toolsInvoked ?? tools,
          charts:       chartList,
          proposals:    proposalList,
          used:         evt.used,
          limit:        evt.limit,
          remaining:    evt.remaining,
        }
        if (evt.limit !== undefined) {
          setUsage({ used: evt.used, limit: evt.limit, remaining: evt.remaining })
        }
      } else if (evt.type === 'error') {
        errored = true
        finalData = { reply: evt.reply ?? 'عذراً، المساعد الذكي غير متاح حالياً.', error: evt.error, toolsInvoked: tools }
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try { handleEvent(JSON.parse(line)) } catch { /* skip malformed line */ }
      }
    }
    if (buffer.trim()) {
      try { handleEvent(JSON.parse(buffer)) } catch { /* skip */ }
    }

    if (!finalData.reply && accumulated) finalData.reply = accumulated
    return { ok: !errored, status: errored ? 503 : 200, data: finalData }
  }

  function finalizeWith(data: CallResult['data'], ok: boolean, status: number) {
    const isSoftError = (status === 429 && (data.error === 'daily_limit_reached' || data.error === 'rate_limited'))
      || data.error === 'quota_exceeded'
    setMessages(prev =>
      prev.map(m => (m.isLoading || m.isStreaming)
        ? {
            ...m,
            content:      data.reply || m.content,
            toolsInvoked: data.toolsInvoked ?? m.toolsInvoked,
            charts:       data.charts?.length ? data.charts : m.charts,
            proposals:    data.proposals?.length ? data.proposals : m.proposals,
            isLoading:    false,
            isStreaming:  false,
            isError:      !ok && !isSoftError,
          }
        : m
      )
    )
  }

  function failPending() {
    setMessages(prev =>
      prev.map(m => (m.isLoading || m.isStreaming)
        ? { ...m, content: m.content || 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.', isLoading: false, isStreaming: false, isError: true }
        : m
      )
    )
  }

  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText || isLoading) return
    setInput('')

    const userMsg:    ChatMessage = { id: crypto.randomUUID(), role: 'user',      content: userText }
    const loadingMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', isLoading: true }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setIsLoading(true)

    try {
      const { data, ok, status } = await callAPI(userText, messages)
      finalizeWith(data, ok, status)
    } catch {
      failPending()
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, buildHistory, branchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const retryLast = useCallback(async () => {
    if (isLoading) return
    const cleanedMsgs = messages.filter(m => !m.isError)
    const lastUser    = [...cleanedMsgs].reverse().find(m => m.role === 'user' && m.content)
    if (!lastUser) return

    const loadingMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', isLoading: true }
    setMessages([...cleanedMsgs, loadingMsg])
    setIsLoading(true)

    try {
      const { data, ok, status } = await callAPI(lastUser.content, cleanedMsgs.slice(0, -1))
      finalizeWith(data, ok, status)
    } catch {
      failPending()
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, messages, buildHistory, branchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearChat = useCallback(() => {
    setMessages([])
    setConversationId(null)
    try {
      sessionStorage.removeItem(storageKey)
      sessionStorage.removeItem(convKey)
    } catch { /* ignore */ }
  }, [storageKey, convKey])

  /** List the user's stored conversations (server-side). */
  const listConversations = useCallback(async (): Promise<ConversationSummary[]> => {
    try {
      const res = await fetch('/api/ai/conversations')
      if (!res.ok) return []
      const data = await res.json()
      return data.conversations ?? []
    } catch {
      return []
    }
  }, [])

  /** Resume a stored conversation: loads its messages and continues from there. */
  const loadConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`)
      if (!res.ok) return false
      const data = await res.json()
      const loaded: ChatMessage[] = (data.messages ?? []).map((m: any) => ({
        id:           m.id,
        role:         m.role,
        content:      m.content,
        toolsInvoked: m.toolsInvoked,
        charts:       m.charts,
      }))
      setMessages(loaded)
      setConversationId(id)
      try { sessionStorage.setItem(storageKey, JSON.stringify(loaded)) } catch { /* ignore */ }
      return true
    } catch {
      return false
    }
  }, [storageKey])

  /** Delete a stored conversation; clears the view if it is the active one. */
  const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' })
      if (res.ok && id === conversationId) clearChat()
      return res.ok
    } catch {
      return false
    }
  }, [conversationId, clearChat])

  return {
    messages, input, setInput, isLoading, usage,
    sendMessage, retryLast, clearChat, messagesEndRef,
    conversationId, listConversations, loadConversation, deleteConversation,
  }
}
