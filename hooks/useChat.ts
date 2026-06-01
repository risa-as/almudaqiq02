'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolsInvoked?: string[]
  isLoading?: boolean
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
}

export function useChat({ storageKey, branchId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [usage, setUsage]       = useState<AiUsage | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) setMessages(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [storageKey])

  useEffect(() => {
    if (messages.length === 0) return
    try { sessionStorage.setItem(storageKey, JSON.stringify(messages)) } catch { /* ignore */ }
  }, [messages, storageKey])

  // Fetch current usage on mount
  useEffect(() => {
    fetch('/api/ai/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUsage(d) })
      .catch(() => {})
  }, [])

  const buildHistory = useCallback((msgs: ChatMessage[]) =>
    msgs
      .filter(m => !m.isLoading && !m.isError && m.content)
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }))
  , [])

  async function callAPI(userText: string, historyMsgs: ChatMessage[]) {
    const history = buildHistory(historyMsgs)
    const res = await fetch('/api/ai/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: userText, history, branchId: branchId ?? null }),
    })
    const data = await res.json()
    // Update usage from response
    if (data.limit !== undefined) {
      setUsage({ used: data.used, limit: data.limit, remaining: data.remaining })
    }
    return { data, ok: res.ok, status: res.status }
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
      const isSoftError = (status === 429 && data.error === 'daily_limit_reached') || data.error === 'quota_exceeded'
      setMessages(prev =>
        prev.map(m => m.isLoading
          ? { ...m, content: data.reply, toolsInvoked: data.toolsInvoked, isLoading: false, isError: !ok && !isSoftError }
          : m
        )
      )
    } catch {
      setMessages(prev =>
        prev.map(m => m.isLoading
          ? { ...m, content: 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.', isLoading: false, isError: true }
          : m
        )
      )
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
      const { data, ok } = await callAPI(lastUser.content, cleanedMsgs.slice(0, -1))
      setMessages(prev =>
        prev.map(m => m.isLoading
          ? { ...m, content: data.reply, toolsInvoked: data.toolsInvoked, isLoading: false, isError: !ok }
          : m
        )
      )
    } catch {
      setMessages(prev =>
        prev.map(m => m.isLoading
          ? { ...m, content: 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.', isLoading: false, isError: true }
          : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, messages, buildHistory, branchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearChat = useCallback(() => {
    setMessages([])
    try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
  }, [storageKey])

  return { messages, input, setInput, isLoading, usage, sendMessage, retryLast, clearChat, messagesEndRef }
}
