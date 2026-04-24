/**
 * AI Path Order Suggestion
 *
 * Suggests optimal ordering for courses within an existing learning path.
 * Uses the same AI infrastructure as generatePath but for reordering.
 *
 * @module
 */

import type { LearningPathEntry } from '@/data/types'
import { getAIConfiguration, getDecryptedApiKey, isAIAvailable } from '@/lib/aiConfiguration'
import { apiUrl } from '@/lib/apiBaseUrl'

/** Suggested order entry with justification */
export interface OrderSuggestionEntry {
  courseId: string
  position: number
  justification: string
}

/** Full order suggestion result */
export interface OrderSuggestionResult {
  entries: OrderSuggestionEntry[]
  /** Overall rationale for the suggested order */
  rationale: string
}

/**
 * Check if AI order suggestion is available
 */
export function isOrderSuggestionAvailable(): boolean {
  if (!isAIAvailable()) return false
  const config = getAIConfiguration()
  return config.consentSettings.learningPath === true
}

/**
 * Suggest optimal ordering for courses in a learning path.
 *
 * @param entries - Current entries in the path
 * @param courseNames - Map of courseId to course name
 * @param courseTags - Map of courseId to tags array
 * @param signal - Optional abort signal
 * @returns Suggested order with justifications
 */
export async function suggestPathOrder(
  entries: LearningPathEntry[],
  courseNames: Map<string, string>,
  courseTags: Map<string, string[]>,
  signal?: AbortSignal
): Promise<OrderSuggestionResult> {
  // Check for test mock
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __mockPathOrderResponse?: OrderSuggestionResult })
      .__mockPathOrderResponse
  ) {
    return (window as unknown as { __mockPathOrderResponse: OrderSuggestionResult })
      .__mockPathOrderResponse
  }

  if (entries.length < 2) {
    throw new Error('At least 2 courses are needed to suggest an order')
  }

  const config = getAIConfiguration()
  const apiKey = await getDecryptedApiKey()

  if (!apiKey) {
    throw new Error('AI features are not configured. Please set up your API key in Settings.')
  }

  const courseMetadata = entries.map(e => ({
    courseId: e.courseId,
    name: courseNames.get(e.courseId) || 'Unknown Course',
    tags: courseTags.get(e.courseId) || [],
    currentPosition: e.position,
  }))

  const prompt = `You are an expert learning path advisor. Suggest the optimal learning sequence for these courses based on prerequisite relationships and topic complexity.

Courses (currently in this order):
${JSON.stringify(courseMetadata, null, 2)}

Instructions:
1. Identify prerequisite relationships between courses
2. Order from foundational to advanced
3. For each course, provide a 1-2 sentence justification for its position
4. Provide a brief overall rationale for the reordering
5. Output ONLY valid JSON in this exact format:

{
  "entries": [
    {
      "courseId": "course-uuid",
      "position": 1,
      "justification": "Foundational course covering basics - start here"
    }
  ],
  "rationale": "Brief explanation of the overall reordering logic"
}

IMPORTANT: Return ONLY the JSON object. Include ALL courses.`

  const timeoutMs = 20000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort())
  }

  try {
    const response = await fetch(apiUrl('ai-generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        apiKey,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 2000,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `AI provider error (${response.status}): ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`
      )
    }

    const data = (await response.json()) as { text?: string }
    const content = data.text

    if (!content) {
      throw new Error('AI response is empty')
    }

    // Parse response
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : content

    const parsed = JSON.parse(jsonStr.trim()) as OrderSuggestionResult

    if (!Array.isArray(parsed.entries)) {
      throw new Error('AI response format is invalid (missing entries array)')
    }

    // Validate all course IDs exist
    const inputIds = new Set(entries.map(e => e.courseId))
    const validEntries = parsed.entries.filter(e => inputIds.has(e.courseId))

    // Add any missing courses at the end
    const suggestedIds = new Set(validEntries.map(e => e.courseId))
    const missing = entries.filter(e => !suggestedIds.has(e.courseId))
    missing.forEach((entry, i) => {
      validEntries.push({
        courseId: entry.courseId,
        position: validEntries.length + i + 1,
        justification: 'No specific prerequisites identified - can be studied anytime',
      })
    })

    // Normalize positions to 1-indexed sequential
    const normalized = validEntries
      .sort((a, b) => a.position - b.position)
      .map((e, i) => ({
        ...e,
        position: i + 1,
      }))

    return {
      entries: normalized,
      rationale: parsed.rationale || 'AI suggested this ordering based on topic analysis.',
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Order suggestion was cancelled')
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error('Failed to suggest course order. Please try again.')
  }
}
