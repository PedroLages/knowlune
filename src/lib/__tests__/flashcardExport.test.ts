import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Flashcard, Note } from '@/data/types'

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

const { deriveFlashcardTags, exportFlashcardsAsMarkdown } = await import('../flashcardExport')

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

describe('flashcardExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFlashcardsToArray.mockResolvedValue([])
    mockCoursesToArray.mockResolvedValue([])
    mockNotesToArray.mockResolvedValue([])
  })

  describe('deriveFlashcardTags', () => {
    it('returns course name as kebab-case tag when no noteId', () => {
      const fc = makeFlashcard({ noteId: undefined })
      const courseMap = new Map([['course-1', 'React Mastery']])
      const noteTagMap = new Map<string, string[]>()

      const tags = deriveFlashcardTags(fc, courseMap, noteTagMap)
      expect(tags).toEqual(['react-mastery'])
    })

    it('includes linked note tags when noteId is present', () => {
      const fc = makeFlashcard({ noteId: 'note-1' })
      const courseMap = new Map([['course-1', 'React Mastery']])
      const noteTagMap = new Map([['note-1', ['react', 'hooks']]])

      const tags = deriveFlashcardTags(fc, courseMap, noteTagMap)
      expect(tags).toEqual(['react-mastery', 'react', 'hooks'])
    })

    it('deduplicates tags', () => {
      const fc = makeFlashcard({ noteId: 'note-1' })
      const courseMap = new Map([['course-1', 'React']])
      const noteTagMap = new Map([['note-1', ['react', 'hooks']]])

      const tags = deriveFlashcardTags(fc, courseMap, noteTagMap)
      // 'react' (from course) and 'react' (from note) should deduplicate
      expect(tags).toEqual(['react', 'hooks'])
    })

    it('returns empty array when course not found and no noteId', () => {
      const fc = makeFlashcard({ courseId: 'nonexistent', noteId: undefined })
      const courseMap = new Map<string, string>()
      const noteTagMap = new Map<string, string[]>()

      const tags = deriveFlashcardTags(fc, courseMap, noteTagMap)
      expect(tags).toEqual([])
    })
  })

  describe('exportFlashcardsAsMarkdown', () => {
    it('returns empty array when no flashcards exist (AC7)', async () => {
      mockFlashcardsToArray.mockResolvedValue([])

      const result = await exportFlashcardsAsMarkdown()
      expect(result).toEqual([])
    })

    it('exports flashcard with YAML frontmatter and Q/A body (AC1)', async () => {
      const fc = makeFlashcard({
        last_review: '2026-03-28T12:00:00.000Z',
        lastRating: 'good',
      })
      mockFlashcardsToArray.mockResolvedValue([fc])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      const result = await exportFlashcardsAsMarkdown()
      expect(result).toHaveLength(1)

      const content = result[0].content
      // Check YAML frontmatter fields
      expect(content).toContain('type: "flashcard"')
      expect(content).toContain('deck: "React Mastery"')
      expect(content).toContain('tags: ["react-mastery"]')
      expect(content).toContain('stability: 4.5')
      expect(content).toContain('difficulty: 3.2')
      expect(content).toContain('reps: 2')
      expect(content).toContain('lapses: 0')
      expect(content).toContain('state: 2')
      expect(content).toContain('due: "2026-04-05T00:00:00.000Z"')
      expect(content).toContain('last_review: "2026-03-28T12:00:00.000Z"')
      expect(content).toContain('last_rating: "good"')

      // Check Q/A body
      expect(content).toContain('# Q: What is React?')
      expect(content).toContain('A JavaScript library for building user interfaces.')
    })

    it('organizes files under flashcards/{course-name}/ folders (AC2)', async () => {
      const fc1 = makeFlashcard({ id: 'fc-1', courseId: 'c1', front: 'Q1' })
      const fc2 = makeFlashcard({ id: 'fc-2', courseId: 'c2', front: 'Q2' })
      const fc3 = makeFlashcard({ id: 'fc-3', courseId: 'c3', front: 'Q3' })

      mockFlashcardsToArray.mockResolvedValue([fc1, fc2, fc3])
      mockCoursesToArray.mockResolvedValue([
        { id: 'c1', name: 'React Mastery' },
        { id: 'c2', name: 'TypeScript Pro' },
        { id: 'c3', name: 'Node Advanced' },
      ])
      mockNotesToArray.mockResolvedValue([])

      const result = await exportFlashcardsAsMarkdown()
      expect(result).toHaveLength(3)

      const folders = new Set(result.map(f => f.name.split('/').slice(0, 2).join('/')))
      expect(folders.size).toBe(3)
      expect(folders).toContain('flashcards/React-Mastery')
      expect(folders).toContain('flashcards/TypeScript-Pro')
      expect(folders).toContain('flashcards/Node-Advanced')
    })

    it('includes note tags in frontmatter when flashcard has noteId (AC3)', async () => {
      const fc = makeFlashcard({ noteId: 'note-1' })
      mockFlashcardsToArray.mockResolvedValue([fc])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([{ id: 'note-1', tags: ['react', 'hooks'] } as Note])

      const result = await exportFlashcardsAsMarkdown()
      expect(result[0].content).toContain('tags: ["react-mastery", "react", "hooks"]')
    })

    it('omits undefined optional fields from YAML (AC4)', async () => {
      const fc = makeFlashcard({
        last_review: undefined,
        lastRating: undefined,
      })
      mockFlashcardsToArray.mockResolvedValue([fc])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React Mastery' }])
      mockNotesToArray.mockResolvedValue([])

      const result = await exportFlashcardsAsMarkdown()
      const content = result[0].content
      expect(content).not.toContain('last_review')
      expect(content).not.toContain('last_rating')
      expect(content).not.toContain('undefined')
    })

    it('strips HTML tags from front and back content (C1 hotfix)', async () => {
      const fc = makeFlashcard({
        front: '<p>What is <strong>React</strong>?</p>',
        back: '<p>A <em>JavaScript</em> library for building <a href="#">user interfaces</a>.</p>',
      })
      mockFlashcardsToArray.mockResolvedValue([fc])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React' }])
      mockNotesToArray.mockResolvedValue([])

      const result = await exportFlashcardsAsMarkdown()
      const content = result[0].content

      // Body should have plain text, no HTML tags
      expect(content).toContain('# Q: What is React?')
      expect(content).toContain('A JavaScript library for building user interfaces.')
      expect(content).not.toContain('<p>')
      expect(content).not.toContain('</p>')
      expect(content).not.toContain('<strong>')
      expect(content).not.toContain('<em>')
      expect(content).not.toContain('<a href=')
    })

    it('handles filename collisions with counter suffix', async () => {
      const fc1 = makeFlashcard({ id: 'fc-1', front: 'What is React?' })
      const fc2 = makeFlashcard({ id: 'fc-2', front: 'What is React?' })

      mockFlashcardsToArray.mockResolvedValue([fc1, fc2])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React' }])
      mockNotesToArray.mockResolvedValue([])

      const result = await exportFlashcardsAsMarkdown()
      expect(result).toHaveLength(2)
      // Second file should have counter suffix
      expect(result[0].name).toContain('What-is-React.md')
      expect(result[1].name).toContain('What-is-React-1.md')
    })

    it('escapes quotes in tag values for YAML safety', async () => {
      const fc = makeFlashcard({ noteId: 'note-1' })
      mockFlashcardsToArray.mockResolvedValue([fc])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React "Hooks"' }])
      mockNotesToArray.mockResolvedValue([{ id: 'note-1', tags: ['say "hello"'] } as Note])

      const result = await exportFlashcardsAsMarkdown()
      const content = result[0].content
      // Tags should have internal quotes escaped
      expect(content).toContain('tags: ["react-hooks", "say \\"hello\\""]')
    })

    it('escapes quotes in flashcard front text for YAML', async () => {
      const fc = makeFlashcard({ front: 'What is "React"?', back: 'A "library".' })
      mockFlashcardsToArray.mockResolvedValue([fc])
      mockCoursesToArray.mockResolvedValue([{ id: 'course-1', name: 'React' }])
      mockNotesToArray.mockResolvedValue([])

      const result = await exportFlashcardsAsMarkdown()
      const content = result[0].content
      // Q/A body preserves original quotes
      expect(content).toContain('# Q: What is "React"?')
      // Deck name should be escaped in YAML
      expect(content).toContain('deck: "React"')
    })

    it('calls onProgress callback', async () => {
      mockFlashcardsToArray.mockResolvedValue([])
      const onProgress = vi.fn()

      await exportFlashcardsAsMarkdown(onProgress)
      expect(onProgress).toHaveBeenCalledWith(0, 'Loading flashcards...')
      expect(onProgress).toHaveBeenCalledWith(100, 'Complete')
    })
  })
})
