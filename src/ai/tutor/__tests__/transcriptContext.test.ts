/**
 * Unit tests for transcriptContext.ts (E57-S01)
 *
 * Tests getTranscriptContext() across all strategies:
 * - short transcript → full
 * - long transcript with chapters → chapter
 * - long transcript without chapters → sliding window
 * - empty/missing transcript → none
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks (must be before imports that use @/db)
// ---------------------------------------------------------------------------

const mockGet = vi.fn()
const mockWhere = vi.fn()
const mockEquals = vi.fn()
const mockFirst = vi.fn()
const mockSortBy = vi.fn()

vi.mock('@/db', () => ({
  db: {
    importedVideos: {
      get: (...args: unknown[]) => mockGet(...args),
    },
    youtubeTranscripts: {
      where: (...args: unknown[]) => mockWhere(...args),
    },
    youtubeChapters: {
      where: (...args: unknown[]) => mockWhere(...args),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getTranscriptContext, estimateTokens } from '../transcriptContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCues(count: number, wordsPerCue = 10) {
  return Array.from({ length: count }, (_, i) => ({
    startTime: i * 5,
    endTime: (i + 1) * 5,
    text: Array(wordsPerCue).fill('word').join(' '),
  }))
}

// Short transcript: well under 2K tokens
const SHORT_FULL_TEXT = 'This is a short transcript.'
const SHORT_CUES = [{ startTime: 0, endTime: 5, text: SHORT_FULL_TEXT }]

// Long transcript: > 2K tokens (8001+ chars)
const LONG_TEXT = 'word '.repeat(2001) // ~2001 tokens
const LONG_CUES = makeCues(500, 20) // many cues

beforeEach(() => {
  vi.clearAllMocks()

  // Default: video exists with a youtubeVideoId
  mockGet.mockResolvedValue({ id: 'lesson-1', youtubeVideoId: 'yt-123' })

  // Default chain for youtubeTranscripts.where().equals().first()
  mockFirst.mockResolvedValue(null)
  mockEquals.mockReturnValue({ first: mockFirst, sortBy: mockSortBy })
  mockWhere.mockReturnValue({ equals: mockEquals })
  mockSortBy.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  it('estimates tokens at ~4 chars per token', () => {
    expect(estimateTokens('aaaa')).toBe(1)
    expect(estimateTokens('aaaaaaaa')).toBe(2)
    expect(estimateTokens('')).toBe(0)
  })
})

describe('getTranscriptContext', () => {
  describe('missing transcript', () => {
    it('returns none strategy when no video found', async () => {
      mockGet.mockResolvedValue(undefined)

      const result = await getTranscriptContext('c1', 'l1', 0)

      expect(result.strategy).toBe('none')
      expect(result.status.available).toBe(false)
      expect(result.excerpt).toBe('')
    })

    it('returns none strategy when transcript record not found', async () => {
      mockFirst.mockResolvedValue(null)

      const result = await getTranscriptContext('c1', 'l1', 0)

      expect(result.strategy).toBe('none')
      expect(result.status.available).toBe(false)
    })

    it('returns none strategy when transcript status is not done', async () => {
      mockFirst.mockResolvedValue({
        status: 'pending',
        fullText: 'some text',
        cues: [],
      })

      const result = await getTranscriptContext('c1', 'l1', 0)

      expect(result.strategy).toBe('none')
      expect(result.status.available).toBe(false)
    })

    it('returns none strategy when fullText is empty', async () => {
      mockFirst.mockResolvedValue({ status: 'done', fullText: '', cues: [] })

      const result = await getTranscriptContext('c1', 'l1', 0)

      expect(result.strategy).toBe('none')
    })
  })

  describe('full strategy (short transcript)', () => {
    it('uses full strategy when transcript is under 2K tokens', async () => {
      mockFirst.mockResolvedValue({
        status: 'done',
        fullText: SHORT_FULL_TEXT,
        cues: SHORT_CUES,
      })

      const result = await getTranscriptContext('c1', 'l1', 0)

      expect(result.strategy).toBe('full')
      expect(result.excerpt).toBe(SHORT_FULL_TEXT)
      expect(result.status.available).toBe(true)
      expect(result.status.label).toBe('Transcript-grounded')
    })
  })

  describe('chapter strategy (long transcript with chapters)', () => {
    it('uses chapter strategy when chapters exist for the video', async () => {
      mockFirst.mockResolvedValue({
        status: 'done',
        fullText: LONG_TEXT,
        cues: LONG_CUES,
      })

      // Chapters query returns chapters for this video
      mockSortBy.mockResolvedValue([
        { videoId: 'yt-123', title: 'Intro', startTime: 0, endTime: 30, order: 0 },
        { videoId: 'yt-123', title: 'Main', startTime: 30, endTime: 120, order: 1 },
      ])

      const result = await getTranscriptContext('c1', 'l1', 10)

      expect(result.strategy).toBe('chapter')
      expect(result.status.available).toBe(true)
      expect(result.chapterTitle).toBe('Intro')
      expect(result.excerpt).toBeTruthy()
    })
  })

  describe('window strategy (long transcript, no chapters)', () => {
    it('uses sliding window when no chapters exist', async () => {
      mockFirst.mockResolvedValue({
        status: 'done',
        fullText: LONG_TEXT,
        cues: LONG_CUES,
      })

      // No chapters returned
      mockSortBy.mockResolvedValue([])

      const result = await getTranscriptContext('c1', 'l1', 60)

      expect(result.strategy).toBe('window')
      expect(result.status.available).toBe(true)
      expect(result.excerpt).toBeTruthy()
      expect(result.timeRange).toBeTruthy()
    })

    it('uses window strategy when chapters belong to a different video', async () => {
      mockFirst.mockResolvedValue({
        status: 'done',
        fullText: LONG_TEXT,
        cues: LONG_CUES,
      })

      // Chapters exist but for a different video
      mockSortBy.mockResolvedValue([
        { videoId: 'other-video', title: 'Other', startTime: 0, endTime: 30, order: 0 },
      ])

      const result = await getTranscriptContext('c1', 'l1', 30)

      expect(result.strategy).toBe('window')
    })
  })
})
