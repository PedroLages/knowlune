/**
 * Course Tagger — Ollama-powered auto-categorization
 *
 * Sends course metadata (title + file names) to a local Ollama model and
 * returns 2-5 topic tags as structured JSON. Uses Ollama's `format` parameter
 * for schema-enforced output, giving near-100% JSON validity.
 *
 * Designed for fast, small models (Llama 3.2 3B, Phi-3 Mini, Gemma 2 2B).
 *
 * @module
 */

import {
  getOllamaServerUrl,
  getOllamaSelectedModel,
  isOllamaDirectConnection,
} from '@/lib/aiConfiguration'
import { apiUrl } from '@/lib/apiBaseUrl'
import { trackAIUsage } from '@/lib/aiEventTracking'

/** Result from AI course tagging */
export interface CourseTagResult {
  /** 1-5 lowercase topic tags */
  tags: string[]
}

/** Result from AI course description generation */
export interface CourseDescriptionResult {
  /** 1-2 sentence course description */
  description: string
}

/** Default timeout for tagging requests (10 seconds) */
const TAGGER_TIMEOUT_MS = 10_000

/** Maximum number of file names included in the prompt */
const MAX_FILE_NAMES = 50

/** Maximum number of tags returned */
const MAX_TAGS = 5

/**
 * JSON schema for Ollama's `format` parameter.
 * Enforces structured output so the model returns valid JSON every time.
 */
const TAG_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    tags: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
  },
  required: ['tags'] as const,
}

/**
 * System prompt optimized for fast, small models.
 * Short and directive to minimize token usage.
 */
const SYSTEM_PROMPT =
  'You are a course classifier. Given a course title and file list, assign 1-5 short, descriptive topic tags. Focus on the subject matter, programming languages, frameworks, or skills taught. Return JSON only.'

/** Options for a single Ollama chat request */
interface OllamaChatOptions {
  /** System prompt for the model */
  systemPrompt: string
  /** User prompt with course metadata */
  userPrompt: string
  /** JSON schema for structured output */
  format: Record<string, unknown>
  /** Model generation options (temperature, num_predict, etc.) */
  options: Record<string, unknown>
  /** Optional AbortSignal for external cancellation */
  signal?: AbortSignal
  /** Log prefix for warnings (e.g. "[CourseTagger]") */
  logPrefix: string
}

/**
 * Send a chat request to Ollama and return the raw content string.
 *
 * Handles timeout, abort signal linking, proxy routing, and error logging.
 * Returns `null` on any failure (never throws).
 */
