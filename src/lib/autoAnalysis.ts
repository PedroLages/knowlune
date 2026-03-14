/**
 * Auto-Analysis Service
 *
 * Automatically triggers AI analysis (topic tagging) on newly imported courses.
 * Runs as fire-and-forget after course import — never blocks the import flow.
 *
 * Features:
 * - Background topic tag extraction via AI
 * - Progress tracking via useCourseImportStore.autoAnalysisStatus
 * - 30-second timeout with AbortController
 * - Graceful fallback on failure (course preserved without AI enrichment)
 * - Consent-gated (requires analytics consent enabled)
 */

import { toast } from 'sonner'
import { db } from '@/db'
import {
  isAIAvailable,
  isFeatureEnabled,
  getAIConfiguration,
  getDecryptedApiKey,
  sanitizeAIRequestPayload,
} from '@/lib/aiConfiguration'
import { trackAIUsage } from '@/lib/aiEventTracking'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import type { ImportedCourse } from '@/data/types'

/** Auto-analysis status for a course */
export type AutoAnalysisStatus = 'analyzing' | 'complete' | 'error' | null

const AUTO_ANALYSIS_TIMEOUT_MS = 30_000

/**
 * Triggers auto-analysis on an imported course.
 *
 * This is fire-and-forget — it never throws. Errors are caught, logged,
 * and surfaced via toast + store status.
 */
export function triggerAutoAnalysis(course: ImportedCourse): void {
  // Consent and availability checks
  if (!isFeatureEnabled('analytics') || !isAIAvailable()) return

  // Fire-and-forget with internal error handling
  runAutoAnalysis(course).catch(error => {
    console.error('[AutoAnalysis] Unhandled error:', error)
  })
}

async function runAutoAnalysis(course: ImportedCourse): Promise<void> {
  const store = useCourseImportStore.getState()
  store.setAutoAnalysisStatus(course.id, 'analyzing')

  const startTime = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), AUTO_ANALYSIS_TIMEOUT_MS)

  try {
    const config = getAIConfiguration()
    const apiKey = await getDecryptedApiKey()

    if (!apiKey) {
      throw new Error('API key not configured')
    }

    // Extract topic tags from course name and file structure
    const courseContext = `Course: "${course.name}" with ${course.videoCount} videos and ${course.pdfCount} PDFs`
    const sanitized = sanitizeAIRequestPayload(courseContext)

    const response = await fetch(getEndpoint(config.provider), {
      method: 'POST',
      headers: getHeaders(config.provider, apiKey),
      body: JSON.stringify(buildTagExtractionPayload(config.provider, sanitized.content)),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`AI provider error: ${response.status}`)
    }

    const data = await response.json()
    const tags = parseTagsFromResponse(config.provider, data)

    if (tags.length > 0) {
      // Update course tags in Dexie
      const existingTags = course.tags || []
      const merged = [...new Set([...existingTags, ...tags])]
      await db.importedCourses.update(course.id, { tags: merged })

      // Update Zustand store
      useCourseImportStore.setState(state => ({
        importedCourses: state.importedCourses.map(c =>
          c.id === course.id ? { ...c, tags: merged } : c
        ),
      }))
    }

    store.setAutoAnalysisStatus(course.id, 'complete')

    toast.success(`Auto-analysis complete for "${course.name}"`, {
      description: tags.length > 0 ? `Added ${tags.length} topic tags` : 'No additional tags found',
    })

    trackAIUsage('summary', {
      courseId: course.id,
      durationMs: Date.now() - startTime,
      metadata: { type: 'auto_analysis', tagsGenerated: tags.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    console.error('[AutoAnalysis] Failed:', message)
    store.setAutoAnalysisStatus(course.id, 'error')

    toast.error(
      isTimeout
        ? 'Auto-analysis timed out'
        : 'Auto-analysis could not complete',
      {
        description: 'Course imported successfully without AI enrichment.',
        action: {
          label: 'Retry',
          onClick: () => triggerAutoAnalysis(course),
        },
      }
    )

    trackAIUsage('summary', {
      courseId: course.id,
      status: 'error',
      durationMs: Date.now() - startTime,
      metadata: { type: 'auto_analysis', error: message },
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

// --- Provider-specific helpers ---

function getEndpoint(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages'
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions'
    case 'glm':
      return 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
    default:
      return 'https://api.openai.com/v1/chat/completions'
  }
}

function getHeaders(provider: string, apiKey: string): Record<string, string> {
  if (provider === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

function buildTagExtractionPayload(provider: string, content: string): unknown {
  const prompt = `Extract 3-5 topic tags for this course. Return ONLY a JSON array of lowercase strings, no other text.\n\n${content}`

  if (provider === 'anthropic') {
    return {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    }
  }
  if (provider === 'gemini') {
    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 100 },
    }
  }
  // OpenAI-compatible (openai, groq, glm)
  return {
    model: provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'glm' ? 'glm-4-flash' : 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
  }
}

function parseTagsFromResponse(provider: string, data: unknown): string[] {
  try {
    let text: string

    if (provider === 'anthropic') {
      text = (data as { content: Array<{ text: string }> }).content?.[0]?.text ?? ''
    } else if (provider === 'gemini') {
      text =
        (data as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> })
          .candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    } else {
      text =
        (data as { choices: Array<{ message: { content: string } }> }).choices?.[0]?.message
          ?.content ?? ''
    }

    // Extract JSON array from response (may be wrapped in markdown code block)
    const match = text.match(/\[[\s\S]*?\]/)
    if (!match) return []

    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((t): t is string => typeof t === 'string')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5)
  } catch {
    return []
  }
}
