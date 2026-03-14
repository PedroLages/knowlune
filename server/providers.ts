/**
 * AI Provider Registry
 *
 * Maps provider IDs to Vercel AI SDK model instances.
 * Each provider factory creates a fresh client with the user's API key per request.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGroq } from '@ai-sdk/groq'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

/** Provider IDs matching the frontend AIProviderId type */
export type ProviderId = 'openai' | 'anthropic' | 'groq' | 'glm' | 'gemini'

/** Default models per provider */
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4-turbo',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
}

/**
 * Create a Vercel AI SDK model instance for the given provider
 *
 * @param providerId - Which AI provider to use
 * @param apiKey - User's API key (passed per-request, never stored server-side)
 * @param model - Optional model override (uses provider default if omitted)
 * @returns AI SDK LanguageModel ready for generateText/streamText
 */
export function getProviderModel(providerId: string, apiKey: string, model?: string) {
  switch (providerId) {
    case 'anthropic':
      return createAnthropic({ apiKey })(model || DEFAULT_MODELS.anthropic)

    case 'openai':
      return createOpenAI({ apiKey })(model || DEFAULT_MODELS.openai)

    case 'groq':
      return createGroq({ apiKey })(model || DEFAULT_MODELS.groq)

    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })(model || DEFAULT_MODELS.gemini)

    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }
}
