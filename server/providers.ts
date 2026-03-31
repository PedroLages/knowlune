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

import { PROVIDER_DEFAULTS } from '../src/lib/modelDefaults.js'
import type { AIProviderId } from '../src/lib/modelDefaults.js'

/** Provider IDs matching the frontend AIProviderId type */
export type ProviderId = AIProviderId

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
      return createAnthropic({ apiKey })(model || PROVIDER_DEFAULTS.anthropic)

    case 'openai':
      return createOpenAI({ apiKey })(model || PROVIDER_DEFAULTS.openai)

    case 'groq':
      return createGroq({ apiKey })(model || PROVIDER_DEFAULTS.groq)

    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })(model || PROVIDER_DEFAULTS.gemini)

    case 'ollama':
      // Ollama exposes an OpenAI-compatible API at /v1/
      // Use createOpenAI with custom baseURL — no custom client needed
      // apiKey is 'ollama' (Ollama ignores auth but SDK requires a value)
      throw new Error('Ollama uses dedicated proxy route, not the generic provider handler')

    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }
}

/**
 * Create an OpenAI-compatible model pointed at an Ollama server
 *
 * @param ollamaServerUrl - Ollama server URL (e.g., http://192.168.1.100:11434)
 * @param model - Model name (e.g., llama3.2, qwen3:8b)
 * @returns AI SDK LanguageModel ready for generateText/streamText
 */
export function getOllamaProviderModel(ollamaServerUrl: string, model?: string) {
  return createOpenAI({
    baseURL: `${ollamaServerUrl.replace(/\/+$/, '')}/v1`,
    apiKey: 'ollama', // Ollama ignores this but SDK requires it
  })(model || PROVIDER_DEFAULTS.ollama)
}
