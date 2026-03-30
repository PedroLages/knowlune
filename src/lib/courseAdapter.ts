/**
 * Course Adapter Layer (E89-S02)
 *
 * Provides source-agnostic access to course data via the adapter pattern.
 * Unified page components consume CourseAdapter instead of branching on
 * `course.source` directly.
 *
 * Architecture: docs/planning-artifacts/bmad-architecture-course-unification-ai-models.md § A1
 */

import type { ImportedCourse, ImportedVideo, ImportedPdf, CourseSource } from '@/data/types'
import { db } from '@/db'

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Revoke a blob URL previously created by `getMediaUrl()` or `getThumbnailUrl()`.
 * Callers MUST call this when they no longer need the URL (e.g., on component
 * unmount) to avoid memory leaks from unreleased object URLs.
 */
export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LessonItem {
  id: string
  title: string
  type: 'video' | 'pdf'
  duration?: number
  order: number
  sourceMetadata?: Record<string, unknown>
}

export interface ContentCapabilities {
  hasVideo: boolean
  hasPdf: boolean
  hasTranscript: boolean
  supportsNotes: boolean
  supportsQuiz: boolean
  supportsPrevNext: boolean
  supportsBreadcrumbs: boolean
}

export interface CourseAdapter {
  getCourse(): ImportedCourse
  getSource(): CourseSource
  getLessons(): Promise<LessonItem[]>
  getMediaUrl(lessonId: string): Promise<string | null>
  getTranscript(lessonId: string): Promise<string | null>
  getThumbnailUrl(): Promise<string | null>
  getCapabilities(): ContentCapabilities
}

// ---------------------------------------------------------------------------
// LocalCourseAdapter
// ---------------------------------------------------------------------------

export class LocalCourseAdapter implements CourseAdapter {
  constructor(
    private course: ImportedCourse,
    private videos: ImportedVideo[],
    private pdfs: ImportedPdf[]
  ) {}

  getCourse(): ImportedCourse {
    return this.course
  }

  getSource(): CourseSource {
    return 'local'
  }

  async getLessons(): Promise<LessonItem[]> {
    const videoLessons: LessonItem[] = this.videos.map(v => ({
      id: v.id,
      title: v.filename,
      type: 'video' as const,
      duration: v.duration,
      order: v.order,
      sourceMetadata: {
        path: v.path,
        format: v.format,
        fileSize: v.fileSize,
        width: v.width,
        height: v.height,
        description: v.description,
        chapters: v.chapters,
      },
    }))

    const pdfLessons: LessonItem[] = this.pdfs.map(p => ({
      id: p.id,
      title: p.filename,
      type: 'pdf' as const,
      duration: undefined,
      // Known limitation: ImportedPdf has no `order` field, so we use pageCount
      // as a rough proxy. This is adequate for MVP but may produce unexpected
      // ordering for multi-PDF courses. Deferred to S04/S06 where explicit PDF
      // ordering will be added via a Dexie migration.
      order: p.pageCount,
      sourceMetadata: {
        path: p.path,
        pageCount: p.pageCount,
      },
    }))

    // Combine and sort by order, then by title for stable ordering
    return [...videoLessons, ...pdfLessons].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.title.localeCompare(b.title)
    })
  }

  /**
   * Returns a blob URL for the lesson's media file.
   * **Callers must call `revokeObjectUrl()` when the URL is no longer needed**
   * to prevent memory leaks from unreleased blob URLs.
   */
  async getMediaUrl(lessonId: string): Promise<string | null> {
    // Check videos first
    const video = this.videos.find(v => v.id === lessonId)
    if (video?.fileHandle) {
      try {
        const permission = await video.fileHandle.queryPermission({
          mode: 'read',
        })
        if (permission !== 'granted') {
          const result = await video.fileHandle.requestPermission({
            mode: 'read',
          })
          if (result !== 'granted') return null
        }
        const file = await video.fileHandle.getFile()
        return URL.createObjectURL(file)
      } catch {
        // silent-catch-ok — caller handles null as error state
        return null
      }
    }

    // Check PDFs
    const pdf = this.pdfs.find(p => p.id === lessonId)
    if (pdf?.fileHandle) {
      try {
        const permission = await pdf.fileHandle.queryPermission({
          mode: 'read',
        })
        if (permission !== 'granted') {
          const result = await pdf.fileHandle.requestPermission({
            mode: 'read',
          })
          if (result !== 'granted') return null
        }
        const file = await pdf.fileHandle.getFile()
        return URL.createObjectURL(file)
      } catch {
        // silent-catch-ok — caller handles null as error state
        return null
      }
    }

    return null
  }

  async getTranscript(lessonId: string): Promise<string | null> {
    // Local transcripts come from VideoCaptionRecord in Dexie
    const caption = await db.videoCaptions
      .where('[courseId+videoId]')
      .equals([this.course.id, lessonId])
      .first()
    return caption?.content ?? null
  }

  /**
   * Returns a blob URL for the course thumbnail.
   * **Callers must call `revokeObjectUrl()` when the URL is no longer needed**
   * to prevent memory leaks from unreleased blob URLs.
   */
  async getThumbnailUrl(): Promise<string | null> {
    // Local courses may have a cover image file handle
    if (this.course.coverImageHandle) {
      try {
        const file = await this.course.coverImageHandle.getFile()
        return URL.createObjectURL(file)
      } catch {
        // silent-catch-ok — thumbnail is non-critical
        return null
      }
    }

    // Fall back to stored thumbnail blob
    const thumb = await db.courseThumbnails.get(this.course.id)
    if (thumb?.blob) {
      return URL.createObjectURL(thumb.blob)
    }

    return null
  }

  getCapabilities(): ContentCapabilities {
    return {
      hasVideo: this.videos.length > 0,
      hasPdf: this.pdfs.length > 0,
      hasTranscript: true, // Local courses can have caption files
      supportsNotes: true,
      supportsQuiz: true,
      supportsPrevNext: true,
      supportsBreadcrumbs: true,
    }
  }
}

