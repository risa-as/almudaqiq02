export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, {
      type: string
      description?: string
      enum?: string[]
    }>
    required?: string[]
  }
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AIProvider {
  name: string
  generateResponse(params: {
    message: string
    history: ConversationTurn[]
    toolDefinitions: ToolDefinition[]
    systemPrompt: string
    executeToolCall: (name: string, args: unknown) => Promise<unknown>
  }): Promise<{ reply: string; toolsInvoked: string[] }>
}
