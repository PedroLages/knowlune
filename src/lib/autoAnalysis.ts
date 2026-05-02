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
import { apiUrl } from '@/lib/apiBaseUrl'
import { trackAIUsage } from '@/lib/aiEventTracking'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import type { ImportedCourse } from '@/data/types'

/** Local proxy endpoint for non-streaming completions */
const PROXY_GENERATE_URL = apiUrl('ai-generate')

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

    const prompt = `Extract 3-5 topic tags for this course. Return ONLY a JSON array of lowercase strings, no other text.\n\n${sanitized.content}`

    const response = await fetch(PROXY_GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        apiKey,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 100,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `AI provider error (${response.status}): ${(errorData as { error?: string }).error || response.statusText}`
      )
    }

    const data = await response.json()
    const tags = parseTagsFromProxyResponse((data as { text: string }).text)

    if (tags.length > 0) {
      // Read fresh tags from IndexedDB to avoid race with concurrent triggerOllamaTagging
      const freshCourse = await db.importedCourses.get(course.id)
      const existingTags = freshCourse?.tags || []
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

    trackAIUsage('auto_analysis', {
      courseId: course.id,
      durationMs: Date.now() - startTime,
      metadata: { tagsGenerated: tags.length },
    }).catch(() => {})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    console.error('[AutoAnalysis] Failed:', message)
    store.setAutoAnalysisStatus(course.id, 'error')

    toast.error(isTimeout ? 'Auto-analysis timed out' : 'Auto-analysis could not complete', {
      description: 'Course imported successfully without AI enrichment.',
      action: {
        label: 'Retry',
        onClick: () => triggerAutoAnalysis(course),
      },
    })

    trackAIUsage('auto_analysis', {
      courseId: course.id,
      status: 'error',
      durationMs: Date.now() - startTime,
      metadata: { error: message },
    }).catch(() => {})
  } finally {
    clearTimeout(timeoutId)
  }
}

// --- Response parsing ---

/**
 * Parses topic tags from the proxy's unified text response.
 * The proxy returns { text: string } regardless of provider.
 */
function parseTagsFromProxyResponse(text: string | undefined): string[] {
  try {
    if (!text) return []

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
  } catch (error) {
    console.warn('[AutoAnalysis] Failed to parse tags from response:', error)
    return []
  }
}
