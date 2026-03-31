/**
 * Static Model Catalogs for AI Providers
 *
 * Used as fallback when dynamic API discovery fails, and as the primary source
 * for providers without model listing APIs (Anthropic, GLM).
 *
 * @see E90-S04 — Model Discovery for Cloud Providers
 */

import type { DiscoveredModel } from './modelDiscovery'

/** Static Anthropic models — no public model listing API */
export const ANTHROPIC_MODELS: DiscoveredModel[] = [
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    family: 'Claude Opus',
    costTier: 'high',
    contextWindow: 200000,
    capabilities: ['chat', 'reasoning', 'code', 'vision'],
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    family: 'Claude Sonnet',
    costTier: 'medium',
    contextWindow: 200000,
    capabilities: ['chat', 'reasoning', 'code', 'vision'],
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    family: 'Claude Haiku',
    costTier: 'low',
    contextWindow: 200000,
    capabilities: ['chat', 'code', 'vision'],
  },
  {
    id: 'claude-sonnet-4-5-20250514',
    name: 'Claude Sonnet 4.5 (2025-05-14)',
    provider: 'anthropic',
    family: 'Claude Sonnet',
    costTier: 'medium',
    contextWindow: 200000,
    capabilities: ['chat', 'reasoning', 'code', 'vision'],
  },
  {
    id: 'claude-haiku-4-5-20250514',
    name: 'Claude Haiku 4.5 (2025-05-14)',
    provider: 'anthropic',
    family: 'Claude Haiku',
    costTier: 'low',
    contextWindow: 200000,
    capabilities: ['chat', 'code', 'vision'],
  },
]

/** Static GLM/Z.ai models — no public model listing API */
export const GLM_MODELS: DiscoveredModel[] = [
  {
    id: 'glm-4-flash',
    name: 'GLM-4 Flash',
    provider: 'glm',
    family: 'GLM-4',
    costTier: 'free',
    capabilities: ['chat', 'code'],
  },
  {
    id: 'glm-4-plus',
    name: 'GLM-4 Plus',
    provider: 'glm',
    family: 'GLM-4',
    costTier: 'free',
    capabilities: ['chat', 'code', 'reasoning'],
  },
]

/** Static fallback for OpenAI when API is unreachable */
export const OPENAI_FALLBACK_MODELS: DiscoveredModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    family: 'GPT-4o',
    costTier: 'medium',
    contextWindow: 128000,
    capabilities: ['chat', 'code', 'vision'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    family: 'GPT-4o',
    costTier: 'low',
    contextWindow: 128000,
    capabilities: ['chat', 'code', 'vision'],
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    family: 'GPT-4',
    costTier: 'high',
    contextWindow: 128000,
    capabilities: ['chat', 'code', 'vision'],
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    family: 'o1',
    costTier: 'high',
    contextWindow: 200000,
    capabilities: ['chat', 'reasoning', 'code'],
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    provider: 'openai',
    family: 'o1',
    costTier: 'medium',
    contextWindow: 128000,
    capabilities: ['chat', 'reasoning', 'code'],
  },
]

/** Static fallback for Gemini when API is unreachable */
export const GEMINI_FALLBACK_MODELS: DiscoveredModel[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    family: 'Gemini 2.0',
    costTier: 'free',
    contextWindow: 1000000,
    capabilities: ['chat', 'code', 'vision'],
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    family: 'Gemini 2.0',
    costTier: 'free',
    contextWindow: 1000000,
    capabilities: ['chat', 'code'],
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    family: 'Gemini 1.5',
    costTier: 'medium',
    contextWindow: 2000000,
    capabilities: ['chat', 'code', 'vision', 'reasoning'],
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    family: 'Gemini 1.5',
    costTier: 'free',
    contextWindow: 1000000,
    capabilities: ['chat', 'code', 'vision'],
  },
]

/** Static fallback for Groq when API is unreachable */
export const GROQ_FALLBACK_MODELS: DiscoveredModel[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'groq',
    family: 'Llama 3.3',
    costTier: 'free',
    contextWindow: 128000,
    capabilities: ['chat', 'code'],
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    family: 'Llama 3.1',
    costTier: 'free',
    contextWindow: 128000,
    capabilities: ['chat', 'code'],
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    provider: 'groq',
    family: 'Mixtral',
    costTier: 'free',
    contextWindow: 32768,
    capabilities: ['chat', 'code'],
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B',
    provider: 'groq',
    family: 'Gemma',
    costTier: 'free',
    contextWindow: 8192,
    capabilities: ['chat'],
  },
]

/** Get static fallback models for a given provider */
export function getStaticModels(provider: string): DiscoveredModel[] {
  switch (provider) {
    case 'anthropic':
      return ANTHROPIC_MODELS
    case 'glm':
      return GLM_MODELS
    case 'openai':
      return OPENAI_FALLBACK_MODELS
    case 'gemini':
      return GEMINI_FALLBACK_MODELS
    case 'groq':
      return GROQ_FALLBACK_MODELS
    default:
      return []
  }
}
