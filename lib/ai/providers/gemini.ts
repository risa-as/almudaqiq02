import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider, ToolDefinition, ConversationTurn, StreamEvent } from './interface'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

// Retry with exponential backoff for transient errors (503, 429)
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      const status = err?.status ?? err?.httpErrorCode ?? 0
      const isRetryable = status === 503 || status === 429 ||
        (err instanceof Error && (
          err.message.includes('503') ||
          err.message.includes('Service Unavailable') ||
          err.message.includes('overloaded')
        ))
      if (!isRetryable || attempt === maxAttempts - 1) throw err
      // Wait: 1s → 2s → 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
  throw lastError
}

export class GeminiProvider implements AIProvider {
  name = 'gemini'

  private buildModel(systemPrompt: string, toolDefinitions: ToolDefinition[]) {
    return genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      tools: [
        {
          functionDeclarations: toolDefinitions.map((t: ToolDefinition) => ({
            name:        t.name,
            description: t.description,
            parameters:  t.parameters as any,
          })),
        },
      ],
    })
  }

  /**
   * True token streaming: each round uses sendMessageStream; text chunks are
   * forwarded to onEvent as they arrive, tool calls run between rounds.
   */
  async generateResponseStream({
    message,
    history,
    toolDefinitions,
    systemPrompt,
    executeToolCall,
    onEvent,
  }: {
    message: string
    history: ConversationTurn[]
    toolDefinitions: ToolDefinition[]
    systemPrompt: string
    executeToolCall: (name: string, args: unknown) => Promise<unknown>
    onEvent: (event: StreamEvent) => void
  }): Promise<{ reply: string; toolsInvoked: string[] }> {
    const model = this.buildModel(systemPrompt, toolDefinitions)
    const chat = model.startChat({
      history: history.map((h: ConversationTurn) => ({
        role:  h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
    })

    const toolsInvoked: string[] = []
    const MAX_ROUNDS = 8
    let reply = ''

    // First round sends the user message; later rounds send tool responses.
    let nextInput: string | Array<{ functionResponse: { name: string; response: object } }> = message

    for (let round = 0; round <= MAX_ROUNDS + 1; round++) {
      const forceFinal = round > MAX_ROUNDS
      if (forceFinal) {
        nextInput =
          'لقد جمعت بيانات كافية. قدّم الآن إجابتك النهائية للمستخدم بالعربية: تحليل موجز وتوصيات عملية مبنية على الأرقام، دون استدعاء أدوات إضافية.'
      }

      const result = await withRetry(() => chat.sendMessageStream(nextInput as any))

      let roundText = ''
      for await (const chunk of result.stream) {
        let text = ''
        try { text = chunk.text() } catch { /* function-call chunks have no text */ }
        if (text) {
          roundText += text
          onEvent({ type: 'delta', text })
        }
      }

      const full = await result.response
      reply += roundText

      const parts      = full.candidates?.[0]?.content?.parts ?? []
      const fnCallPart = parts.find((p: any) => p.functionCall)

      if (!fnCallPart?.functionCall || forceFinal) break

      const { name, args } = fnCallPart.functionCall
      toolsInvoked.push(name)
      onEvent({ type: 'tool', name })

      const toolResult = await executeToolCall(name, args)
      nextInput = [{ functionResponse: { name, response: toolResult as object } }]
    }

    // Backstop: model ended on a tool call with no text at all.
    if (!reply.trim()) {
      try {
        const finalResp = await withRetry(() =>
          chat.sendMessageStream(
            'اكتب الآن إجابتك النهائية بالعربية بناءً على البيانات التي حصلت عليها (تحليل + توصيات عملية). لا تستدعِ أدوات إضافية.'
          )
        )
        for await (const chunk of finalResp.stream) {
          let text = ''
          try { text = chunk.text() } catch { /* skip */ }
          if (text) {
            reply += text
            onEvent({ type: 'delta', text })
          }
        }
      } catch { /* fall through to default message */ }
    }

    if (!reply.trim()) {
      reply = 'عذراً، لم أتمكن من توليد إجابة كاملة. حاول إعادة صياغة سؤالك أو تحديد نطاق زمني أوضح.'
      onEvent({ type: 'delta', text: reply })
    }

    return { reply: reply.trim(), toolsInvoked }
  }

  async generateResponse({
    message,
    history,
    toolDefinitions,
    systemPrompt,
    executeToolCall,
  }: Parameters<AIProvider['generateResponse']>[0]): Promise<{ reply: string; toolsInvoked: string[] }> {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      tools: [
        {
          functionDeclarations: toolDefinitions.map((t: ToolDefinition) => ({
            name:        t.name,
            description: t.description,
            parameters:  t.parameters as any,
          })),
        },
      ],
    })

    const chat = model.startChat({
      history: history.map((h: ConversationTurn) => ({
        role:  h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
    })

    const toolsInvoked: string[] = []
    // Allow enough rounds for advisory questions that gather several data tools
    // before synthesising recommendations.
    const MAX_ROUNDS = 8
    let response = await withRetry(() => chat.sendMessage(message))
    let reply = ''

    for (let round = 0; round <= MAX_ROUNDS; round++) {
      const parts      = response.response.candidates?.[0]?.content?.parts ?? []
      const fnCallPart = parts.find((p: any) => p.functionCall)

      // No function call → the model produced its final answer. Capture and stop.
      if (!fnCallPart?.functionCall) {
        try { reply = response.response.text() } catch { reply = '' }
        break
      }

      // Hit the tool-call budget — ask the model to answer now using gathered data,
      // instead of calling yet another tool (prevents an empty, tool-only reply).
      if (round === MAX_ROUNDS) {
        const finalResp = await withRetry(() =>
          chat.sendMessage(
            'لقد جمعت بيانات كافية. قدّم الآن إجابتك النهائية للمستخدم بالعربية: تحليل موجز وتوصيات عملية مبنية على الأرقام، دون استدعاء أدوات إضافية.'
          )
        )
        try { reply = finalResp.response.text() } catch { reply = '' }
        break
      }

      const { name, args } = fnCallPart.functionCall
      toolsInvoked.push(name)

      const result = await executeToolCall(name, args)

      response = await withRetry(() =>
        chat.sendMessage([
          { functionResponse: { name, response: result as object } },
        ] as any)
      )
    }

    // Backstop: if the model ended on a tool call without any text (e.g. it invoked
    // a tool then stopped), force one final synthesis turn so the user always gets
    // a written answer — not just a tool badge.
    if (!reply.trim()) {
      try {
        const finalResp = await withRetry(() =>
          chat.sendMessage(
            'اكتب الآن إجابتك النهائية بالعربية بناءً على البيانات التي حصلت عليها (تحليل + توصيات عملية). لا تستدعِ أدوات إضافية.'
          )
        )
        reply = finalResp.response.text()
      } catch { /* fall through to default message */ }
    }

    return {
      reply: reply.trim() || 'عذراً، لم أتمكن من توليد إجابة كاملة. حاول إعادة صياغة سؤالك أو تحديد نطاق زمني أوضح.',
      toolsInvoked,
    }
  }
}
