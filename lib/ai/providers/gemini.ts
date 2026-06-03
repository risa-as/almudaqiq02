import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider, ToolDefinition, ConversationTurn } from './interface'

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

  async generateResponse({
    message,
    history,
    toolDefinitions,
    systemPrompt,
    executeToolCall,
  }: Parameters<AIProvider['generateResponse']>[0]): Promise<{ reply: string; toolsInvoked: string[] }> {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
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
