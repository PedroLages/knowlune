/**
 * Course Embedding Service (E52-S04)
 *
 * Generates and manages course-level embeddings for recommendation.
 * Uses the same all-MiniLM-L6-v2 model (384 dimensions) as note embeddings.
 *
 * Key behaviors:
 * - Non-blocking: embedding failures never block course import
 * - Cache-aware: SHA-256 sourceHash skips regeneration when metadata unchanged
 * - Backfill: on startup, generates embeddings for courses that lack them
 */

import { generateEmbeddings } from './workers/coordinator'
import { db } from '@/db'
import type { ImportedCourse, CourseEmbedding } from '@/data/types'
import { isGranted, CONSENT_PURPOSES } from '@/lib/compliance/consentService'
import { useAuthStore } from '@/stores/useAuthStore'

// ============================================================================
// Source Hash (SHA-256 of metadata for change detection)
// ============================================================================

/**
 * Compute SHA-256 hash of course metadata used for embedding input.
 * When this hash changes, the embedding needs regeneration.
 */
export async function computeSourceHash(course: ImportedCourse): Promise<string> {
  const text = buildMetadataText(course)
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build the metadata text that becomes the embedding input.
 * Format: "title description tag1, tag2, tag3"
 */
export function buildMetadataText(course: ImportedCourse): string {
  const parts = [course.name]
  if (course.description) parts.push(course.description)
  if (course.tags.length > 0) parts.push(course.tags.join(', '))
  return parts.join(' ')
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate and store a course embedding. Non-blocking — caller should
 * wrap in try/catch and treat failure as non-fatal.
 *
 * Returns the CourseEmbedding if successful, null if skipped (unchanged hash).
 */
export async function computeCourseEmbedding(
  course: ImportedCourse
): Promise<CourseEmbedding | null> {
  const sourceHash = await computeSourceHash(course)

  // Check if existing embedding is still valid (same hash)
  const existing = await db.courseEmbeddings.get(course.id)
  if (existing && existing.sourceHash === sourceHash) {
    return null // No change needed
  }

  const text = buildMetadataText(course)
  const [embeddingVector] = await generateEmbeddings([text])

  const courseEmbedding: CourseEmbedding = {
    courseId: course.id,
    embedding: Array.from(embeddingVector),
    generatedAt: new Date().toISOString(),
    sourceHash,
  }

  await db.courseEmbeddings.put(courseEmbedding)
  return courseEmbedding
}

// ============================================================================
// Course Import Hook (non-blocking, fire-and-forget)
// ============================================================================

/**
 * Generate course embedding after import. Non-blocking: logs errors
 * but never throws. Missing embeddings fall back to tag-based matching.
 */
export async function generateCourseEmbeddingAfterImport(course: ImportedCourse): Promise<void> {
  // Consent guard (E119-S08): skip embedding if ai_embeddings consent not granted.
  const userId = useAuthStore.getState().user?.id
  if (userId) {
    const granted = await isGranted(userId, CONSENT_PURPOSES.AI_EMBEDDINGS)
    if (!granted) {
      console.info(
        '[CourseEmbedding] Skipping embedding for course',
        course.id,
        ': ai_embeddings consent not granted.',
      )
      return
    }
  } else {
    return
  }
  try {
    await computeCourseEmbedding(course)
  } catch (error) {
    console.error('[CourseEmbedding] Failed to generate embedding for course:', course.id, error)
    // Non-blocking: course import already succeeded.
    // Missing embedding logged for future retry via backfill.
  }
}

// ============================================================================
// Metadata Change Detection
// ============================================================================

/**
 * Check if a course's metadata has changed and regenerate embedding if needed.
 * Call after tag updates or description edits.
 */
export async function refreshCourseEmbeddingIfChanged(
  course: ImportedCourse
): Promise<CourseEmbedding | null> {
  try {
    return await computeCourseEmbedding(course)
  } catch (error) {
    console.error('[CourseEmbedding] Failed to refresh embedding for course:', course.id, error)
    return null
  }
}

// ============================================================================
// Backfill (startup — generate embeddings for courses without them)
// ============================================================================

/**
 * Scan all imported courses and generate embeddings for any that lack them.
 * Processes sequentially to avoid overwhelming the Web Worker.
 */
export async function backfillCourseEmbeddings(): Promise<{
  processed: number
  failed: number
}> {
  let processed = 0
  let failed = 0

  try {
    const allCourses = await db.importedCourses.toArray()
    const existingEmbeddings = await db.courseEmbeddings.toArray()
    const embeddedCourseIds = new Set(existingEmbeddings.map(e => e.courseId))

    const missing = allCourses.filter(c => !embeddedCourseIds.has(c.id))

    for (const course of missing) {
      try {
        await computeCourseEmbedding(course)
        processed++
      } catch (error) {
        console.error('[CourseEmbedding] Backfill failed for course:', course.id, error)
        failed++
      }
    }
  } catch (error) {
    console.error('[CourseEmbedding] Backfill scan failed:', error)
  }

  if (processed > 0 || failed > 0) {
    console.info(`[CourseEmbedding] Backfill complete: ${processed} generated, ${failed} failed`)
  }

  return { processed, failed }
}
