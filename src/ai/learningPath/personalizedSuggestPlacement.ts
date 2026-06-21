/**
 * Personalized Path Placement Suggestion
 *
 * Wraps suggestPathPlacement with personalization context from reorder history.
 * When preferences are ready, prepends user preference summary to the AI prompt.
 * When not ready, delegates to the original suggestPathPlacement directly.
 *
 * @module
 */

import type { LearningPath, LearningPathEntry } from '@/data/types'
import type { UserPreferences } from '@/hooks/useUserPreferences'
import { formatPreferencesForPrompt } from '@/hooks/useUserPreferences'
import { suggestPathPlacement, type PathPlacementSuggestion } from './suggestPlacement'
import { getAIConfiguration, getDecryptedApiKey } from '@/lib/aiConfiguration'
import { apiUrl } from '@/lib/apiBaseUrl'

interface CourseMetadata {
  name: string
  tags: string[]
  description?: string
}

/**
 * Suggest optimal placement for a new course, personalized by user reorder history.
 *
 * When `preferences` is non-null and `isReady`, prepends a personalization section
 * to the AI prompt. Otherwise delegates to the original suggestPathPlacement.
 *
 * @param course - Metadata of the course being imported
 * @param paths - Available learning paths with their entries
 * @param courseNames - Map of courseId to course name for existing path entries
 * @param preferences - User preference vectors (null if not ready)
 * @param isReady - Whether preferences have enough data to be reliable
 * @param signal - Optional abort signal
 * @returns Placement suggestion with path, position, and justification
 */
export async function personalizedSuggestPlacement(
  course: CourseMetadata,
  paths: Array<{ path: LearningPath; entries: LearningPathEntry[] }>,
  courseNames: Map<string, string>,
  preferences: UserPreferences | null,
  isReady: boolean,
  signal?: AbortSignal
): Promise<PathPlacementSuggestion> {
  // Delegate to original when preferences unavailable
  if (!isReady || !preferences) {
    return suggestPathPlacement(course, paths, courseNames, signal)
  }

  const personalizationContext = formatPreferencesForPrompt(preferences)
  if (!personalizationContext) {
    return suggestPathPlacement(course, paths, courseNames, signal)
  }

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

  // Build path context (same as original)
  interface PathContext {
    id: string
    name: string
    description?: string
    courses: Array<{ name: string; position: number }>
  }

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

This user has the following learning preferences based on their past behavior:
${personalizationContext}

Factor these preferences into your placement suggestion.

New Course:
${JSON.stringify({ name: course.name, tags: course.tags, description: course.description }, null, 2)}

Existing Learning Paths:
${JSON.stringify(pathContexts, null, 2)}

Instructions:
1. Analyze the new course's topic and tags, factoring in the user's preferences
2. Determine which existing learning path is the best fit based on topic relevance
3. Suggest the optimal position within that path based on prerequisites AND user preferences
4. Provide a 1-2 sentence justification
5. If no path is a good fit, set pathId to null
6. Output ONLY valid JSON in this exact format:

{
  "pathId": "path-uuid-or-null",
  "pathName": "Path Name or null",
  "position": 1,
  "justification": "This course covers foundational concepts..."
}

IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no extra text.`

  const timeoutMs = 15000
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

    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : content

    const parsed = JSON.parse(jsonStr.trim()) as PathPlacementSuggestion

    if (parsed.pathId) {
      const pathExists = paths.some(p => p.path.id === parsed.pathId)
      if (!pathExists) {
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
      justification:
        parsed.justification || 'AI suggested this placement based on your preferences.',
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
