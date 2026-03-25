/**
 * Unit Tests: ollamaTagging.ts
 *
 * Tests the Ollama tagging orchestrator that bridges course import and courseTagger.
 * Covers: success path, error path, skip path, and empty tags path.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { FIXED_DATE } from '../../../tests/utils/test-time'
import type { ImportedCourse, ImportedVideo, ImportedPdf } from '@/data/types'

// --- Mocks (before imports) ---

vi.mock('@/stores/useCourseImportStore', () => {
  const setAutoAnalysisStatus = vi.fn()
  const setState = vi.fn()
  return {
    useCourseImportStore: {
      getState: () => ({
        setAutoAnalysisStatus,
        importedCourses: [],
      }),
      setState,
    },
  }
})

vi.mock('@/db', () => ({
  db: {
    importedCourses: {
      get: vi.fn(async () => ({ tags: ['existing-tag'] })),
      update: vi.fn(async () => 1),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/ai/courseTagger', () => ({
  generateCourseTags: vi.fn(),
  isOllamaTaggingAvailable: vi.fn(),
}))

// --- Import SUT + mocked modules ---
import { triggerOllamaTagging } from '../ollamaTagging'
import { db } from '@/db'
import { toast } from 'sonner'
import { generateCourseTags, isOllamaTaggingAvailable } from '@/ai/courseTagger'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

// --- Test data ---

const mockCourse: ImportedCourse = {
  id: 'course-1',
  name: 'Introduction to Machine Learning',
  importedAt: FIXED_DATE,
  category: 'research-library',
  tags: ['existing-tag'],
  status: 'active',
  videoCount: 2,
  pdfCount: 1,
  directoryHandle: {} as FileSystemDirectoryHandle,
}

const mockVideos: ImportedVideo[] = [
  {
    id: 'v1',
    courseId: 'course-1',
    filename: 'intro.mp4',
    path: '/intro.mp4',
    duration: 300,
    format: 'mp4',
    order: 0,
    fileHandle: {} as FileSystemFileHandle,
  },
]

const mockPdfs: ImportedPdf[] = [
  {
    id: 'p1',
    courseId: 'course-1',
    filename: 'slides.pdf',
    path: '/slides.pdf',
    pageCount: 20,
    fileHandle: {} as FileSystemFileHandle,
  },
]

// Helper to get store mock functions
function getSetStatusMock(): Mock {
  return useCourseImportStore.getState().setAutoAnalysisStatus as Mock
}

function getSetStateMock(): Mock {
  return useCourseImportStore.setState as Mock
}

describe('ollamaTagging.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('skip path — Ollama not configured', () => {
    it('returns immediately without calling AI when Ollama is not available', () => {
      ;(isOllamaTaggingAvailable as Mock).mockReturnValue(false)

      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)

      expect(generateCourseTags).not.toHaveBeenCalled()
      expect(getSetStatusMock()).not.toHaveBeenCalled()
    })
  })

  describe('success path — tags returned and stored', () => {
    beforeEach(() => {
      ;(isOllamaTaggingAvailable as Mock).mockReturnValue(true)
      ;(generateCourseTags as Mock).mockResolvedValue({
        tags: ['machine learning', 'python'],
      })
    })

    it('sets status to analyzing then complete', async () => {
      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      const setStatus = getSetStatusMock()
      expect(setStatus).toHaveBeenCalledWith('course-1', 'analyzing')
      expect(setStatus).toHaveBeenCalledWith('course-1', 'complete')
    })

    it('calls generateCourseTags with course title and file names', async () => {
      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      expect(generateCourseTags).toHaveBeenCalledWith({
        title: 'Introduction to Machine Learning',
        fileNames: ['intro.mp4', 'slides.pdf'],
      })
    })

    it('merges new tags with existing IDB tags and persists to IndexedDB', async () => {
      ;(db.importedCourses.get as Mock).mockResolvedValue({ tags: ['existing-tag'] })

      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      expect(db.importedCourses.get).toHaveBeenCalledWith('course-1')
      expect(db.importedCourses.update).toHaveBeenCalledWith('course-1', {
        tags: expect.arrayContaining(['existing-tag', 'machine learning', 'python']),
      })
    })

    it('updates Zustand store with merged tags', async () => {
      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      expect(getSetStateMock()).toHaveBeenCalled()
    })

    it('shows success toast with tag count', async () => {
      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      expect(toast.success).toHaveBeenCalledWith(
        'Added 2 topic tags to "Introduction to Machine Learning"'
      )
    })

    it('cleans up status entry after delay', async () => {
      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      // The setTimeout(5000) cleanup should have fired
      const setStateCalls = getSetStateMock().mock.calls
      // Last setState call should be the cleanup (removes status entry)
      expect(setStateCalls.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('error path — tagging fails', () => {
    it('sets status to error when generateCourseTags rejects', async () => {
      ;(isOllamaTaggingAvailable as Mock).mockReturnValue(true)
      ;(generateCourseTags as Mock).mockRejectedValue(new Error('Connection refused'))

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      const setStatus = getSetStatusMock()
      expect(setStatus).toHaveBeenCalledWith('course-1', 'analyzing')
      expect(setStatus).toHaveBeenCalledWith('course-1', 'error')

      consoleErrorSpy.mockRestore()
    })

    it('shows error toast when tagging fails', async () => {
      ;(isOllamaTaggingAvailable as Mock).mockReturnValue(true)
      ;(generateCourseTags as Mock).mockRejectedValue(new Error('Network error'))

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      expect(toast.error).toHaveBeenCalledWith('Auto-tagging could not complete', {
        description: 'Course imported successfully without AI tags.',
      })

      consoleErrorSpy.mockRestore()
    })

    it('does not update IndexedDB or Zustand when tagging fails', async () => {
      ;(isOllamaTaggingAvailable as Mock).mockReturnValue(true)
      ;(generateCourseTags as Mock).mockRejectedValue(new Error('Timeout'))

      vi.spyOn(console, 'error').mockImplementation(() => {})

      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      expect(db.importedCourses.update).not.toHaveBeenCalled()
      expect(getSetStateMock()).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('empty tags path — AI returns empty array', () => {
    it('sets status to complete without updating DB when tags are empty', async () => {
      ;(isOllamaTaggingAvailable as Mock).mockReturnValue(true)
      ;(generateCourseTags as Mock).mockResolvedValue({ tags: [] })

      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      const setStatus = getSetStatusMock()
      expect(setStatus).toHaveBeenCalledWith('course-1', 'analyzing')
      expect(setStatus).toHaveBeenCalledWith('course-1', 'complete')

      // No DB update when no tags returned
      expect(db.importedCourses.update).not.toHaveBeenCalled()
    })

    it('does not show success toast when no tags are returned', async () => {
      ;(isOllamaTaggingAvailable as Mock).mockReturnValue(true)
      ;(generateCourseTags as Mock).mockResolvedValue({ tags: [] })

      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      expect(toast.success).not.toHaveBeenCalled()
    })

    it('cleans up status entry after delay even with empty tags', async () => {
      ;(isOllamaTaggingAvailable as Mock).mockReturnValue(true)
      ;(generateCourseTags as Mock).mockResolvedValue({ tags: [] })

      triggerOllamaTagging(mockCourse, mockVideos, mockPdfs)
      await vi.runAllTimersAsync()

      // The setTimeout cleanup should still fire
      const setStateCalls = getSetStateMock().mock.calls
      expect(setStateCalls.length).toBeGreaterThanOrEqual(1)
    })
  })
})
