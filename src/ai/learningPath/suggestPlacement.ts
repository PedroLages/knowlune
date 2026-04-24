/**
 * AI Path Placement Suggestion
 *
 * Suggests which learning path a new course should be placed in
 * and at what position, with a justification.
 *
 * @module
 */

import type { LearningPath, LearningPathEntry } from '@/data/types'
import { getAIConfiguration, getDecryptedApiKey, isAIAvailable } from '@/lib/aiConfiguration'
import { apiUrl } from '@/lib/apiBaseUrl'

/** Placement suggestion returned by AI */
export interface PathPlacementSuggestion {
  /** Suggested path ID (null if no good match) */
  pathId: string | null
  /** Suggested path name (for display) */
  pathName: string | null
  /** Suggested position (1-indexed) within the path */
  position: number
  /** AI justification for this placement */
  justification: string
}

/** Course metadata sent to AI for analysis */
interface CourseMetadata {
  name: string
  tags: string[]
  description?: string
}

/** Path context sent to AI */
interface PathContext {
  id: string
  name: string
  description?: string
  courses: Array<{
    name: string
    position: number
    tags?: string[]
  }>
}

/**
 * Check if AI path placement is available.
 * Requires AI to be configured and learning path consent enabled.
 */
export function isPathPlacementAvailable(): boolean {
  if (!isAIAvailable()) return false
  const config = getAIConfiguration()
  return config.consentSettings.learningPath === true
}

/**
 * Suggest optimal placement for a new course within existing learning paths.
 *
 * @param course - Metadata of the course being imported
 * @param paths - Available learning paths with their entries
 * @param courseNames - Map of courseId to course name for existing path entries
 * @param signal - Optional abort signal
 * @returns Placement suggestion with path, position, and justification
 */
export async function suggestPathPlacement(
  course: CourseMetadata,
  paths: Array<{ path: LearningPath; entries: LearningPathEntry[] }>,
  courseNames: Map<string, string>,
  signal?: AbortSignal
): Promise<PathPlacementSuggestion> {
  // Check for test mock
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __mockPathPlacementResponse?: PathPlacementSuggestion })
      .__mockPathPlacementResponse
  ) {
    return (window as unknown as { __mockPathPlacementResponse: PathPlacementSuggestion })
      .__mockPathPlacementResponse
  }

  const config = getAIConfiguration()
  const apiKey = await getDecryptedApiKey()

  if (!apiKey) {
    throw new Error('AI features are not configured. Please set up your API key in Settings.')
  }

  // Build path context for the prompt
  const pathContexts: PathContext[] = paths.map(({ path, entries }) => ({
    id: path.id,
    name: path.name,
    description: path.description,
    courses: entries
      .sort((a, b) => a.position - b.position)
      .map(e => ({
        name: courseNames.get(e.courseId) || 'Unknown Course',
        position: e.position,
      })),
  }))

  const prompt = `You are an expert learning path advisor. A new course is being imported and you need to suggest which learning path it belongs to and at what position.

New Course:
${JSON.stringify({ name: course.name, tags: course.tags, description: course.description }, null, 2)}

Existing Learning Paths:
${JSON.stringify(pathContexts, null, 2)}

Instructions:
1. Analyze the new course's topic and tags
2. Determine which existing learning path is the best fit based on topic relevance
3. Suggest the optimal position within that path based on prerequisite relationships
4. Provide a 1-2 sentence justification
5. If no path is a good fit, set pathId to null
6. Output ONLY valid JSON in this exact format:

{
  "pathId": "path-uuid-or-null",
  "pathName": "Path Name or null",
  "position": 1,
  "justification": "This course covers foundational concepts that should come before..."
}

IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no extra text.`

  const timeoutMs = 15000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Combine with external signal
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
        maxTokens: 500,
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

    const parsed = JSON.parse(jsonStr.trim()) as PathPlacementSuggestion

    // Validate path ID exists if not null
    if (parsed.pathId) {
      const pathExists = paths.some(p => p.path.id === parsed.pathId)
      if (!pathExists) {
        // AI hallucinated a path ID - fall back to no suggestion
        return {
          pathId: null,
          pathName: null,
          position: 1,
          justification: 'Could not determine the best path for this course.',
        }
      }
    }

    return {
      pathId: parsed.pathId || null,
      pathName: parsed.pathName || null,
      position: Math.max(1, parsed.position || 1),
      justification: parsed.justification || 'AI suggested this placement.',
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Path placement suggestion was cancelled')
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error('Failed to suggest path placement. Please try again.')
  }
}