async function callOllamaChat(
  ollamaConfig: { url: string; model: string },
  opts: OllamaChatOptions
): Promise<string | null> {
  // Bail early if the caller already aborted
  if (opts.signal?.aborted) {
    console.warn(`${opts.logPrefix} Request already aborted`)
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TAGGER_TIMEOUT_MS)

  // Link external signal to our controller
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    // Route through the Express proxy for SSRF validation, unless direct connection is enabled
    const useDirectConnection = isOllamaDirectConnection()
    const fetchUrl = useDirectConnection ? `${ollamaConfig.url}/api/chat` : apiUrl('ai-ollama/chat')

    const requestBody: Record<string, unknown> = {
      model: ollamaConfig.model,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
      format: opts.format,
      stream: false,
      options: opts.options,
    }

    // Include serverUrl so the proxy knows where to forward
    if (!useDirectConnection) {
      requestBody.ollamaServerUrl = ollamaConfig.url
    }

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.warn(`${opts.logPrefix} Ollama returned ${response.status}`)
      return null
    }

    const data = (await response.json()) as {
      message?: { content?: string }
    }

    return data.message?.content ?? null
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn(`${opts.logPrefix} Request timed out or was cancelled`)
    } else {
      console.warn(`${opts.logPrefix} Failed:`, (error as Error).message)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Generate topic tags for an imported course using Ollama.
 *
 * Returns `{ tags: [] }` (never throws) when:
 * - Ollama is not configured
 * - The request times out
 * - The model returns invalid output
 * - Any network error occurs
 *
 * @param courseMetadata - Course title and file names to analyze
 * @param signal - Optional AbortSignal for external cancellation
 * @returns Parsed topic tags (1-5 items) or empty array on failure
 */
export async function generateCourseTags(
  courseMetadata: { title: string; fileNames: string[] },
  signal?: AbortSignal
): Promise<CourseTagResult> {
  const startTime = Date.now()
  // E96-S03: track AI usage (fire-and-forget).
  // `AIFeatureType` does not have a 'course_tagging' entry and we do not
  // extend the enum in this story (Supabase schema change). Using the
  // closest-fit 'auto_analysis' feature and tagging granularity via
  // `metadata.subFeature` per plan M1.
  const emit = (status: 'success' | 'error', extra: Record<string, unknown> = {}): void => {
    trackAIUsage('auto_analysis', {
      durationMs: Date.now() - startTime,
      status,
      metadata: { subFeature: 'course_tagging', ...extra },
    }).catch(() => {
      // silent-catch-ok
    })
  }

  const ollamaConfig = getOllamaConfig()
  if (!ollamaConfig) {
    emit('error', { errorCode: 'ollama_not_configured' })
    return { tags: [] }
  }

  const fileList = courseMetadata.fileNames.slice(0, MAX_FILE_NAMES).join(', ')
  const userPrompt = `Title: "${courseMetadata.title}"\nFiles: ${fileList || '(none)'}`

  const content = await callOllamaChat(ollamaConfig, {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    format: TAG_RESPONSE_SCHEMA,
    options: { temperature: 0, num_predict: 200 },
    signal,
    logPrefix: '[CourseTagger]',
  })

  const tags = parseTagResponse(content ?? undefined)
  if (content === null) {
    emit('error', { errorCode: 'ollama_request_failed' })
  } else if (tags.length === 0) {
    emit('error', { errorCode: 'parse_failed' })
  } else {
    emit('success', { tagCount: tags.length })
  }
  return { tags }
}

/**
 * Get Ollama configuration for the tagger.
 *
 * Returns null if Ollama is not configured as the active provider
 * or if no server URL is set.
 */
function getOllamaConfig(): { url: string; model: string } | null {
  const serverUrl = getOllamaServerUrl()
  if (!serverUrl) return null

  return {
    url: serverUrl.replace(/\/+$/, ''),
    model: getOllamaSelectedModel() || 'llama3.2',
  }
}

/**
 * Parse the tag response from Ollama with a defensive fallback chain.
 *
 * 1. Direct JSON.parse (should always work with `format` param)
 * 2. Extract from markdown code fences
 * 3. Regex brace match
 * 4. Return empty array on total failure
 */
export function parseTagResponse(content: string | undefined): string[] {
  if (!content) return []

  try {
    // Attempt 1: Direct parse (format param guarantees valid JSON)
    const parsed = JSON.parse(content)
    if (parsed && Array.isArray(parsed.tags)) {
      return normalizeTags(parsed.tags)
    }
    // Response might be a raw array
    if (Array.isArray(parsed)) {
      return normalizeTags(parsed)
    }
  } catch {
    // Fall through to fallback strategies
  }

  try {
    // Attempt 2: Extract from markdown code fences
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      const parsed = JSON.parse(fenceMatch[1])
      if (parsed?.tags && Array.isArray(parsed.tags)) {
        return normalizeTags(parsed.tags)
      }
    }
  } catch {
    // Fall through
  }

  try {
    // Attempt 3: Find JSON object with regex
    const braceMatch = content.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      const parsed = JSON.parse(braceMatch[0])
      if (parsed?.tags && Array.isArray(parsed.tags)) {
        return normalizeTags(parsed.tags)
      }
    }
  } catch {
    // Fall through
  }

  try {
    // Attempt 4: Find raw JSON array
    const arrayMatch = content.match(/\[[\s\S]*?\]/)
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0])
      if (Array.isArray(parsed)) {
        return normalizeTags(parsed)
      }
    }
  } catch {
    // Total failure
  }

  console.warn('[CourseTagger] Could not parse tags from response:', content)
  return []
}

