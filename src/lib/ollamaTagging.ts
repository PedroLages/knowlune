/**
 * Ollama Tagging Orchestrator
 *
 * Fire-and-forget integration between course import and the courseTagger module.
 * Handles status tracking, tag persistence, and user notifications.
 *
 * Called after import completes (Step 10 in courseImport.ts). Never blocks import.
 */

import { toast } from 'sonner'
import { db } from '@/db'
import { generateCourseTags, isOllamaTaggingAvailable } from '@/ai/courseTagger'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import type { ImportedCourse, ImportedVideo, ImportedPdf } from '@/data/types'

/**
 * Simple promise queue with concurrency control.
 * Ollama processes inference sequentially, so concurrent requests would timeout.
 * Concurrency of 1 ensures requests are processed one at a time.
 */
class PromiseQueue {
  private concurrency: number
  private running = 0
  private queue: (() => void)[] = []

  constructor(concurrency: number) {
    this.concurrency = concurrency
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for a slot to open up
    if (this.running >= this.concurrency) {
      await new Promise<void>(resolve => this.queue.push(resolve))
    }

    this.running++
    try {
      return await fn()
    } finally {
      this.running--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

/** Singleton queue — concurrency 1 since Ollama processes inference sequentially */
const taggingQueue = new PromiseQueue(1)

/**
 * Trigger Ollama-based auto-tagging for an imported course.
 *
 * Fire-and-forget — never throws. Errors are caught, logged, and shown as toasts.
 * Skips silently if Ollama is not configured (AC4: graceful degradation).
 *
 * @param course - The newly imported course record
 * @param videos - Video files from the import (used for file name context)
 * @param pdfs - PDF files from the import (used for file name context)
 */
export function triggerOllamaTagging(
  course: ImportedCourse,
  videos: ImportedVideo[],
  pdfs: ImportedPdf[]
): void {
  if (!isOllamaTaggingAvailable()) return

  taggingQueue
    .add(() => runOllamaTagging(course, videos, pdfs))
    .catch(error => {
      console.error('[OllamaTagging] Unhandled error:', error)
    })
}

async function runOllamaTagging(
  course: ImportedCourse,
  videos: ImportedVideo[],
  pdfs: ImportedPdf[]
): Promise<void> {
  const store = useCourseImportStore.getState()
  store.setAutoAnalysisStatus(course.id, 'analyzing')

  try {
    const fileNames = [...videos.map(v => v.filename), ...pdfs.map(p => p.filename)]

    const result = await generateCourseTags({
      title: course.name,
      fileNames,
    })

    if (result.tags.length > 0) {
      // Read fresh tags from IndexedDB to avoid race with concurrent triggerAutoAnalysis
      const freshCourse = await db.importedCourses.get(course.id)
      const existingTags = freshCourse?.tags || []
      const merged = [...new Set([...existingTags, ...result.tags])]

      // Persist to IndexedDB
      await db.importedCourses.update(course.id, { tags: merged })

      // Update Zustand store
      useCourseImportStore.setState(state => ({
        importedCourses: state.importedCourses.map(c =>
          c.id === course.id ? { ...c, tags: merged } : c
        ),
      }))

      toast.success(`Added ${result.tags.length} topic tags to "${course.name}"`)
    }

    store.setAutoAnalysisStatus(course.id, 'complete')

    // Clean up status entry after UI has time to react
    setTimeout(() => {
      useCourseImportStore.setState(state => {
        const { [course.id]: _, ...rest } = state.autoAnalysisStatus
        return { autoAnalysisStatus: rest }
      })
    }, 5000)
  } catch (error) {
    console.error('[OllamaTagging] Failed:', error)
    store.setAutoAnalysisStatus(course.id, 'error')

    toast.error('Auto-tagging could not complete', {
      description: 'Course imported successfully without AI tags.',
    })
  }
}
