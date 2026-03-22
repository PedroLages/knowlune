import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db before importing module
const mockToArray = vi.fn().mockResolvedValue([])
const mockTable = vi.fn().mockReturnValue({ toArray: mockToArray })

vi.mock('@/db/schema', () => ({
  db: {
    table: mockTable,
    studySessions: { toArray: vi.fn().mockResolvedValue([]) },
    contentProgress: { toArray: vi.fn().mockResolvedValue([]) },
    notes: { toArray: vi.fn().mockResolvedValue([]) },
    importedCourses: { toArray: vi.fn().mockResolvedValue([]) },
    reviewRecords: { toArray: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('../csvSerializer', () => ({
  sessionsToCSV: vi.fn().mockReturnValue('sessions-csv'),
  progressToCSV: vi.fn().mockReturnValue('progress-csv'),
  deriveStreakDays: vi.fn().mockReturnValue([]),
  streakDaysToCSV: vi.fn().mockReturnValue('streaks-csv'),
}))

vi.mock('../noteExport', () => ({
  sanitizeFilename: vi
    .fn()
    .mockImplementation((s: string) => s.replace(/[^a-z0-9]/gi, '-').toLowerCase()),
  extractTextFromHtml: vi.fn().mockImplementation((html: string) => html.replace(/<[^>]*>/g, '')),
  htmlToMarkdown: vi.fn().mockImplementation((html: string) => html.replace(/<[^>]*>/g, '')),
}))

const { db } = await import('@/db/schema')
const { exportAllAsJson, exportAllAsCsv, exportNotesAsMarkdown, CURRENT_SCHEMA_VERSION } =
  await import('../exportService')
const { sessionsToCSV, progressToCSV, deriveStreakDays, streakDaysToCSV } =
  await import('../csvSerializer')

describe('exportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Reset default mock behavior
    mockToArray.mockResolvedValue([])
    ;(db.studySessions.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(db.contentProgress.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(db.reviewRecords.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  describe('CURRENT_SCHEMA_VERSION', () => {
    it('is defined as a number', () => {
      expect(typeof CURRENT_SCHEMA_VERSION).toBe('number')
      expect(CURRENT_SCHEMA_VERSION).toBe(14)
    })
  })

  describe('exportAllAsJson', () => {
    it('returns export object with schemaVersion, exportedAt, and data', async () => {
      const result = await exportAllAsJson()

      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(result.exportedAt).toBeDefined()
      expect(new Date(result.exportedAt).toISOString()).toBe(result.exportedAt)
      expect(result.data).toBeDefined()
    })

    it('includes all expected table keys in data', async () => {
      const result = await exportAllAsJson()

      const expectedKeys = [
        'settings',
        'importedCourses',
        'importedVideos',
        'importedPdfs',
        'progress',
        'bookmarks',
        'notes',
        'studySessions',
        'contentProgress',
        'challenges',
        'reviewRecords',
        'learningPath',
        'aiUsageEvents',
      ]
      for (const key of expectedKeys) {
        expect(result.data).toHaveProperty(key)
      }
    })

    it('queries all 12 IndexedDB tables', async () => {
      await exportAllAsJson()

      const expectedTables = [
        'importedCourses',
        'importedVideos',
        'importedPdfs',
        'progress',
        'bookmarks',
        'notes',
        'studySessions',
        'contentProgress',
        'challenges',
        'reviewRecords',
        'learningPath',
        'aiUsageEvents',
      ]
      for (const tableName of expectedTables) {
        expect(mockTable).toHaveBeenCalledWith(tableName)
      }
    })

    it('strips directoryHandle from importedCourses', async () => {
      mockToArray.mockImplementation(function (this: unknown) {
        // Return courses with directoryHandle for the importedCourses call
        return Promise.resolve([])
      })

      // Specifically mock the importedCourses table call
      let callCount = 0
      mockToArray.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // importedCourses is the first table
          return Promise.resolve([
            {
              id: 'c1',
              name: 'Test Course',
              importedAt: '2026-01-01T00:00:00Z',
              category: 'test',
              tags: [],
              status: 'active',
              videoCount: 0,
              pdfCount: 0,
              directoryHandle: { kind: 'directory' }, // should be stripped
            },
          ])
        }
        return Promise.resolve([])
      })

      const result = await exportAllAsJson()

      expect(result.data.importedCourses).toHaveLength(1)
      expect(result.data.importedCourses[0]).not.toHaveProperty('directoryHandle')
      expect(result.data.importedCourses[0]).toHaveProperty('id', 'c1')
    })

    it('strips fileHandle from importedVideos', async () => {
      let callCount = 0
      mockToArray.mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          // importedVideos is the second table
          return Promise.resolve([
            {
              id: 'v1',
              courseId: 'c1',
              filename: 'video.mp4',
              path: '/videos/video.mp4',
              duration: 120,
              format: 'mp4',
              order: 1,
              fileHandle: { kind: 'file' }, // should be stripped
            },
          ])
        }
        return Promise.resolve([])
      })

      const result = await exportAllAsJson()

      expect(result.data.importedVideos).toHaveLength(1)
      expect(result.data.importedVideos[0]).not.toHaveProperty('fileHandle')
      expect(result.data.importedVideos[0]).toHaveProperty('id', 'v1')
    })

    it('strips fileHandle from importedPdfs', async () => {
      let callCount = 0
      mockToArray.mockImplementation(() => {
        callCount++
        if (callCount === 3) {
          // importedPdfs is the third table
          return Promise.resolve([
            {
              id: 'p1',
              courseId: 'c1',
              filename: 'doc.pdf',
              path: '/pdfs/doc.pdf',
              pageCount: 10,
              fileHandle: { kind: 'file' }, // should be stripped
            },
          ])
        }
        return Promise.resolve([])
      })

      const result = await exportAllAsJson()

      expect(result.data.importedPdfs).toHaveLength(1)
      expect(result.data.importedPdfs[0]).not.toHaveProperty('fileHandle')
      expect(result.data.importedPdfs[0]).toHaveProperty('id', 'p1')
    })

    it('exports localStorage settings with allowlisted prefixes', async () => {
      localStorage.setItem('app-settings', JSON.stringify({ theme: 'dark' }))
      localStorage.setItem('streak-current', JSON.stringify(5))
      localStorage.setItem('knowlune-sidebar', JSON.stringify({ collapsed: true }))
      localStorage.setItem('theme', 'dark')
      localStorage.setItem('auth-token', 'secret-should-not-export')

      const result = await exportAllAsJson()

      expect(result.data.settings).toHaveProperty('app-settings')
      expect(result.data.settings['app-settings']).toEqual({ theme: 'dark' })
      expect(result.data.settings).toHaveProperty('streak-current', 5)
      expect(result.data.settings).toHaveProperty('knowlune-sidebar')
      expect(result.data.settings).toHaveProperty('theme', 'dark')
      expect(result.data.settings).not.toHaveProperty('auth-token')
    })

    it('exports non-JSON localStorage values as raw strings', async () => {
      localStorage.setItem('theme', 'not-json-parseable')

      const result = await exportAllAsJson()

      expect(result.data.settings).toHaveProperty('theme', 'not-json-parseable')
    })

    it('excludes non-allowlisted localStorage keys', async () => {
      localStorage.setItem('secret-api-key', 'hidden')
      localStorage.setItem('random-data', 'test')

      const result = await exportAllAsJson()

      expect(result.data.settings).not.toHaveProperty('secret-api-key')
      expect(result.data.settings).not.toHaveProperty('random-data')
    })

    it('calls progress callback with correct phases', async () => {
      const onProgress = vi.fn()

      await exportAllAsJson(onProgress)

      expect(onProgress).toHaveBeenCalledWith(0, 'Exporting settings...')
      expect(onProgress).toHaveBeenCalledWith(100, 'Complete')
      // Should have intermediate progress calls for tables
      const calls = onProgress.mock.calls
      expect(calls.length).toBeGreaterThanOrEqual(3) // at least: start, one table, complete
    })

    it('works without progress callback', async () => {
      // Should not throw when onProgress is undefined
      const result = await exportAllAsJson()
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('handles empty database gracefully', async () => {
      const result = await exportAllAsJson()

      expect(result.data.importedCourses).toEqual([])
      expect(result.data.importedVideos).toEqual([])
      expect(result.data.notes).toEqual([])
      expect(result.data.studySessions).toEqual([])
    })
  })

  describe('exportAllAsCsv', () => {
    it('returns CSV strings for sessions, progress, and streaks', async () => {
      const result = await exportAllAsCsv()

      expect(result).toHaveProperty('sessions', 'sessions-csv')
      expect(result).toHaveProperty('progress', 'progress-csv')
      expect(result).toHaveProperty('streaks', 'streaks-csv')
    })

    it('calls sessionsToCSV with fetched sessions', async () => {
      const mockSessions = [{ id: 's1', duration: 100 }]
      ;(db.studySessions.toArray as ReturnType<typeof vi.fn>).mockResolvedValue(mockSessions)

      await exportAllAsCsv()

      expect(sessionsToCSV).toHaveBeenCalledWith(mockSessions)
    })

    it('calls progressToCSV with fetched progress', async () => {
      const mockProgress = [{ id: 'p1', percentComplete: 50 }]
      ;(db.contentProgress.toArray as ReturnType<typeof vi.fn>).mockResolvedValue(mockProgress)

      await exportAllAsCsv()

      expect(progressToCSV).toHaveBeenCalledWith(mockProgress)
    })

    it('calls deriveStreakDays and streakDaysToCSV', async () => {
      const mockSessions = [{ id: 's1' }]
      const mockStreakDays = [{ date: '2026-01-01', count: 1 }]
      ;(db.studySessions.toArray as ReturnType<typeof vi.fn>).mockResolvedValue(mockSessions)
      ;(deriveStreakDays as ReturnType<typeof vi.fn>).mockReturnValue(mockStreakDays)

      await exportAllAsCsv()

      expect(deriveStreakDays).toHaveBeenCalledWith(mockSessions)
      expect(streakDaysToCSV).toHaveBeenCalledWith(mockStreakDays)
    })

    it('calls progress callback with correct phases', async () => {
      const onProgress = vi.fn()

      await exportAllAsCsv(onProgress)

      expect(onProgress).toHaveBeenCalledWith(0, 'Loading sessions...')
      expect(onProgress).toHaveBeenCalledWith(33, 'Loading progress...')
      expect(onProgress).toHaveBeenCalledWith(50, 'Generating CSV files...')
      expect(onProgress).toHaveBeenCalledWith(75, 'Calculating streaks...')
      expect(onProgress).toHaveBeenCalledWith(100, 'Complete')
    })

    it('works without progress callback', async () => {
      const result = await exportAllAsCsv()
      expect(result.sessions).toBeDefined()
    })
  })

  describe('exportNotesAsMarkdown', () => {
    it('returns empty array when no notes exist', async () => {
      const result = await exportNotesAsMarkdown()
      expect(result).toEqual([])
    })

    it('filters out soft-deleted notes', async () => {
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          content: '<p>Active Note</p>',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: ['tag1'],
          deleted: false,
        },
        {
          id: 'n2',
          courseId: 'c1',
          videoId: 'v2',
          content: '<p>Deleted Note</p>',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: [],
          deleted: true,
          deletedAt: '2026-01-03T00:00:00Z',
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'Test Course' },
      ])

      const result = await exportNotesAsMarkdown()

      expect(result).toHaveLength(1)
      expect(result[0].content).toContain('Active Note')
    })

    it('generates markdown files with YAML frontmatter', async () => {
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          content: '<p>My Study Notes</p>',
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-16T10:00:00Z',
          tags: ['react', 'hooks'],
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'React Fundamentals' },
      ])

      const result = await exportNotesAsMarkdown()

      expect(result).toHaveLength(1)
      expect(result[0].name).toMatch(/\.md$/)
      expect(result[0].content).toContain('---')
      expect(result[0].content).toContain('course: "React Fundamentals"')
      expect(result[0].content).toContain('tags: ["react", "hooks"]')
      expect(result[0].content).toContain('created: "2026-01-15T10:00:00Z"')
      expect(result[0].content).toContain('updated: "2026-01-16T10:00:00Z"')
    })

    it('includes lastReviewedAt in frontmatter when review records exist', async () => {
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          content: '<p>Reviewed Note</p>',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: [],
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'Course' },
      ])
      ;(db.reviewRecords.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'r1', noteId: 'n1', reviewedAt: '2026-01-10T00:00:00Z' },
        { id: 'r2', noteId: 'n1', reviewedAt: '2026-01-15T00:00:00Z' }, // more recent
      ])

      const result = await exportNotesAsMarkdown()

      expect(result[0].content).toContain('lastReviewedAt: "2026-01-15T00:00:00Z"')
    })

    it('uses "Unknown Course" when course is not found', async () => {
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'n1',
          courseId: 'missing-course',
          videoId: 'v1',
          content: '<p>Orphan Note</p>',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: [],
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([])

      const result = await exportNotesAsMarkdown()

      expect(result[0].content).toContain('course: "Unknown Course"')
    })

    it('generates unique filenames for duplicate note titles', async () => {
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          content: '<p>Same Title</p>',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: [],
        },
        {
          id: 'n2',
          courseId: 'c1',
          videoId: 'v2',
          content: '<p>Same Title</p>',
          createdAt: '2026-01-03T00:00:00Z',
          updatedAt: '2026-01-04T00:00:00Z',
          tags: [],
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'Course' },
      ])

      const result = await exportNotesAsMarkdown()

      expect(result).toHaveLength(2)
      const names = result.map(f => f.name)
      // Filenames should be unique
      expect(new Set(names).size).toBe(2)
      expect(names[0]).toMatch(/\.md$/)
      expect(names[1]).toMatch(/-1\.md$/)
    })

    it('handles notes with empty content', async () => {
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          content: '',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: [],
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'Course' },
      ])

      const result = await exportNotesAsMarkdown()

      expect(result).toHaveLength(1)
      // Empty content -> extractTextFromHtml returns '' -> firstLine fallback is 'note'
      expect(result[0].name).toMatch(/\.md$/)
    })

    it('falls back to note-ID filename when sanitizeFilename returns empty', async () => {
      const { sanitizeFilename } = await import('../noteExport')
      ;(sanitizeFilename as ReturnType<typeof vi.fn>).mockReturnValueOnce('')
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'abcdefgh-1234',
          courseId: 'c1',
          videoId: 'v1',
          content: '<p>Special chars only: ***</p>',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: [],
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'Course' },
      ])

      const result = await exportNotesAsMarkdown()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('note-abcdefgh.md')
    })

    it('calls progress callback with correct phases', async () => {
      const onProgress = vi.fn()

      await exportNotesAsMarkdown(onProgress)

      expect(onProgress).toHaveBeenCalledWith(0, 'Loading notes...')
      expect(onProgress).toHaveBeenCalledWith(25, 'Loading course names...')
      expect(onProgress).toHaveBeenCalledWith(40, 'Loading review records...')
      expect(onProgress).toHaveBeenCalledWith(50, 'Converting notes to Markdown...')
      expect(onProgress).toHaveBeenCalledWith(100, 'Complete')
    })

    it('escapes double quotes in frontmatter values', async () => {
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          content: '<p>Note with "quotes" in it</p>',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: ['tag"with"quotes'],
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'Course "Advanced"' },
      ])

      const result = await exportNotesAsMarkdown()

      expect(result[0].content).toContain('course: "Course \\"Advanced\\""')
    })

    it('uses first tag as topic in frontmatter', async () => {
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          content: '<p>Tagged Note</p>',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: ['javascript', 'async'],
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'JS Course' },
      ])

      const result = await exportNotesAsMarkdown()

      expect(result[0].content).toContain('topic: "javascript"')
    })

    it('handles notes with no tags gracefully', async () => {
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'n1',
          courseId: 'c1',
          videoId: 'v1',
          content: '<p>No tags</p>',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          tags: [],
        },
      ])
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'Course' },
      ])

      const result = await exportNotesAsMarkdown()

      expect(result[0].content).toContain('topic: ""')
      expect(result[0].content).toContain('tags: []')
    })

    it('works without progress callback', async () => {
      const result = await exportNotesAsMarkdown()
      expect(result).toEqual([])
    })

    it('handles many notes and yields to UI', async () => {
      // Create 25 notes to trigger yield (every 20 notes)
      const notes = Array.from({ length: 25 }, (_, i) => ({
        id: `n${i}`,
        courseId: 'c1',
        videoId: `v${i}`,
        content: `<p>Note ${i}</p>`,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        tags: [],
      }))
      ;(db.notes.toArray as ReturnType<typeof vi.fn>).mockResolvedValue(notes)
      ;(db.importedCourses.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'c1', name: 'Course' },
      ])

      const onProgress = vi.fn()
      const result = await exportNotesAsMarkdown(onProgress)

      expect(result).toHaveLength(25)
      // Should have intermediate progress for note 1 (index 0) and note 21 (index 20)
      const convertingCalls = onProgress.mock.calls.filter(
        ([, phase]: unknown[]) =>
          typeof phase === 'string' && (phase as string).startsWith('Converting note')
      )
      expect(convertingCalls.length).toBeGreaterThanOrEqual(2)
    })
  })
})
