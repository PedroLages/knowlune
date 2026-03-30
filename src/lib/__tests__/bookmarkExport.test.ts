import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VideoBookmark } from '@/data/types'

// Mock db before importing module
const mockBookmarksToArray = vi.fn().mockResolvedValue([])
const mockCoursesToArray = vi.fn().mockResolvedValue([])
const mockVideosToArray = vi.fn().mockResolvedValue([])

vi.mock('@/db/schema', () => ({
  db: {
    bookmarks: { toArray: mockBookmarksToArray },
    importedCourses: { toArray: mockCoursesToArray },
    importedVideos: { toArray: mockVideosToArray },
  },
}))

vi.mock('../noteExport', () => ({
  sanitizeFilename: vi.fn().mockImplementation((s: string) =>
    s
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim()
  ),
}))

const { formatTimestamp, exportBookmarksAsMarkdown } = await import('../bookmarkExport')

function makeBookmark(overrides: Partial<VideoBookmark> = {}): VideoBookmark {
  return {
    id: 'bm-001',
    courseId: 'course-1',
    lessonId: 'video-1',
    timestamp: 125,
    label: 'Important concept',
    createdAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('bookmarkExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBookmarksToArray.mockResolvedValue([])
    mockCoursesToArray.mockResolvedValue([])
    mockVideosToArray.mockResolvedValue([])
  })

  describe('formatTimestamp', () => {
    it('formats 0 seconds as "0:00"', () => {
      expect(formatTimestamp(0)).toBe('0:00')
    })

    it('formats 59 seconds as "0:59"', () => {
      expect(formatTimestamp(59)).toBe('0:59')
    })

    it('formats 65 seconds as "1:05"', () => {
      expect(formatTimestamp(65)).toBe('1:05')
    })

    it('formats 3725 seconds as "1:02:05" (AC6)', () => {
      expect(formatTimestamp(3725)).toBe('1:02:05')
    })

    it('formats 3600 seconds as "1:00:00"', () => {
      expect(formatTimestamp(3600)).toBe('1:00:00')
    })

    it('formats 7261 seconds as "2:01:01"', () => {
      expect(formatTimestamp(7261)).toBe('2:01:01')
    })

    it('handles fractional seconds by flooring', () => {
      expect(formatTimestamp(65.9)).toBe('1:05')
    })
  })

  describe('exportBookmarksAsMarkdown', () => {
    it('returns empty array when no bookmarks exist (AC7)', async () => {
      mockBookmarksToArray.mockResolvedValue([])

      const result = await exportBookmarksAsMarkdown()
      expect(result).toEqual([])
    })

    it('generates one file per course with YAML frontmatter (AC5)', async () => {
      const bookmarks = [
        makeBookmark({ courseId: 'c1', lessonId: 'v1', timestamp: 10, label: 'Intro' }),
        makeBookmark({ id: 'bm-2', courseId: 'c1', lessonId: 'v2', timestamp: 20, label: 'Mid' }),
        makeBookmark({ id: 'bm-3', courseId: 'c2', lessonId: 'v3', timestamp: 30, label: 'End' }),
      ]

      mockBookmarksToArray.mockResolvedValue(bookmarks)
      mockCoursesToArray.mockResolvedValue([
        { id: 'c1', name: 'React Mastery' },
        { id: 'c2', name: 'TypeScript Pro' },
      ])
      mockVideosToArray.mockResolvedValue([
        { id: 'v1', filename: 'Lesson 1.mp4' },
        { id: 'v2', filename: 'Lesson 2.mp4' },
        { id: 'v3', filename: 'Lesson 3.mp4' },
      ])

      const result = await exportBookmarksAsMarkdown()
      expect(result).toHaveLength(2)

      // Check React Mastery file
      const reactFile = result.find(f => f.name.includes('React-Mastery'))
      expect(reactFile).toBeDefined()
      expect(reactFile!.content).toContain('type: "bookmarks"')
      expect(reactFile!.content).toContain('course: "React Mastery"')
      expect(reactFile!.content).toContain('bookmark_count: 2')
      expect(reactFile!.content).toContain('## Lesson 1.mp4')
      expect(reactFile!.content).toContain('## Lesson 2.mp4')

      // Check TypeScript Pro file
      const tsFile = result.find(f => f.name.includes('TypeScript-Pro'))
      expect(tsFile).toBeDefined()
      expect(tsFile!.content).toContain('bookmark_count: 1')
    })

    it('sorts bookmarks by timestamp ascending within each video (AC5)', async () => {
      const bookmarks = [
        makeBookmark({ id: 'bm-1', timestamp: 300, label: 'Later' }),
        makeBookmark({ id: 'bm-2', timestamp: 10, label: 'Earlier' }),
        makeBookmark({ id: 'bm-3', timestamp: 150, label: 'Middle' }),
      ]

      mockBookmarksToArray.mockResolvedValue(bookmarks)
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'Test Course' }])
      mockVideosToArray.mockResolvedValue([{ id: 'video-1', filename: 'Video.mp4' }])

      const result = await exportBookmarksAsMarkdown()
      const content = result[0].content

      const earlierIdx = content.indexOf('Earlier')
      const middleIdx = content.indexOf('Middle')
      const laterIdx = content.indexOf('Later')

      expect(earlierIdx).toBeLessThan(middleIdx)
      expect(middleIdx).toBeLessThan(laterIdx)
    })

    it('formats timestamps correctly in bookmark entries (AC6)', async () => {
      const bookmarks = [makeBookmark({ timestamp: 3725, label: 'Long timestamp' })]

      mockBookmarksToArray.mockResolvedValue(bookmarks)
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'Course' }])
      mockVideosToArray.mockResolvedValue([{ id: 'video-1', filename: 'Video.mp4' }])

      const result = await exportBookmarksAsMarkdown()
      expect(result[0].content).toContain('**[1:02:05]** Long timestamp')
    })

    it('organizes files under bookmarks/{course-name}/ path', async () => {
      mockBookmarksToArray.mockResolvedValue([makeBookmark()])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockVideosToArray.mockResolvedValue([{ id: 'video-1', filename: 'Video.mp4' }])

      const result = await exportBookmarksAsMarkdown()
      expect(result[0].name).toBe('bookmarks/React-Mastery/bookmarks.md')
    })

    it('includes exported ISO 8601 date in frontmatter', async () => {
      mockBookmarksToArray.mockResolvedValue([makeBookmark()])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'Course' }])
      mockVideosToArray.mockResolvedValue([{ id: 'video-1', filename: 'Video.mp4' }])

      const fixedDate = new Date('2026-03-30T12:00:00.000Z')
      const result = await exportBookmarksAsMarkdown(undefined, fixedDate)
      expect(result[0].content).toContain('exported: "2026-03-30T12:00:00.000Z"')
    })

    it('calls onProgress callback', async () => {
      mockBookmarksToArray.mockResolvedValue([])
      const onProgress = vi.fn()

      await exportBookmarksAsMarkdown(onProgress)
      expect(onProgress).toHaveBeenCalledWith(0, 'Loading bookmarks...')
      expect(onProgress).toHaveBeenCalledWith(100, 'Complete')
    })

    it('groups bookmarks by video heading', async () => {
      const bookmarks = [
        makeBookmark({ id: 'bm-1', lessonId: 'v1', timestamp: 10, label: 'A' }),
        makeBookmark({ id: 'bm-2', lessonId: 'v2', timestamp: 20, label: 'B' }),
        makeBookmark({ id: 'bm-3', lessonId: 'v1', timestamp: 30, label: 'C' }),
      ]

      mockBookmarksToArray.mockResolvedValue(bookmarks)
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'Course' }])
      mockVideosToArray.mockResolvedValue([
        { id: 'v1', filename: 'Intro.mp4' },
        { id: 'v2', filename: 'Advanced.mp4' },
      ])

      const result = await exportBookmarksAsMarkdown()
      const content = result[0].content

      // Both bookmarks for v1 should appear under the same heading
      const introHeadingIdx = content.indexOf('## Intro.mp4')
      const advancedHeadingIdx = content.indexOf('## Advanced.mp4')
      expect(introHeadingIdx).not.toBe(-1)
      expect(advancedHeadingIdx).not.toBe(-1)

      // Both A and C should appear after Intro heading
      const aIdx = content.indexOf('A', introHeadingIdx)
      const cIdx = content.indexOf('C', introHeadingIdx)
      expect(aIdx).toBeLessThan(advancedHeadingIdx)
      expect(cIdx).toBeLessThan(advancedHeadingIdx)
    })
  })
})
