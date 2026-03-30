import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Flashcard } from '@/data/types'

// Mock db before importing module
const mockFlashcardsToArray = vi.fn().mockResolvedValue([])
const mockCoursesToArray = vi.fn().mockResolvedValue([])
const mockNotesToArray = vi.fn().mockResolvedValue([])

vi.mock('@/db/schema', () => ({
  db: {
    flashcards: { toArray: mockFlashcardsToArray },
    importedCourses: { toArray: mockCoursesToArray },
    notes: { toArray: mockNotesToArray },
  },
}))

// Mock deriveFlashcardTags to isolate ankiExport tests
vi.mock('../flashcardExport', () => ({
  deriveFlashcardTags: vi.fn().mockReturnValue(['react-mastery', 'react', 'hooks']),
}))

// Mock stripHtml
vi.mock('../textUtils', () => ({
  stripHtml: vi.fn().mockImplementation((html: string) =>
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  ),
}))

// Mock sql.js with a minimal Database implementation
const mockDbRun = vi.fn()

const mockDecksJson = JSON.stringify({
  1: { desc: '', name: 'Default', id: 1 },
  1435588830424: { desc: '', name: 'Template', id: 1435588830424 },
})
const mockModelsJson = JSON.stringify({
  1388596687391: {
    vers: [],
    name: 'Basic-f15d2',
    tags: ['Tag'],
    did: 1435588830424,
    usn: -1,
    flds: [
      { name: 'Front', media: [], sticky: false, rtl: false, ord: 0, font: 'Arial', size: 20 },
      { name: 'Back', media: [], sticky: false, rtl: false, ord: 1, font: 'Arial', size: 20 },
    ],
    sortf: 0,
    type: 0,
    id: 1388596687391,
    mod: 1435645658,
  },
})

const mockDbExec = vi.fn().mockImplementation((sql: string) => {
  if (sql.includes('SELECT decks')) {
    return [{ values: [[mockDecksJson]] }]
  }
  if (sql.includes('SELECT models')) {
    return [{ values: [[mockModelsJson]] }]
  }
  return [{ values: [['{}']] }]
})
const mockDbExport = vi.fn().mockReturnValue(new Uint8Array([1, 2, 3, 4]))
const mockDbClose = vi.fn()

// Must use function constructor (not arrow) so `new` works
function MockDatabase() {
  return {
    run: mockDbRun,
    exec: mockDbExec,
    export: mockDbExport,
    close: mockDbClose,
  }
}

vi.mock('sql.js/dist/sql-asm.js', () => ({
  default: vi.fn().mockResolvedValue({
    Database: MockDatabase,
  }),
}))

// Mock jszip — must use function constructor so `new` works
const mockZipFile = vi.fn()
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['fake-apkg'], { type: 'application/octet-stream' }))

function MockJSZip() {
  return {
    file: mockZipFile,
    generateAsync: mockGenerateAsync,
  }
}

vi.mock('jszip', () => ({
  default: MockJSZip,
}))

const { exportFlashcardsAsAnki } = await import('../ankiExport')

function makeFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'fc-001',
    courseId: 'course-1',
    front: 'What is React?',
    back: 'A JavaScript library for building user interfaces.',
    stability: 4.5,
    difficulty: 3.2,
    reps: 2,
    lapses: 0,
    state: 2 as const,
    elapsed_days: 3,
    scheduled_days: 5,
    due: '2026-04-05T00:00:00.000Z',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-30T10:00:00.000Z',
    ...overrides,
  }
}

