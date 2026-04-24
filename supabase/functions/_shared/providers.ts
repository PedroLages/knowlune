import type { LanguageModel } from 'npm:ai@^6.0.97'
import { createAnthropic } from 'npm:@ai-sdk/anthropic@^3.0.44'
import { createOpenAI } from 'npm:@ai-sdk/openai@^3.0.29'
import { createGroq } from 'npm:@ai-sdk/groq@^3.0.29'
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@^3.0.43'
import { createZhipu } from 'npm:zhipu-ai-provider@^0.2.2'

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'groq'
  | 'gemini'
  | 'openrouter'
  | 'glm'
  | 'ollama'

// Keep in sync with src/lib/modelDefaults.ts (PROVIDER_DEFAULTS).
const PROVIDER_DEFAULTS: Record<ProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  groq: 'llama-3.3-70b-versatile',
  glm: 'glm-4.7-flash',
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3.2',
  openrouter: 'anthropic/claude-haiku-4-5',
}

function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '')
}

export function getProviderModel(
  providerId: ProviderId,
  apiKey: string,
  model?: string,
): LanguageModel {
  switch (providerId) {
    case 'anthropic':
      return createAnthropic({ apiKey })(model || PROVIDER_DEFAULTS.anthropic)
    case 'openai':
      return createOpenAI({ apiKey })(model || PROVIDER_DEFAULTS.openai)
    case 'groq':
      return createGroq({ apiKey })(model || PROVIDER_DEFAULTS.groq)
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })(model || PROVIDER_DEFAULTS.gemini)
    case 'openrouter':
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
        headers: {
          'HTTP-Referer': 'https://knowlune.app',
          'X-Title': 'Knowlune',
        },
      })(model || PROVIDER_DEFAULTS.openrouter)
    case 'glm':
      return createZhipu({ apiKey })(model || PROVIDER_DEFAULTS.glm)
    case 'ollama':
      throw new Error('Ollama uses dedicated proxy route, not the generic provider handler')
    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }
}

export function getOllamaProviderModel(
  ollamaServerUrl: string,
  model?: string,
): LanguageModel {
  return createOpenAI({
    baseURL: `${trimTrailingSlashes(ollamaServerUrl)}/v1`,
    apiKey: 'ollama',
  })(model || PROVIDER_DEFAULTS.ollama)
}
