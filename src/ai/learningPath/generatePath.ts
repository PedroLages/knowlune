import type { ImportedCourse, LearningPathCourse } from '@/data/types'
import { getAIConfiguration, getDecryptedApiKey } from '@/lib/aiConfiguration'
import './types' // Import window type declaration

interface GeneratePathOptions {
  timeout?: number // milliseconds, default 20000 (20s)
  signal?: AbortSignal
}

/**
 * Generate an AI-powered learning path from imported courses.
 *
 * Uses OpenAI to analyze course metadata (titles, tags, status) and infer
 * prerequisite relationships to suggest an optimal learning sequence.
 *
 * @param courses - Array of imported courses to sequence
 * @param onUpdate - Callback invoked as courses are streamed (for progressive UI updates)
 * @param options - Configuration options (timeout, abort signal)
 * @returns Sequenced learning path with justifications
 *
 * @throws {Error} If AI provider is unavailable, timeout occurs, or response is malformed
 */
export async function generateLearningPath(
  courses: ImportedCourse[],
  onUpdate: (course: LearningPathCourse) => void,
  options: GeneratePathOptions = {}
): Promise<LearningPathCourse[]> {
  const { timeout = 20000, signal } = options

  if (courses.length < 2) {
    throw new Error('At least 2 courses are required to generate a learning path')
  }

  // Check for test mock (E2E tests inject deterministic responses via window object)
  if (typeof window !== 'undefined' && window.__mockLearningPathResponse) {
    const mockResponse = window.__mockLearningPathResponse
    const result = mockResponse.learningPath.map(course => ({
      ...course,
      generatedAt: new Date().toISOString(),
    }))

    // Simulate streaming by calling onUpdate for each course
    result.forEach(course => onUpdate(course))

    return result
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

  // Construct prompt with course metadata
  const courseMetadata = courses.map(c => ({
    id: c.id,
    name: c.name,
    tags: c.tags,
    category: c.category,
    status: c.status,
    videoCount: c.videoCount,
    pdfCount: c.pdfCount,
  }))

  const prompt = `You are an expert learning path advisor. Analyze these courses and suggest an optimal learning sequence based on prerequisite relationships.

Courses:
${JSON.stringify(courseMetadata, null, 2)}

Instructions:
1. Identify prerequisite relationships between courses (e.g., "Python Basics" before "Django Web Development")
2. Order courses from foundational to advanced
3. For each course, provide a 1-2 sentence justification explaining why it's positioned there
4. Output ONLY valid JSON in this exact format:

{
  "learningPath": [
    {
      "courseId": "course-uuid",
      "position": 1,
      "justification": "Foundational course covering basics - start here"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no extra text.`

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('AI request timed out')), timeout)
  })

  // Create fetch promise
  const fetchPromise = fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Lower temperature for more consistent ordering
      max_tokens: 2000,
    }),
    signal,
  })

  try {
    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise])

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `AI provider error (${response.status}): ${
          errorData.error?.message || response.statusText
        }`
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('AI response is empty')
    }

    // Parse LLM response (handle both JSON objects and markdown code blocks)
    let parsed: { learningPath: Array<{ courseId: string; position: number; justification: string }> }

    try {
      // Try to extract JSON from markdown code block if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : content

      parsed = JSON.parse(jsonStr.trim())
    } catch (_parseError) {
      console.error('[generatePath] Failed to parse LLM response:', content)
      throw new Error('AI response is not valid JSON. Please try again.')
    }

    if (!Array.isArray(parsed.learningPath)) {
      throw new Error('AI response format is invalid (missing learningPath array)')
    }

    // Validate and transform response
    const learningPath: LearningPathCourse[] = parsed.learningPath.map((item, index) => {
      // Validate structure
      if (!item.courseId || typeof item.position !== 'number' || !item.justification) {
        throw new Error(`Invalid course data at position ${index}`)
      }

      // Verify courseId exists in input courses
      const courseExists = courses.some(c => c.id === item.courseId)
      if (!courseExists) {
        throw new Error(`AI returned unknown course ID: ${item.courseId}`)
      }

      const course: LearningPathCourse = {
        courseId: item.courseId,
        position: item.position,
        justification: item.justification,
        isManuallyOrdered: false,
        generatedAt: new Date().toISOString(),
      }

      // Stream update to UI
      onUpdate(course)

      return course
    })

    // Ensure all input courses are in the output
    const missingCourses = courses.filter(
      c => !learningPath.some(lp => lp.courseId === c.id)
    )
    if (missingCourses.length > 0) {
      console.warn('[generatePath] AI did not include all courses:', missingCourses)
      // Add missing courses at the end
      missingCourses.forEach((course, index) => {
        const missingCourse: LearningPathCourse = {
          courseId: course.id,
          position: learningPath.length + index + 1,
          justification: 'No specific prerequisites identified - can be studied anytime',
          isManuallyOrdered: false,
          generatedAt: new Date().toISOString(),
        }
        learningPath.push(missingCourse)
        onUpdate(missingCourse)
      })
    }

    return learningPath
  } catch (error) {
    // Handle abort
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Learning path generation was cancelled')
    }

    // Re-throw known errors
    if (error instanceof Error) {
      throw error
    }

    // Unknown error
    throw new Error('Failed to generate learning path. Please try again.')
  }
}
