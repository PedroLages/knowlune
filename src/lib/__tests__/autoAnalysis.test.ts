/**
 * Unit Tests: autoAnalysis.ts
 *
 * Tests auto-analysis service for AI-driven topic tag extraction on imported courses.
 * Covers: triggerAutoAnalysis, tag parsing, error handling.
 *
 * The source module routes ALL requests through `/api/ai/generate` (local proxy),
 * which returns unified JSON: `{ text: "..." }`.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { FIXED_DATE, FIXED_TIMESTAMP } from '../../../tests/utils/test-time'
import type { ImportedCourse } from '@/data/types'

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

vi.mock('@/lib/aiConfiguration', () => ({
  isFeatureEnabled: vi.fn(),
  isAIAvailable: vi.fn(),
  getAIConfiguration: vi.fn(),
  getDecryptedApiKey: vi.fn(),
  sanitizeAIRequestPayload: vi.fn(),
}))

vi.mock('@/lib/aiEventTracking', () => ({
  trackAIUsage: vi.fn(async () => {}),
}))

// --- Import SUT + mocked modules ---
import { triggerAutoAnalysis } from '../autoAnalysis'
import { db } from '@/db'
import { toast } from 'sonner'
import { trackAIUsage } from '@/lib/aiEventTracking'
import {
  isFeatureEnabled,
  isAIAvailable,
  getAIConfiguration,
  getDecryptedApiKey,
  sanitizeAIRequestPayload,
} from '@/lib/aiConfiguration'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

// --- Test data ---

const mockCourse: ImportedCourse = {
  id: 'course-1',
  name: 'Introduction to Machine Learning',
  importedAt: FIXED_DATE,
  category: 'research-library',
  tags: ['existing-tag'],
  status: 'active',
  videoCount: 5,
  pdfCount: 2,
  directoryHandle: {} as FileSystemDirectoryHandle,
}

// Helper to get the store's setAutoAnalysisStatus mock
function getSetStatusMock(): Mock {
  return useCourseImportStore.getState().setAutoAnalysisStatus as Mock
}

/**
 * Helper: builds a mock proxy response for /api/ai/generate
 * The proxy returns `{ text: "..." }` regardless of provider.
 */
function mockProxyResponse(text: string, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => ({ text }),
  }
}

