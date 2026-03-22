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
export type ProviderId = 'openai' | 'anthropic' | 'groq' | 'glm' | 'gemini' | 'ollama'

/**
 * Validates an Ollama server URL to prevent SSRF attacks.
 * The proxy forwards HTTP requests to this URL server-side, so it must
 * be restricted to safe, user-intended destinations.
 *
 * @throws {Error} if the URL is invalid, uses a non-HTTP(S) scheme, or
 *   targets a cloud metadata endpoint (169.254.x.x).
 */
export function validateOllamaUrl(rawUrl: string): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(`Invalid Ollama URL: "${rawUrl}"`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Ollama URL must use http or https protocol, got: ${url.protocol}`)
  }
  // Block cloud metadata endpoints (AWS, GCP, Azure instance metadata)
  if (url.hostname === '169.254.169.254' || url.hostname.startsWith('169.254.')) {
    throw new Error('Ollama URL targets a restricted address')
  }
  return rawUrl
}

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

    case 'ollama': {
      // apiKey field carries the Ollama base URL (e.g. 'http://192.168.1.x:11434')
      // Ollama exposes an OpenAI-compatible /v1/ API — use createOpenAI with custom baseURL
      const ollamaUrl = apiKey || 'http://localhost:11434'
      validateOllamaUrl(ollamaUrl) // Throws for invalid schemes or metadata IPs (SSRF guard)
      return createOpenAI({
        baseURL: `${ollamaUrl.replace(/\/$/, '')}/v1`,
        apiKey: 'ollama', // Ollama ignores auth but SDK requires non-empty value
      })(model || 'llama3.2')
    }

    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }
}
