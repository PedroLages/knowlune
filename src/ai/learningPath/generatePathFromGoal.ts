/**
 * AI Goal-to-Path Generation
 *
 * Generates a learning path structure (name, description, sequenced courses
 * plus gap analysis) from a free-text goal and the user's course library.
 *
 * @module
 */

import type { ImportedCourse } from '@/data/types'
import { getAIConfiguration, getDecryptedApiKey } from '@/lib/aiConfiguration'
import { apiUrl } from '@/lib/apiBaseUrl'
import { withTimeout } from '@/lib/promiseUtils'

/** A single entry in the generated path — either a matched course or a gap */
export interface GoalPathEntry {
  /** Present for matched courses in the user's library */
  courseId?: string
  /** Present for gap entries — the topic the user should learn */
  gapTopic?: string
  /** 1-indexed position in the path */
  position: number
  /** AI justification for this entry's position */
  justification: string
  /** Whether this entry represents a gap (no matching course in library) */
  isGap: boolean
}

/** Result of goal-to-path generation */
export interface GeneratePathFromGoalResult {
  /** AI-generated path name */
  pathName: string
  /** AI-generated path description */
  pathDescription: string
  /** Ordered entries (matched courses + gaps) */
  entries: GoalPathEntry[]
  /** Overall rationale for the generated path structure */
  rationale: string
}

interface GeneratePathFromGoalOptions {
  timeout?: number // milliseconds, default 30000 (30s — goal-to-path prompts are larger)
  signal?: AbortSignal
}

/** Raw AI response shape before validation */
interface RawParsedResponse {
  pathName: string
  pathDescription: string
  entries: Array<{
    courseId?: string | null
    gapTopic?: string | null
    position: number
    justification: string
    isGap: boolean
  }>
  rationale: string
}

/**
 * Parse and validate an AI text response into a structured result.
 * Extracted so both the fetch path and the raw-text mock path can share it.
 *
 * @internal Exported for testing via raw-text mock
 */
