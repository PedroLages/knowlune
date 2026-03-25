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
} from '@/lib/aiConfiguration'

/** Result from AI course tagging */
export interface CourseTagResult {
  /** 1-5 lowercase topic tags */
  tags: string[]
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
  signal?: AbortSignal,
): Promise<CourseTagResult> {
  const ollamaConfig = getOllamaConfig()
  if (!ollamaConfig) {
    return { tags: [] }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TAGGER_TIMEOUT_MS)

  // Link external signal to our controller
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const fileList = courseMetadata.fileNames.slice(0, MAX_FILE_NAMES).join(', ')
    const userPrompt = `Title: "${courseMetadata.title}"\nFiles: ${fileList || '(none)'}`

    const response = await fetch(`${ollamaConfig.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaConfig.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        format: TAG_RESPONSE_SCHEMA,
        stream: false,
        options: { temperature: 0, num_predict: 200 },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.warn(`[CourseTagger] Ollama returned ${response.status}`)
      return { tags: [] }
    }

    const data = (await response.json()) as {
      message?: { content?: string }
    }

    const tags = parseTagResponse(data.message?.content)
    return { tags }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn('[CourseTagger] Request timed out or was cancelled')
    } else {
      console.warn('[CourseTagger] Failed:', (error as Error).message)
    }
    return { tags: [] }
  } finally {
    clearTimeout(timeoutId)
  }
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
  return [...new Set(
    raw
      .filter((t): t is string => typeof t === 'string')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean),
  )].slice(0, MAX_TAGS)
}

/**
 * Check whether Ollama is configured and available for tagging.
 * Useful for UI to decide whether to show tagging-related indicators.
 */
export function isOllamaTaggingAvailable(): boolean {
  return getOllamaConfig() !== null
}