describe('ankiExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFlashcardsToArray.mockResolvedValue([])
    mockCoursesToArray.mockResolvedValue([])
    mockNotesToArray.mockResolvedValue([])

    // Reset exec mock to return differentiated deck/model JSON
    mockDbExec.mockImplementation((sql: string) => {
      if (sql.includes('SELECT decks')) {
        return [{ values: [[mockDecksJson]] }]
      }
      if (sql.includes('SELECT models')) {
        return [{ values: [[mockModelsJson]] }]
      }
      return [{ values: [['{}']] }]
    })
  })

  describe('exportFlashcardsAsAnki', () => {
    it('AC4: returns null when no flashcards exist', async () => {
      mockFlashcardsToArray.mockResolvedValue([])

      const result = await exportFlashcardsAsAnki()
      expect(result).toBeNull()
    })

    it('AC1: returns a Blob when flashcards exist', async () => {
      const flashcard = makeFlashcard()
      mockFlashcardsToArray.mockResolvedValue([flashcard])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      const result = await exportFlashcardsAsAnki()

      expect(result).toBeInstanceOf(Blob)
    })

    it('AC2: creates a single deck and adds all cards', async () => {
      const flashcards = [
        makeFlashcard({ id: 'fc-001', courseId: 'course-1', front: 'Q1', back: 'A1' }),
        makeFlashcard({ id: 'fc-002', courseId: 'course-2', front: 'Q2', back: 'A2' }),
      ]
      mockFlashcardsToArray.mockResolvedValue(flashcards)
      mockCoursesToArray.mockResolvedValue([
        { id: 'course-1', name: 'React Mastery' },
        { id: 'course-2', name: 'TypeScript Basics' },
      ])
      mockNotesToArray.mockResolvedValue([])

      await exportFlashcardsAsAnki()

      // Should initialize DB with template
      expect(mockDbRun).toHaveBeenCalled()
      // Should have run INSERT for notes and cards (2 notes + 2 cards + template + 2 updates)
      const insertCalls = mockDbRun.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT')
      )
      // 2 notes + 2 cards = 4 INSERT calls (plus template which has its own INSERT)
      expect(insertCalls.length).toBeGreaterThanOrEqual(4)
    })

    it('AC5: dynamically imports sql.js', async () => {
      const flashcard = makeFlashcard()
      mockFlashcardsToArray.mockResolvedValue([flashcard])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      await exportFlashcardsAsAnki()

      // sql.js was loaded via dynamic import (mocked) — verify DB was initialized
      expect(mockDbRun).toHaveBeenCalled()
    })

    it('generates .apkg ZIP with collection.anki2 and media', async () => {
      mockFlashcardsToArray.mockResolvedValue([makeFlashcard()])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      await exportFlashcardsAsAnki()

      // ZIP should contain collection.anki2 and media
      expect(mockZipFile).toHaveBeenCalledWith('collection.anki2', expect.any(Uint8Array))
      expect(mockZipFile).toHaveBeenCalledWith('media', '{}')
      expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' })
    })

    it('calls progress callback through phases', async () => {
      mockFlashcardsToArray.mockResolvedValue([makeFlashcard()])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      const onProgress = vi.fn()
      await exportFlashcardsAsAnki(onProgress)

      // Should have been called with various progress phases
      expect(onProgress).toHaveBeenCalledWith(0, 'Loading flashcards...')
      expect(onProgress).toHaveBeenCalledWith(100, 'Complete')

      // Should have intermediate progress calls
      const calls = onProgress.mock.calls
      expect(calls.length).toBeGreaterThan(2)
    })

    it('closes SQLite database after export', async () => {
      mockFlashcardsToArray.mockResolvedValue([makeFlashcard()])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      await exportFlashcardsAsAnki()

      expect(mockDbClose).toHaveBeenCalled()
    })

    it('throws descriptive error when sql.js dynamic import fails', async () => {
      mockFlashcardsToArray.mockResolvedValue([makeFlashcard()])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      // Temporarily override the sql.js mock to simulate import failure
      // The dynamic import resolves but initSqlJs (default export) rejects,
      // simulating a corrupted or unavailable sql.js engine
      const sqlModule = await import('sql.js/dist/sql-asm.js')
      const originalDefault = sqlModule.default
      ;(sqlModule as { default: unknown }).default = vi.fn().mockImplementation(() => {
        throw new Error('Network error loading sql.js')
      })

      await expect(exportFlashcardsAsAnki()).rejects.toThrow('Network error loading sql.js')

      // Restore original mock
      ;(sqlModule as { default: unknown }).default = originalDefault
    })

    it('closes SQLite database even when card insertion throws', async () => {
      mockFlashcardsToArray.mockResolvedValue([makeFlashcard()])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      // Make the first INSERT OR REPLACE (note insert) throw
      mockDbRun.mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('INSERT OR REPLACE INTO notes')) {
          throw new Error('SQLite insertion error')
        }
      })

      await expect(exportFlashcardsAsAnki()).rejects.toThrow('SQLite insertion error')
      expect(mockDbClose).toHaveBeenCalled()

      // Restore mockDbRun
      mockDbRun.mockReset()
    })

    it('strips HTML from card front and back', async () => {
      const flashcard = makeFlashcard({
        front: '<p>What is <strong>React</strong>?</p>',
        back: '<div data-tiptap="true">A library</div>',
      })
      mockFlashcardsToArray.mockResolvedValue([flashcard])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      const { stripHtml } = await import('../textUtils')
      await exportFlashcardsAsAnki()

      // stripHtml should have been called with the card content
      expect(stripHtml).toHaveBeenCalledWith('<p>What is <strong>React</strong>?</p>')
      expect(stripHtml).toHaveBeenCalledWith('<div data-tiptap="true">A library</div>')
    })
  })
})