export function parseAndValidateResponse(
  rawText: string,
  validCourseIds: Set<string>
): GeneratePathFromGoalResult {
  // Try to extract JSON from markdown code block if present
  let parsed: RawParsedResponse

  try {
    const jsonMatch =
      rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/```\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : rawText
    parsed = JSON.parse(jsonStr.trim()) as RawParsedResponse
  } catch {
    console.error('[generatePathFromGoal] Failed to parse LLM response:', rawText)
    throw new Error('AI response is not valid JSON. Please try again.')
  }

  // Validate required fields
  if (!parsed.pathName || !parsed.entries || !Array.isArray(parsed.entries)) {
    throw new Error('AI response format is invalid (missing pathName or entries array)')
  }

  if (parsed.entries.length === 0) {
    throw new Error('AI response is empty (no entries generated)')
  }

  // Validate and transform entries
  const validEntries: GoalPathEntry[] = []

  for (let i = 0; i < parsed.entries.length; i++) {
    const item = parsed.entries[i]

    // Validate common fields
    if (
      typeof item.position !== 'number' ||
      !item.justification ||
      typeof item.isGap !== 'boolean'
    ) {
      console.warn(`[generatePathFromGoal] Invalid entry at index ${i}: missing required fields`)
      continue
    }

    if (item.isGap) {
      // Gap entry: must have gapTopic
      if (!item.gapTopic || !item.gapTopic.trim()) {
        console.warn(`[generatePathFromGoal] Gap entry at index ${i}: missing gapTopic, skipping`)
        continue
      }

      validEntries.push({
        gapTopic: item.gapTopic.trim(),
        position: item.position,
        justification: item.justification,
        isGap: true,
      })
    } else {
      // Matched course entry: must have valid courseId from input set
      if (!item.courseId) {
        console.warn(`[generatePathFromGoal] Course entry at index ${i}: missing courseId`)
        // Treat as gap if it has a gapTopic, otherwise skip
        if (item.gapTopic) {
          validEntries.push({
            gapTopic: item.gapTopic.trim(),
            position: item.position,
            justification: item.justification,
            isGap: true,
          })
        }
        continue
      }

      if (!validCourseIds.has(item.courseId)) {
        console.warn(
          `[generatePathFromGoal] Unknown courseId "${item.courseId}" at index ${i}, excluding`
        )
        // If there's a gapTopic, treat it as a gap instead
        if (item.gapTopic) {
          validEntries.push({
            gapTopic: item.gapTopic.trim(),
            position: item.position,
            justification: item.justification,
            isGap: true,
          })
        }
        continue
      }

      validEntries.push({
        courseId: item.courseId,
        position: item.position,
        justification: item.justification,
        isGap: false,
      })
    }
  }

  if (validEntries.length === 0) {
    throw new Error('AI response contained no valid entries')
  }

  // Normalize positions to sequential 1-indexed
  const normalized = validEntries
    .sort((a, b) => a.position - b.position)
    .map((e, i) => ({
      ...e,
      position: i + 1,
    }))

  return {
    pathName: parsed.pathName.trim(),
    pathDescription: parsed.pathDescription?.trim() || '',
    entries: normalized,
    rationale: parsed.rationale || 'AI generated this learning path based on your goal.',
  }
}

/**
 * Generate a learning path from a free-text goal.
 *
 * Uses the configured AI provider to analyze the user's goal and available
 * course library, then produces a path structure with matched courses, gap
 * analysis, and justifications.
 *
 * @param goal - Free-text description of what the user wants to learn
 * @param courses - The user's imported course library (can be empty)
 * @param options - Configuration options (timeout, abort signal)
 * @returns Generated path structure with entries and rationale
 *
 * @throws {Error} If AI provider is unavailable, timeout occurs, or response is malformed
 */
export async function generatePathFromGoal(
  goal: string,
  courses: ImportedCourse[],
  options: GeneratePathFromGoalOptions = {}
): Promise<GeneratePathFromGoalResult> {
  const { timeout = 30000, signal } = options

  if (!goal || !goal.trim()) {
    throw new Error('Goal description is empty. Please describe what you want to learn.')
  }

  const trimmedGoal = goal.trim()
  const inputCourseIds = new Set(courses.map(c => c.id))

  // Check for test mock (E2E tests inject deterministic responses via window object)
  const windowMock =
    typeof window !== 'undefined'
      ? (window as unknown as {
          __mockGoalPathResponse?: GeneratePathFromGoalResult
          __mockGoalPathRawText?: string
        })
      : null

  if (windowMock?.__mockGoalPathResponse) {
    // Full mock response — returned directly (E2E mode, pre-validated)
    return windowMock.__mockGoalPathResponse
  }

  // Raw text mock — goes through full parsing and validation (unit test mode)
  if (windowMock?.__mockGoalPathRawText) {
    return parseAndValidateResponse(windowMock.__mockGoalPathRawText, inputCourseIds)
  }

  // Get AI configuration using centralized helpers
  const config = getAIConfiguration()
  const apiKey = await getDecryptedApiKey()

  if (!apiKey) {
    throw new Error('AI features are not configured. Please set up your API key in Settings.')
  }

  if (!config.consentSettings.learningPath) {
    throw new Error('Learning Path AI feature is disabled. Please enable it in Settings.')
  }

  // Build course metadata for the prompt
  const courseMetadata = courses.map(c => ({
    id: c.id,
    name: c.name,
    tags: c.tags,
    category: c.category,
    status: c.status,
    videoCount: c.videoCount,
    pdfCount: c.pdfCount,
  }))

  const hasCourses = courses.length > 0

  const prompt = `You are an expert learning path advisor. A user wants to learn something specific.

User's Learning Goal:
"${trimmedGoal}"

${
  hasCourses
    ? `Available Course Library:
${JSON.stringify(courseMetadata, null, 2)}`
    : `Available Course Library:
The user has NO courses in their library yet. You must produce a pure gap analysis — a template path of topics they should learn, with no courseId values.`
}

Instructions:
1. Analyze the user's goal and ${hasCourses ? 'the available courses' : 'the learning domain'}
2. Propose a path name (concise, 3-7 words) and a path description (1-2 sentences)
3. Sequence the learning journey from foundational to advanced
4. For each position:
   ${hasCourses ? '- If a matching course exists in the library, include its "courseId" and set "isGap" to false' : ''}
   - If no matching course exists for a needed topic, include a "gapTopic" (a short topic name, e.g., "Python Fundamentals") and set "isGap" to true
   - Provide a 1-2 sentence "justification" for why this entry belongs at this position
5. Include an overall "rationale" explaining the path structure
6. ALL entries MUST have "position" (starting at 1), "justification", and "isGap" fields
7. Gap entries MUST have "gapTopic" and MUST NOT have "courseId"
8. Matched course entries MUST have "courseId" and MUST NOT have "gapTopic"
9. Output ONLY valid JSON in this exact format:

{
  "pathName": "Path name here",
  "pathDescription": "Brief description of the path",
  "entries": [
    {
      "courseId": "course-uuid-or-null",
      "gapTopic": "Topic name or null",
      "position": 1,
      "justification": "Foundational topic - start here",
      "isGap": false
    }
  ],
  "rationale": "Overall reasoning for the path structure"
}

IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no extra text.`

  // Create fetch promise
  const fetchPromise = fetch(apiUrl('ai-generate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: config.provider,
      apiKey,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 3000,
    }),
    signal,
  })

  try {
    // Race between fetch and timeout
    const response = await withTimeout(fetchPromise, timeout, 'AI request timed out')

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `AI provider error (${response.status}): ${errorData.error?.message || response.statusText}`
      )
    }

    const data = await response.json()
    const content = data.text

    if (!content) {
      throw new Error('AI response is empty')
    }

    return parseAndValidateResponse(content, inputCourseIds)
  } catch (error) {
    // Handle abort
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Generation was cancelled')
    }

    // Re-throw known errors
    if (error instanceof Error) {
      throw error
    }

    // Unknown error
    throw new Error('Failed to generate learning path. Please try again.')
  }
}