describe('autoAnalysis.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TIMESTAMP)
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('triggerAutoAnalysis', () => {
    it('does nothing when analytics feature is disabled', () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(false)
      ;(isAIAvailable as Mock).mockReturnValue(true)

      triggerAutoAnalysis(mockCourse)

      expect(getSetStatusMock()).not.toHaveBeenCalled()
    })

    it('does nothing when AI is not available', () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(false)

      triggerAutoAnalysis(mockCourse)

      expect(getSetStatusMock()).not.toHaveBeenCalled()
    })

    it('sets status to analyzing and complete on success', async () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue('sk-test-key')
      ;(sanitizeAIRequestPayload as Mock).mockReturnValue({ content: 'sanitized content' })
      ;(global.fetch as Mock).mockResolvedValue(
        mockProxyResponse('["machine learning", "ai", "deep learning"]')
      )

      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      const setStatus = getSetStatusMock()
      expect(setStatus).toHaveBeenCalledWith('course-1', 'analyzing')
      expect(setStatus).toHaveBeenCalledWith('course-1', 'complete')
    })

    it('merges new tags with existing tags and updates DB', async () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue('sk-test-key')
      ;(sanitizeAIRequestPayload as Mock).mockReturnValue({ content: 'sanitized' })
      ;(global.fetch as Mock).mockResolvedValue(
        mockProxyResponse('["machine learning", "existing-tag"]')
      )

      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      expect(db.importedCourses.update).toHaveBeenCalledWith('course-1', {
        tags: ['existing-tag', 'machine learning'],
      })
    })

    it('shows success toast with tag count', async () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue('sk-test-key')
      ;(sanitizeAIRequestPayload as Mock).mockReturnValue({ content: 'sanitized' })
      ;(global.fetch as Mock).mockResolvedValue(mockProxyResponse('["tag1", "tag2"]'))

      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      expect(toast.success).toHaveBeenCalledWith(
        'Auto-analysis complete for "Introduction to Machine Learning"',
        expect.objectContaining({ description: expect.stringContaining('2 topic tags') })
      )
    })

    it('shows "no additional tags" when AI returns empty tags', async () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue('sk-test-key')
      ;(sanitizeAIRequestPayload as Mock).mockReturnValue({ content: 'sanitized' })
      ;(global.fetch as Mock).mockResolvedValue(mockProxyResponse('no tags here'))

      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      expect(toast.success).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ description: 'No additional tags found' })
      )
    })

    it('tracks AI usage on success', async () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue('sk-test-key')
      ;(sanitizeAIRequestPayload as Mock).mockReturnValue({ content: 'sanitized' })
      ;(global.fetch as Mock).mockResolvedValue(mockProxyResponse('["tag1"]'))

      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      expect(trackAIUsage).toHaveBeenCalledWith(
        'auto_analysis',
        expect.objectContaining({
          courseId: 'course-1',
          durationMs: expect.any(Number),
          metadata: { tagsGenerated: 1 },
        })
      )
    })

    it('handles API key not configured error', async () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue(null)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      expect(getSetStatusMock()).toHaveBeenCalledWith('course-1', 'error')
      expect(toast.error).toHaveBeenCalledWith(
        'Auto-analysis could not complete',
        expect.objectContaining({
          description: 'Course imported successfully without AI enrichment.',
        })
      )

      consoleErrorSpy.mockRestore()
    })

    it('handles HTTP error response from AI provider', async () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue('sk-test-key')
      ;(sanitizeAIRequestPayload as Mock).mockReturnValue({ content: 'sanitized' })

      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: 'Rate limit exceeded' }),
      }
      ;(global.fetch as Mock).mockResolvedValue(mockResponse)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      expect(getSetStatusMock()).toHaveBeenCalledWith('course-1', 'error')
      expect(toast.error).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('handles abort/timeout error with specific message', async () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue('sk-test-key')
      ;(sanitizeAIRequestPayload as Mock).mockReturnValue({ content: 'sanitized' })

      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      ;(global.fetch as Mock).mockRejectedValue(abortError)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      expect(toast.error).toHaveBeenCalledWith('Auto-analysis timed out', expect.any(Object))

      consoleErrorSpy.mockRestore()
    })

    it('tracks AI usage on error', async () => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue(null)

      vi.spyOn(console, 'error').mockImplementation(() => {})

      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      expect(trackAIUsage).toHaveBeenCalledWith(
        'auto_analysis',
        expect.objectContaining({
          courseId: 'course-1',
          status: 'error',
          metadata: { error: 'API key not configured' },
        })
      )

      vi.restoreAllMocks()
    })
  })

  describe('proxy endpoint and payload', () => {
    const setupProvider = (provider: string) => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider })
      ;(getDecryptedApiKey as Mock).mockResolvedValue('test-key')
      ;(sanitizeAIRequestPayload as Mock).mockReturnValue({ content: 'test' })
      ;(global.fetch as Mock).mockResolvedValue(mockProxyResponse('["tag"]'))
    }

    it('always calls /api/ai/generate regardless of provider', async () => {
      for (const provider of ['openai', 'anthropic', 'groq', 'glm', 'gemini']) {
        vi.clearAllMocks()
        setupProvider(provider)
        triggerAutoAnalysis(mockCourse)
        await vi.runAllTimersAsync()
        expect(global.fetch).toHaveBeenCalledWith('/api/ai/generate', expect.any(Object))
      }
    })

    it('sends Content-Type application/json header', async () => {
      setupProvider('openai')
      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      const fetchCall = (global.fetch as Mock).mock.calls[0]
      const headers = fetchCall?.[1]?.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('sends provider and apiKey in body', async () => {
      setupProvider('anthropic')
      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      const fetchCall = (global.fetch as Mock).mock.calls[0]
      const body = JSON.parse(fetchCall?.[1]?.body as string)
      expect(body.provider).toBe('anthropic')
      expect(body.apiKey).toBe('test-key')
    })

    it('sends messages array and maxTokens in body', async () => {
      setupProvider('openai')
      triggerAutoAnalysis(mockCourse)
      await vi.runAllTimersAsync()

      const fetchCall = (global.fetch as Mock).mock.calls[0]
      const body = JSON.parse(fetchCall?.[1]?.body as string)
      expect(body.messages).toBeDefined()
      expect(Array.isArray(body.messages)).toBe(true)
      expect(body.maxTokens).toBe(100)
    })
  })

  describe('tag parsing from proxy response', () => {
    const setupAndGetTags = async (responseText: string) => {
      ;(isFeatureEnabled as Mock).mockReturnValue(true)
      ;(isAIAvailable as Mock).mockReturnValue(true)
      ;(getAIConfiguration as Mock).mockReturnValue({ provider: 'openai' })
      ;(getDecryptedApiKey as Mock).mockResolvedValue('test-key')
      ;(sanitizeAIRequestPayload as Mock).mockReturnValue({ content: 'test' })

      const courseNoTags = { ...mockCourse, tags: [] }

      ;(global.fetch as Mock).mockResolvedValue(mockProxyResponse(responseText))

      triggerAutoAnalysis(courseNoTags)
      await vi.runAllTimersAsync()

      const updateCall = (db.importedCourses.update as Mock).mock.calls[0]
      return updateCall?.[1]?.tags as string[] | undefined
    }

    it('parses tags from JSON array string', async () => {
      const tags = await setupAndGetTags('["python", "machine learning", "data science"]')
      expect(tags).toEqual(['python', 'machine learning', 'data science'])
    })

    it('parses tags wrapped in markdown code blocks', async () => {
      const tags = await setupAndGetTags('```json\n["tag1", "tag2"]\n```')
      expect(tags).toEqual(['tag1', 'tag2'])
    })

    it('lowercases and trims tags', async () => {
      const tags = await setupAndGetTags('["  Python ", "Machine Learning  "]')
      expect(tags).toEqual(['python', 'machine learning'])
    })

    it('limits to 5 tags maximum', async () => {
      const tags = await setupAndGetTags('["a", "b", "c", "d", "e", "f", "g"]')
      expect(tags).toHaveLength(5)
    })

    it('filters out non-string values', async () => {
      const tags = await setupAndGetTags('["valid", 123, null, "also valid"]')
      expect(tags).toEqual(['valid', 'also valid'])
    })

    it('returns undefined (no DB update) when response has no parseable tags', async () => {
      const tags = await setupAndGetTags('I cannot extract tags from this.')
      expect(tags).toBeUndefined()
      expect(db.importedCourses.update).not.toHaveBeenCalled()
    })

    it('returns undefined on malformed JSON', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const tags = await setupAndGetTags('[invalid json')
      expect(tags).toBeUndefined()

      consoleWarnSpy.mockRestore()
    })
  })
})
