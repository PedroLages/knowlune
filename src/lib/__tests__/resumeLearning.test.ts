import { describe, it, expect } from 'vitest'
import { findFirstIncompleteLesson } from '@/lib/resumeLearning'
import type { CompletionStatus, ImportedVideo, ImportedPdf, VideoProgress } from '@/data/types'

function makeVideo(overrides: Partial<ImportedVideo> & { id: string }): ImportedVideo {
  return {
    courseId: 'course-1',
    filename: `${overrides.id}.mp4`,
    path: `/videos/${overrides.id}.mp4`,
    duration: 300,
    format: 'mp4',
    order: 0,
    fileHandle: null,
    ...overrides,
  }
}

function makePdf(overrides: Partial<ImportedPdf> & { id: string }): ImportedPdf {
  return {
    courseId: 'course-1',
    filename: `${overrides.id}.pdf`,
    path: `/pdfs/${overrides.id}.pdf`,
    pageCount: 10,
    fileHandle: {} as FileSystemFileHandle,
    ...overrides,
  }
}

function makeProgress(overrides: Partial<VideoProgress> & { videoId: string }): VideoProgress {
  return {
    courseId: 'course-1',
    currentTime: 0,
    completionPercentage: 0,
    ...overrides,
  }
}

describe('findFirstIncompleteLesson', () => {
  const courseId = 'course-1'

  describe('happy paths', () => {
    it('returns first non-completed video from statusMap', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
        makeVideo({ id: 'v3', order: 3 }),
      ]
      const statusMap: Record<string, CompletionStatus> = {
        'course-1:v1': 'completed',
        'course-1:v2': 'in-progress',
        'course-1:v3': 'not-started',
      }

      const result = findFirstIncompleteLesson(courseId, statusMap, [], videos)
      expect(result).toBe('v2')
    })

    it('falls back to videoProgressList when statusMap has no entries for course', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
        makeVideo({ id: 'v3', order: 3 }),
      ]
      const progressList: VideoProgress[] = [
        makeProgress({ videoId: 'v1', completionPercentage: 100 }),
        makeProgress({ videoId: 'v2', completionPercentage: 30 }),
      ]

      const result = findFirstIncompleteLesson(courseId, {}, progressList, videos)
      expect(result).toBe('v2')
    })

    it('returns first video when both sources are empty', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
      ]

      const result = findFirstIncompleteLesson(courseId, {}, [], videos)
      expect(result).toBe('v1')
    })

    it('respects video order when both sources are empty', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v3', order: 3 }),
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
      ]

      const result = findFirstIncompleteLesson(courseId, {}, [], videos)
      expect(result).toBe('v1')
    })

    it('returns first incomplete when statusMap shows in-progress', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
      ]
      const statusMap: Record<string, CompletionStatus> = {
        'course-1:v1': 'in-progress',
      }

      const result = findFirstIncompleteLesson(courseId, statusMap, [], videos)
      expect(result).toBe('v1')
    })

    it('returns first incomplete when statusMap shows not-started', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
      ]
      const statusMap: Record<string, CompletionStatus> = {
        'course-1:v1': 'not-started',
      }

      const result = findFirstIncompleteLesson(courseId, statusMap, [], videos)
      expect(result).toBe('v1')
    })
  })

  describe('edge cases', () => {
    it('returns null when all videos are completed in statusMap', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
      ]
      const statusMap: Record<string, CompletionStatus> = {
        'course-1:v1': 'completed',
        'course-1:v2': 'completed',
      }

      const result = findFirstIncompleteLesson(courseId, statusMap, [], videos)
      expect(result).toBeNull()
    })

    it('returns first PDF by filename order when course has no videos', () => {
      const pdfs: ImportedPdf[] = [
        makePdf({ id: 'p2', filename: 'b.pdf' }),
        makePdf({ id: 'p1', filename: 'a.pdf' }),
      ]

      const result = findFirstIncompleteLesson(courseId, {}, [], [], pdfs)
      expect(result).toBe('p1')
    })

    it('returns null when course has no lessons at all', () => {
      const result = findFirstIncompleteLesson(courseId, {}, [], [], [])
      expect(result).toBeNull()
    })

    it('handles PDF with statusMap entry correctly', () => {
      const pdfs: ImportedPdf[] = [
        makePdf({ id: 'p1', filename: 'a.pdf' }),
        makePdf({ id: 'p2', filename: 'b.pdf' }),
      ]
      const statusMap: Record<string, CompletionStatus> = {
        'course-1:p1': 'completed',
      }

      const result = findFirstIncompleteLesson(courseId, statusMap, [], [], pdfs)
      expect(result).toBe('p2')
    })

    it('returns null when all PDFs are completed in statusMap', () => {
      const pdfs: ImportedPdf[] = [makePdf({ id: 'p1', filename: 'a.pdf' })]
      const statusMap: Record<string, CompletionStatus> = {
        'course-1:p1': 'completed',
      }

      const result = findFirstIncompleteLesson(courseId, statusMap, [], [], pdfs)
      expect(result).toBeNull()
    })

    it('uses statusMap over legacy progress when both exist for same video', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
      ]
      // statusMap says v1 is NOT completed
      const statusMap: Record<string, CompletionStatus> = {
        'course-1:v1': 'not-started',
      }
      // But legacy says v1 IS completed (100%)
      const progressList: VideoProgress[] = [
        makeProgress({ videoId: 'v1', completionPercentage: 100 }),
      ]

      // statusMap should take priority — v1 is not-started, so it's the incomplete lesson
      const result = findFirstIncompleteLesson(courseId, statusMap, progressList, videos)
      expect(result).toBe('v1')
    })

    it('skips statusMap completed videos and checks legacy for remaining', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
        makeVideo({ id: 'v3', order: 3 }),
      ]
      // v1 is completed in statusMap, v2/v3 have no statusMap entry
      const statusMap: Record<string, CompletionStatus> = {
        'course-1:v1': 'completed',
      }
      // v2 has legacy progress at 100%, v3 has no legacy progress
      const progressList: VideoProgress[] = [
        makeProgress({ videoId: 'v2', completionPercentage: 100 }),
      ]

      // v1 completed in statusMap, v2 completed in legacy, v3 has no progress → v3 is incomplete
      const result = findFirstIncompleteLesson(courseId, statusMap, progressList, videos)
      expect(result).toBe('v3')
    })

    it('returns null when all videos are completed via mixed sources', () => {
      const videos: ImportedVideo[] = [
        makeVideo({ id: 'v1', order: 1 }),
        makeVideo({ id: 'v2', order: 2 }),
      ]
      const statusMap: Record<string, CompletionStatus> = {
        'course-1:v1': 'completed',
      }
      const progressList: VideoProgress[] = [
        makeProgress({ videoId: 'v2', completionPercentage: 95 }),
      ]

      // v1 completed in statusMap, v2 completed in legacy (>= 90)
      const result = findFirstIncompleteLesson(courseId, statusMap, progressList, videos)
      expect(result).toBeNull()
    })
  })
})
