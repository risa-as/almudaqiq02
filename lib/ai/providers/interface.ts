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

/** Incremental event emitted while a streaming response is being generated. */
export type StreamEvent =
  | { type: 'tool'; name: string }
  | { type: 'delta'; text: string }

export interface AIProvider {
  name: string
  generateResponse(params: {
    message: string
    history: ConversationTurn[]
    toolDefinitions: ToolDefinition[]
    systemPrompt: string
    executeToolCall: (name: string, args: unknown) => Promise<unknown>
  }): Promise<{ reply: string; toolsInvoked: string[] }>

  /**
   * Optional streaming variant: emits tool-start and text-delta events as they
   * happen. Providers that don't implement it fall back to generateResponse
   * (the API route then emits the full reply as a single delta).
   */
  generateResponseStream?(params: {
    message: string
    history: ConversationTurn[]
    toolDefinitions: ToolDefinition[]
    systemPrompt: string
    executeToolCall: (name: string, args: unknown) => Promise<unknown>
    onEvent: (event: StreamEvent) => void
  }): Promise<{ reply: string; toolsInvoked: string[] }>
}
