import OpenAI from 'openai'
import type { AIProvider, ToolDefinition, ConversationTurn } from './interface'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })

export class OpenAIProvider implements AIProvider {
  name = 'openai'

  async generateResponse({
    message,
    history,
    toolDefinitions,
    systemPrompt,
    executeToolCall,
  }: Parameters<AIProvider['generateResponse']>[0]): Promise<{ reply: string; toolsInvoked: string[] }> {
    const tools: OpenAI.Chat.ChatCompletionTool[] = toolDefinitions.map((t: ToolDefinition) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>,
      },
    }))

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h: ConversationTurn) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ]

    const toolsInvoked: string[] = []

    for (let round = 0; round < 5; round++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: 'auto',
      })

      const choice = response.choices[0]

      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
        return { reply: choice.message.content ?? '', toolsInvoked }
      }

      messages.push(choice.message)

      for (const tc of choice.message.tool_calls as any[]) {
        toolsInvoked.push(tc.function.name)
        let parsed: unknown
        try { parsed = JSON.parse(tc.function.arguments) } catch { parsed = {} }
        const result = await executeToolCall(tc.function.name, parsed)
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        })
      }
    }

    // Final answer after max rounds
    const final = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages })
    return { reply: final.choices[0].message.content ?? '', toolsInvoked }
  }
}
