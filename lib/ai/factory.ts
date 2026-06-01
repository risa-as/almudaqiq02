import type { AIProvider } from './providers/interface'

export function getAIProvider(): AIProvider {
  const name = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase()

  if (name === 'gemini') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GeminiProvider } = require('./providers/gemini')
    return new GeminiProvider()
  }

  if (name === 'openai') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAIProvider } = require('./providers/openai')
    return new OpenAIProvider()
  }

  throw new Error(
    `Unknown AI_PROVIDER="${name}". Set AI_PROVIDER to "gemini" or "openai" in .env.local`
  )
}