// ---------------------------------------------------------------------------
// YouTubeCourseAdapter
// ---------------------------------------------------------------------------

export class YouTubeCourseAdapter implements CourseAdapter {
  constructor(
    private course: ImportedCourse,
    private videos: ImportedVideo[]
  ) {}

  getCourse(): ImportedCourse {
    return this.course
  }

  getSource(): CourseSource {
    return 'youtube'
  }

  async getLessons(): Promise<LessonItem[]> {
    return this.videos
      .map(v => ({
        id: v.id,
        title: v.filename,
        type: 'video' as const,
        duration: v.duration,
        order: v.order,
        sourceMetadata: {
          youtubeVideoId: v.youtubeVideoId,
          youtubeUrl: v.youtubeUrl,
          thumbnailUrl: v.thumbnailUrl,
          description: v.description,
          chapters: v.chapters,
          removedFromYouTube: v.removedFromYouTube,
        },
      }))
      .sort((a, b) => a.order - b.order)
  }

  async getMediaUrl(lessonId: string): Promise<string | null> {
    const video = this.videos.find(v => v.id === lessonId)
    if (!video?.youtubeVideoId) return null
    return `https://www.youtube.com/embed/${video.youtubeVideoId}`
  }

  async getTranscript(lessonId: string): Promise<string | null> {
    const video = this.videos.find(v => v.id === lessonId)
    if (!video?.youtubeVideoId) return null

    // YouTube transcripts stored in youtubeTranscripts table
    const transcript = await db.youtubeTranscripts
      .where('[courseId+videoId]')
      .equals([this.course.id, video.youtubeVideoId])
      .first()

    if (transcript?.status === 'done' && transcript.fullText) {
      return transcript.fullText
    }

    return null
  }

  /**
   * Returns a thumbnail URL for the course. Prefers the YouTube-hosted URL;
   * falls back to a blob URL from stored thumbnail data.
   * **If a blob URL is returned (no `youtubeThumbnailUrl`), callers must call
   * `revokeObjectUrl()` when done to prevent memory leaks.**
   */
  async getThumbnailUrl(): Promise<string | null> {
    // YouTube courses have a thumbnail URL directly on the course record
    if (this.course.youtubeThumbnailUrl) {
      return this.course.youtubeThumbnailUrl
    }

    // Fall back to stored thumbnail blob
    const thumb = await db.courseThumbnails.get(this.course.id)
    if (thumb?.blob) {
      return URL.createObjectURL(thumb.blob)
    }

    return null
  }

  getCapabilities(): ContentCapabilities {
    return {
      hasVideo: this.videos.length > 0,
      hasPdf: false, // YouTube courses don't have PDFs
      hasTranscript: true, // YouTube transcripts via transcript pipeline
      supportsNotes: true,
      supportsQuiz: true,
      supportsPrevNext: true,
      supportsBreadcrumbs: true,
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate adapter for a course.
 * Pass pre-loaded videos and pdfs to avoid redundant Dexie queries.
 */
export function createCourseAdapter(
  course: ImportedCourse,
  videos: ImportedVideo[],
  pdfs: ImportedPdf[]
): CourseAdapter {
  if (course.source === 'youtube') {
    return new YouTubeCourseAdapter(course, videos)
  }
  // source === 'local' or undefined (backward-compatible)
  return new LocalCourseAdapter(course, videos, pdfs)
}

/**
 * Load course data from Dexie and create the appropriate adapter.
 * Convenience function for non-hook contexts.
 */
export async function loadCourseAdapter(courseId: string): Promise<CourseAdapter | null> {
  const course = await db.importedCourses.get(courseId)
  if (!course) return null

  const videos = await db.importedVideos.where('courseId').equals(courseId).toArray()

  const pdfs = await db.importedPdfs.where('courseId').equals(courseId).toArray()

  return createCourseAdapter(course, videos, pdfs)
}
