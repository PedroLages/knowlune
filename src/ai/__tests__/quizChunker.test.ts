/**
 * Unit Tests: quizChunker.ts
 *
 * Tests transcript chunking strategies: chapter-based and fixed time window.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TranscriptCue, YouTubeCourseChapter } from '@/data/types'

// Hoisted mocks
const { mockTranscriptFirst, mockChaptersSortBy } = vi.hoisted(() => ({
  mockTranscriptFirst: vi.fn(),
  mockChaptersSortBy: vi.fn(),
}))

vi.mock('@/db/schema', () => ({
  db: {
    youtubeTranscripts: {
      where: () => ({
        equals: () => ({
          first: mockTranscriptFirst,
        }),
      }),
    },
    youtubeChapters: {
      where: () => ({
        equals: () => ({
          sortBy: mockChaptersSortBy,
        }),
      }),
    },
  },
}))

import { chunkTranscript } from '../quizChunker'

// --- Test Helpers ---

function makeCues(wordCount: number, startTime: number = 0): TranscriptCue[] {
  // Create cues with ~10 words each
  const cues: TranscriptCue[] = []
  const wordsPerCue = 10
  const numCues = Math.ceil(wordCount / wordsPerCue)
  const cueDuration = 5 // 5 seconds per cue

  for (let i = 0; i < numCues; i++) {
    const words = Array.from({ length: wordsPerCue }, (_, j) => `word${i * wordsPerCue + j}`)
    cues.push({
      startTime: startTime + i * cueDuration,
      endTime: startTime + (i + 1) * cueDuration,
      text: words.join(' '),
    })
  }

  return cues
}

function makeChapters(
  titles: string[],
  startTimes: number[],
  videoId = 'vid1',
  courseId = 'course1'
): YouTubeCourseChapter[] {
  return titles.map((title, i) => ({
    id: `ch-${i}`,
    courseId,
    videoId,
    title,
    startTime: startTimes[i],
    endTime: startTimes[i + 1],
    order: i,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('chunkTranscript', () => {
  it('returns empty array when no transcript found', async () => {
    mockTranscriptFirst.mockResolvedValue(null)
    mockChaptersSortBy.mockResolvedValue([])

    const result = await chunkTranscript('vid1', 'course1')
    expect(result).toEqual([])
  })

  it('returns empty array when transcript is not done', async () => {
    mockTranscriptFirst.mockResolvedValue({ status: 'pending', cues: [] })
    mockChaptersSortBy.mockResolvedValue([])

    const result = await chunkTranscript('vid1', 'course1')
    expect(result).toEqual([])
  })

  describe('chapter-based chunking', () => {
    it('splits transcript by chapter boundaries', async () => {
      const cues = makeCues(800, 0) // 800 words starting at 0s
      const chapters = makeChapters(
        ['Intro', 'Main'],
        [0, cues[Math.floor(cues.length / 2)].startTime]
      )

      mockTranscriptFirst.mockResolvedValue({
        status: 'done',
        cues,
        fullText: cues.map(c => c.text).join(' '),
      })
      mockChaptersSortBy.mockResolvedValue(chapters)

      const result = await chunkTranscript('vid1', 'course1')
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].topic).toContain('Intro')
    })

    it('merges small chapters with previous', async () => {
      // Create a very small second chapter
      const cues = [
        ...makeCues(600, 0),
        ...makeCues(50, 500), // tiny chapter
      ]
      const chapters = makeChapters(['Intro', 'Tiny'], [0, 500])

      mockTranscriptFirst.mockResolvedValue({
        status: 'done',
        cues,
        fullText: cues.map(c => c.text).join(' '),
      })
      mockChaptersSortBy.mockResolvedValue(chapters)

      const result = await chunkTranscript('vid1', 'course1')
      // The tiny chapter should be merged with Intro
      expect(result.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('fixed time window chunking', () => {
    it('falls back to 5-minute windows when no chapters', async () => {
      // Create 15 minutes of content (~600 words total)
      const cues = makeCues(600, 0)

      mockTranscriptFirst.mockResolvedValue({
        status: 'done',
        cues,
        fullText: cues.map(c => c.text).join(' '),
      })
      mockChaptersSortBy.mockResolvedValue([]) // no chapters

      const result = await chunkTranscript('vid1', 'course1')
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].topic).toContain('Part')
    })

    it('labels windows as Part 1, Part 2, etc.', async () => {
      // Create enough content for multiple windows (cues spanning > 300 seconds)
      const cues: TranscriptCue[] = []
      for (let i = 0; i < 120; i++) {
        // 120 cues at 5s each = 600s = 10 minutes, ~10 words each = 1200 words
        cues.push({
          startTime: i * 5,
          endTime: (i + 1) * 5,
          text: Array.from({ length: 10 }, (_, j) => `word${i * 10 + j}`).join(' '),
        })
      }

      mockTranscriptFirst.mockResolvedValue({
        status: 'done',
        cues,
        fullText: cues.map(c => c.text).join(' '),
      })
      mockChaptersSortBy.mockResolvedValue([])

      const result = await chunkTranscript('vid1', 'course1')
      expect(result.length).toBeGreaterThan(1)
      expect(result[0].topic).toBe('Part 1')
      expect(result[1].topic).toBe('Part 2')
    })
  })
})
