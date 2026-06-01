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
    let response = await withRetry(() => chat.sendMessage(message))

    for (let round = 0; round < 5; round++) {
      const parts      = response.response.candidates?.[0]?.content?.parts ?? []
      const fnCallPart = parts.find((p: any) => p.functionCall)
      if (!fnCallPart?.functionCall) break

      const { name, args } = fnCallPart.functionCall
      toolsInvoked.push(name)

      const result = await executeToolCall(name, args)

      response = await withRetry(() =>
        chat.sendMessage([
          { functionResponse: { name, response: result as object } },
        ] as any)
      )
    }

    return { reply: response.response.text(), toolsInvoked }
  }
}
