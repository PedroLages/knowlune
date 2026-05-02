/**
 * Model Discovery Service for Cloud AI Providers
 *
 * Discovers available models from cloud providers via API calls (OpenAI, Gemini, Groq)
 * or static curated lists (Anthropic, GLM). Results are cached in memory for 5 minutes.
 *
 * @see E90-S04 — Model Discovery for Cloud Providers
 */

import { apiUrl } from './apiBaseUrl'
import type { AIProviderId } from './modelDefaults'
import { getStaticModels } from './modelDiscovery.static'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Discovered model from a provider */
export interface DiscoveredModel {
  /** Model identifier (e.g., "gpt-4o", "claude-haiku-4-5") */
  id: string
  /** Human-readable display name */
  name: string
  /** Provider this model belongs to */
  provider: AIProviderId
  /** Model family for grouping (e.g., "GPT-4o", "Claude Haiku") */
  family?: string
  /** Cost tier indicator */
  costTier?: 'free' | 'low' | 'medium' | 'high'
  /** Context window size in tokens */
  contextWindow?: number
  /** Model capabilities */
  capabilities: string[]
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  models: DiscoveredModel[]
  timestamp: number
}

const modelCache = new Map<string, CacheEntry>()

const MAX_CACHE_ENTRIES = 50

/** Compute a collision-resistant cache key using SHA-256 */
async function computeCacheKey(provider: AIProviderId, apiKey: string): Promise<string> {
  const data = new TextEncoder().encode(apiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${provider}:${hashHex.slice(0, 16)}`
}

/** Check if cache entry is still valid */
function getCached(key: string): DiscoveredModel[] | null {
  const entry = modelCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    modelCache.delete(key)
    return null
  }
  return entry.models
}

/** Store models in cache, evicting oldest entries if limit exceeded */
function setCache(key: string, models: DiscoveredModel[]): void {
  // Evict oldest entries if cache is full
  if (modelCache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [k, entry] of modelCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = k
      }
    }
    if (oldestKey) modelCache.delete(oldestKey)
  }

  modelCache.set(key, {
    models,
    timestamp: Date.now(),
  })
}

/** Clear the model cache (useful for testing or forced refresh) */
export function clearModelCache(): void {
  modelCache.clear()
}

// ---------------------------------------------------------------------------
// Provider-Specific Discovery
// ---------------------------------------------------------------------------

/** OpenAI model ID patterns to include (chat-capable models only) */
const OPENAI_INCLUDE_PATTERNS = [/^gpt-/, /^o1/, /^o3/, /^o4/]

/** OpenAI model ID patterns to exclude (non-chat models) */
const OPENAI_EXCLUDE_PATTERNS = [
  /embedding/i,
  /whisper/i,
  /dall-e/i,
  /tts/i,
  /realtime/i,
  /audio/i,
  /search/i,
  /instruct/i,
  /moderation/i,
  /babbage/i,
  /davinci/i,
]

/** Extract family name from OpenAI model ID */
function openaiFamily(id: string): string {
  if (id.startsWith('gpt-4o')) return 'GPT-4o'
  if (id.startsWith('gpt-4')) return 'GPT-4'
  if (id.startsWith('gpt-3.5')) return 'GPT-3.5'
  if (id.startsWith('o1')) return 'o1'
  if (id.startsWith('o3')) return 'o3'
  if (id.startsWith('o4')) return 'o4'
  return 'Other'
}

/** Estimate cost tier from OpenAI model name */
function openaiCostTier(id: string): DiscoveredModel['costTier'] {
  if (id.includes('mini')) return 'low'
  if (id.startsWith('gpt-3.5')) return 'low'
  if (id.startsWith('o1-mini') || id.startsWith('o3-mini')) return 'medium'
  if (id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) return 'high'
  if (id.startsWith('gpt-4o')) return 'medium'
  if (id.startsWith('gpt-4')) return 'high'
  return 'medium'
}

/**
 * Discover OpenAI models via GET /v1/models (proxied through Express server).
 * Filters to chat-capable models only.
 */
async function discoverOpenAI(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await fetch(apiUrl('models/openai'), {
    headers: { 'X-API-Key': apiKey },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`OpenAI model list failed: ${response.status}`)
  }

  const data = (await response.json()) as { data: Array<{ id: string; created?: number }> }

  return data.data
    .filter(m => {
      const matchesInclude = OPENAI_INCLUDE_PATTERNS.some(p => p.test(m.id))
      const matchesExclude = OPENAI_EXCLUDE_PATTERNS.some(p => p.test(m.id))
      return matchesInclude && !matchesExclude
    })
    .map(m => ({
      id: m.id,
      name: m.id,
      provider: 'openai' as AIProviderId,
      family: openaiFamily(m.id),
      costTier: openaiCostTier(m.id),
      contextWindow: m.id.includes('gpt-4o') ? 128000 : undefined,
      capabilities: ['chat', 'code'],
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Discover Gemini models via GET /v1beta/models?key={key}.
 * Filters to models with generateContent capability.
 */
async function discoverGemini(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`Gemini model list failed: ${response.status}`)
  }

  interface GeminiModel {
    name: string
    displayName: string
    supportedGenerationMethods?: string[]
    inputTokenLimit?: number
  }

  const data = (await response.json()) as { models: GeminiModel[] }

  return data.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => {
      // name format: "models/gemini-2.0-flash"
      const id = m.name.replace('models/', '')
      return {
        id,
        name: m.displayName || id,
        provider: 'gemini' as AIProviderId,
        family: extractGeminiFamily(id),
        costTier: geminiCostTier(id),
        contextWindow: m.inputTokenLimit,
        capabilities: ['chat', 'code'],
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

function extractGeminiFamily(id: string): string {
  if (id.includes('2.0')) return 'Gemini 2.0'
  if (id.includes('1.5')) return 'Gemini 1.5'
  if (id.includes('1.0')) return 'Gemini 1.0'
  return 'Gemini'
}

function geminiCostTier(id: string): DiscoveredModel['costTier'] {
  if (id.includes('flash-lite')) return 'free'
  if (id.includes('flash')) return 'free'
  if (id.includes('pro')) return 'medium'
  return 'low'
}

/**
 * Discover Groq models via GET /openai/v1/models (proxied through Express server).
 */
async function discoverGroq(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await fetch(apiUrl('models/groq'), {
    headers: { 'X-API-Key': apiKey },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`Groq model list failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    data: Array<{ id: string; owned_by?: string; context_window?: number }>
  }

  return data.data
    .map(m => ({
      id: m.id,
      name: m.id,
      provider: 'groq' as AIProviderId,
      family: extractGroqFamily(m.id),
      costTier: 'free' as const,
      contextWindow: m.context_window,
      capabilities: ['chat', 'code'],
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function extractGroqFamily(id: string): string {
  if (id.includes('llama-3.3')) return 'Llama 3.3'
  if (id.includes('llama-3.1')) return 'Llama 3.1'
  if (id.includes('llama-3')) return 'Llama 3'
  if (id.includes('mixtral')) return 'Mixtral'
  if (id.includes('gemma')) return 'Gemma'
  return 'Other'
}

// ---------------------------------------------------------------------------
// OpenRouter Discovery
// ---------------------------------------------------------------------------

/** OpenRouter model response shape */
interface OpenRouterModel {
  id: string
  name: string
  pricing?: { prompt: string; completion: string }
  context_length?: number
  architecture?: { modality?: string }
}

/**
 * Extract source provider from OpenRouter model ID (e.g., "anthropic/claude-haiku-4-5" → "Anthropic")
 */
function openrouterFamily(id: string): string {
  const prefix = id.split('/')[0]
  if (!prefix) return 'Other'
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

/** Estimate cost tier from OpenRouter pricing */
function openrouterCostTier(pricing?: {
  prompt: string
  completion: string
}): DiscoveredModel['costTier'] {
  if (!pricing) return 'medium'
  const promptCost = parseFloat(pricing.prompt)
  if (isNaN(promptCost) || promptCost === 0) return 'free'
  if (promptCost < 0.5) return 'low'
  if (promptCost < 5) return 'medium'
  return 'high'
}

/**
 * Discover OpenRouter models via GET /api/v1/models (proxied through Express server).
 * Limits to 50 most popular chat-capable models, grouped by source provider.
 */
async function discoverOpenRouter(apiKey: string): Promise<DiscoveredModel[]> {
  const response = await fetch(apiUrl('models/openrouter'), {
    headers: { 'X-API-Key': apiKey },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter model list failed: ${response.status}`)
  }

  const data = (await response.json()) as { data: OpenRouterModel[] }

  return data.data
    .filter(m => {
      // Filter to chat-capable models only (exclude image/audio-only models)
      const modality = m.architecture?.modality || ''
      return !modality.includes('image') || modality.includes('text')
    })
    .map(m => ({
      id: m.id, // Uses provider/model format (e.g., "anthropic/claude-haiku-4-5")
      name: m.name || m.id,
      provider: 'openrouter' as AIProviderId,
      family: openrouterFamily(m.id),
      costTier: openrouterCostTier(m.pricing),
      contextWindow: m.context_length,
      capabilities: ['chat', 'code'],
    }))
    .sort((a, b) => a.family.localeCompare(b.family) || a.id.localeCompare(b.id))
    .slice(0, 50) // Limit to top 50 after sorting
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover available models for a given AI provider.
 *
 * - OpenAI, Groq: Dynamic API fetch via server proxy
 * - Gemini: Direct API fetch (CORS-friendly)
 * - Anthropic, GLM: Static curated lists
 *
 * Results are cached in memory for 5 minutes. On API error, falls back to
 * static model list.
 *
 * @param provider - AI provider to discover models for
 * @param apiKey - API key for authentication
 * @returns Array of discovered models
 */
export async function discoverModels(
  provider: AIProviderId,
  apiKey: string
): Promise<DiscoveredModel[]> {
  // Ollama has its own discovery mechanism (OllamaModelPicker)
  if (provider === 'ollama') {
    return []
  }

  // Pre-compute collision-resistant cache key (SHA-256 based)
  const key = await computeCacheKey(provider, apiKey)

  // Check cache first
  const cached = getCached(key)
  if (cached) return cached

  // OpenRouter has its own dynamic discovery
  if (provider === 'openrouter') {
    try {
      const models = await discoverOpenRouter(apiKey)
      setCache(key, models)
      return models
    } catch (error) {
      console.warn('OpenRouter model discovery failed:', (error as Error).message) // silent-catch-ok: logged + empty fallback
      return []
    }
  }

  // Static-only providers (no API)
  if (provider === 'anthropic' || provider === 'glm') {
    const staticModels = getStaticModels(provider)
    setCache(key, staticModels)
    return staticModels
  }

  // Dynamic discovery with static fallback
  try {
    let models: DiscoveredModel[]

    switch (provider) {
      case 'openai':
        models = await discoverOpenAI(apiKey)
        break
      case 'gemini':
        models = await discoverGemini(apiKey)
        break
      case 'groq':
        models = await discoverGroq(apiKey)
        break
      default:
        models = getStaticModels(provider)
    }

    setCache(key, models)
    return models
  } catch (error) {
    console.warn(
      `Model discovery failed for ${provider}, using static fallback:`,
      (error as Error).message
    ) // silent-catch-ok: logged + fallback used
    const fallback = getStaticModels(provider)
    setCache(key, fallback)
    return fallback
  }
}