/**
 * Normalize tags: trim, lowercase, deduplicate, limit to MAX_TAGS.
 */
function normalizeTags(raw: unknown[]): string[] {
  return [
    ...new Set(
      raw
        .filter((t): t is string => typeof t === 'string')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean)
    ),
  ].slice(0, MAX_TAGS)
}

/**
 * Check whether Ollama is configured and available for tagging.
 * Useful for UI to decide whether to show tagging-related indicators.
 */
export function isOllamaTaggingAvailable(): boolean {
  return getOllamaConfig() !== null
}

/**
 * JSON schema for Ollama's `format` parameter for descriptions.
 */
const DESCRIPTION_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    description: {
      type: 'string' as const,
    },
  },
  required: ['description'] as const,
}

/** System prompt for course description generation. */
const DESCRIPTION_SYSTEM_PROMPT =
  'You are a course summarizer. Given a course title and file list, write a concise 1-2 sentence description of what the course teaches. Focus on the main topics and skills covered. Return JSON only.'

/**
 * Generate a course description using Ollama.
 *
 * Returns `{ description: '' }` (never throws) when:
 * - Ollama is not configured
 * - The request times out
 * - The model returns invalid output
 * - Any network error occurs
 *
 * @param courseMetadata - Course title and file names to analyze
 * @param signal - Optional AbortSignal for external cancellation
 * @returns Parsed description or empty string on failure
 */
export async function generateCourseDescription(
  courseMetadata: { title: string; fileNames: string[] },
  signal?: AbortSignal
): Promise<CourseDescriptionResult> {
  const startTime = Date.now()
  // E96-S03: track AI usage (fire-and-forget).
  // Description generation is the same Ollama-backed flow as tagging; share
  // the 'auto_analysis' feature slot with a distinct `subFeature` per plan M1.
  const emit = (status: 'success' | 'error', extra: Record<string, unknown> = {}): void => {
    trackAIUsage('auto_analysis', {
      durationMs: Date.now() - startTime,
      status,
      metadata: { subFeature: 'course_description', ...extra },
    }).catch(() => {
      // silent-catch-ok
    })
  }

  const ollamaConfig = getOllamaConfig()
  if (!ollamaConfig) {
    emit('error', { errorCode: 'ollama_not_configured' })
    return { description: '' }
  }

  const fileList = courseMetadata.fileNames.slice(0, MAX_FILE_NAMES).join(', ')
  const userPrompt = `Title: "${courseMetadata.title}"\nFiles: ${fileList || '(none)'}`

  const content = await callOllamaChat(ollamaConfig, {
    systemPrompt: DESCRIPTION_SYSTEM_PROMPT,
    userPrompt,
    format: DESCRIPTION_RESPONSE_SCHEMA,
    options: { temperature: 0.3, num_predict: 300 },
    signal,
    logPrefix: '[CourseTagger] Description:',
  })

  const description = parseDescriptionResponse(content ?? undefined)
  if (content === null) {
    emit('error', { errorCode: 'ollama_request_failed' })
  } else if (description === '') {
    emit('error', { errorCode: 'parse_failed' })
  } else {
    emit('success', { descriptionLength: description.length })
  }
  return { description }
}

/**
 * Parse the description response from Ollama with defensive fallbacks.
 */
export function parseDescriptionResponse(content: string | undefined): string {
  if (!content) return ''

  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed.description === 'string') {
      return parsed.description.trim()
    }
  } catch {
    // Fall through to fallback strategies
  }

  try {
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      const parsed = JSON.parse(fenceMatch[1])
      if (parsed?.description && typeof parsed.description === 'string') {
        return parsed.description.trim()
      }
    }
  } catch {
    // Fall through
  }

  try {
    const braceMatch = content.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      const parsed = JSON.parse(braceMatch[0])
      if (parsed?.description && typeof parsed.description === 'string') {
        return parsed.description.trim()
      }
    }
  } catch {
    // Fall through
  }

  console.warn('[CourseTagger] Could not parse description from response:', content)
  return ''
}
