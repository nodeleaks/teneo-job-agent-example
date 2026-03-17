import { AIProvider, AIMessage, AIResponse } from './types'

/**
 * Unified AI provider wrapper — supports Anthropic Claude and OpenAI.
 * Swap providers via AI_PROVIDER env variable without changing agent logic.
 */
export class AIClient {
  private provider: AIProvider
  private anthropicKey: string
  private openaiKey: string

  constructor() {
    this.provider = (process.env.AI_PROVIDER as AIProvider) || 'claude'
    this.anthropicKey = process.env.ANTHROPIC_API_KEY || ''
    this.openaiKey = process.env.OPENAI_API_KEY || ''
  }

  async complete(
    systemPrompt: string,
    messages: AIMessage[],
    maxTokens = 1024
  ): Promise<AIResponse> {
    if (this.provider === 'claude') return this.callClaude(systemPrompt, messages, maxTokens)

    return this.callOpenAI(systemPrompt, messages, maxTokens)
  }

  private async callClaude(
    systemPrompt: string,
    messages: AIMessage[],
    maxTokens: number
  ): Promise<AIResponse> {
    if (!this.anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages.filter((m) => m.role !== 'system'),
      }),
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`)
    }

    const data = await response.json() as ClaudeResponse
    const content = data.content?.[0]?.text || ''
    const tokensUsed =
      (data.usage?.input_tokens || 0) +
      (data.usage?.output_tokens || 0)

    return { content, tokensUsed }
  }

  private async callOpenAI(
    systemPrompt: string,
    messages: AIMessage[],
    maxTokens: number
  ): Promise<AIResponse> {
    if (!this.openaiKey) throw new Error('OPENAI_API_KEY not set')

    const allMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: allMessages
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json() as OpenAIResponse
    const content = data.choices?.[0]?.message?.content || ''
    const tokensUsed = data.usage?.total_tokens || 0

    return { content, tokensUsed }
  }
}

interface ClaudeResponse {
  content: {
    text: string
  }[]
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string
    }
  }[]
  usage: {
    total_tokens: number
  }
}
