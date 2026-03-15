import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Note } from '@/data/types'
import { FIXED_DATE } from '../../../tests/utils/test-time'
import { findRelatedNotes } from '@/lib/relatedConcepts'

// Mock dependencies
vi.mock('@/ai/vector-store', () => ({
  vectorStorePersistence: {
    getStore: vi.fn(() => ({ size: 0, search: vi.fn(() => []) })),
  },
}))

vi.mock('@/db', () => ({
  db: {
    embeddings: {
      get: vi.fn(() => Promise.resolve(undefined)),
    },
  },
}))

vi.mock('@/lib/textUtils', () => ({
  stripHtml: vi.fn((html: string) =>
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

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    courseId: 'course-1',
    videoId: 'lesson-1',
    content: 'Default content',
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    tags: [],
    ...overrides,
  }
}

function makeCourseNames(...entries: [string, string][]): Map<string, string> {
  return new Map(entries)
}

describe('relatedConcepts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findRelatedNotes', () => {
    it('returns empty array when no candidates', async () => {
      const source = makeNote({ id: 'src', tags: ['react'] })
      const result = await findRelatedNotes(source, [source], makeCourseNames())
      expect(result).toEqual([])
    })

    it('returns empty array when allNotes is empty', async () => {
      const source = makeNote({ id: 'src', tags: ['react'] })
      const result = await findRelatedNotes(source, [], makeCourseNames())
      expect(result).toEqual([])
    })

    it('excludes deleted notes from candidates', async () => {
      const source = makeNote({ id: 'src', tags: ['react'] })
      const deleted = makeNote({
        id: 'del',
        tags: ['react'],
        deleted: true,
        content: 'Deleted note',
      })
      const result = await findRelatedNotes(source, [source, deleted], makeCourseNames())
      expect(result).toEqual([])
    })

    it('excludes the source note itself', async () => {
      const source = makeNote({ id: 'src', tags: ['react'] })
      const result = await findRelatedNotes(source, [source], makeCourseNames())
      expect(result).toEqual([])
    })

    it('finds tag-based matches', async () => {
      const source = makeNote({ id: 'src', tags: ['react', 'hooks'] })
      const match = makeNote({
        id: 'match-1',
        tags: ['react'],
        content: 'React patterns overview',
        courseId: 'c1',
      })
      const courseNames = makeCourseNames(['c1', 'React Course'])

      const result = await findRelatedNotes(source, [source, match], courseNames)

      expect(result).toHaveLength(1)
      expect(result[0].noteId).toBe('match-1')
      expect(result[0].sharedTags).toEqual(['react'])
      expect(result[0].tagOnly).toBe(true)
      expect(result[0].courseName).toBe('React Course')
    })

    it('returns empty when source has no tags and vector store is empty', async () => {
      const source = makeNote({ id: 'src', tags: [] })
      const other = makeNote({ id: 'other', tags: ['react'] })
      const result = await findRelatedNotes(source, [source, other], makeCourseNames())
      expect(result).toEqual([])
    })

    it('sorts tag matches by number of shared tags (descending)', async () => {
      const source = makeNote({ id: 'src', tags: ['react', 'hooks', 'state'] })
      const oneTag = makeNote({ id: 'one', tags: ['react'], content: 'One tag match' })
      const twoTags = makeNote({
        id: 'two',
        tags: ['react', 'hooks'],
        content: 'Two tag match',
      })
      const threeTags = makeNote({
        id: 'three',
        tags: ['react', 'hooks', 'state'],
        content: 'Three tag match',
      })

      const result = await findRelatedNotes(
        source,
        [source, oneTag, twoTags, threeTags],
        makeCourseNames()
      )

      expect(result).toHaveLength(3)
      expect(result[0].noteId).toBe('three')
      expect(result[0].sharedTags).toHaveLength(3)
      expect(result[1].noteId).toBe('two')
      expect(result[1].sharedTags).toHaveLength(2)
      expect(result[2].noteId).toBe('one')
      expect(result[2].sharedTags).toHaveLength(1)
    })

    it('falls back to courseId when courseNames map has no entry', async () => {
      const source = makeNote({ id: 'src', tags: ['react'] })
      const match = makeNote({
        id: 'match',
        tags: ['react'],
        courseId: 'unknown-course',
        content: 'Some content',
      })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())
      expect(result[0].courseName).toBe('unknown-course')
    })

    it('extracts shared terms from content', async () => {
      const source = makeNote({
        id: 'src',
        tags: ['javascript'],
        content: 'Understanding closures and scoping in JavaScript',
      })
      const match = makeNote({
        id: 'match',
        tags: ['javascript'],
        content: 'Closures are fundamental to JavaScript scoping',
      })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())

      expect(result).toHaveLength(1)
      expect(result[0].sharedTerms).toContain('closures')
      expect(result[0].sharedTerms).toContain('javascript')
      expect(result[0].sharedTerms).toContain('scoping')
    })

    it('filters stopwords from shared terms', async () => {
      const source = makeNote({
        id: 'src',
        tags: ['test'],
        content: 'The quick brown fox is very fast',
      })
      const match = makeNote({
        id: 'match',
        tags: ['test'],
        content: 'The very quick brown fox jumps high',
      })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())

      // 'the', 'is', 'very' are stopwords and should not appear
      expect(result[0].sharedTerms).not.toContain('the')
      expect(result[0].sharedTerms).not.toContain('very')
      expect(result[0].sharedTerms).toContain('quick')
      expect(result[0].sharedTerms).toContain('brown')
      expect(result[0].sharedTerms).toContain('fox')
    })

    it('filters words shorter than 3 characters from terms', async () => {
      const source = makeNote({
        id: 'src',
        tags: ['test'],
        content: 'An ox is by us at go',
      })
      const match = makeNote({
        id: 'match',
        tags: ['test'],
        content: 'An ox is by us at go',
      })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())
      // All words are either stopwords or < 3 chars
      expect(result[0].sharedTerms).toEqual([])
    })

    it('extracts title from first line of content', async () => {
      const source = makeNote({ id: 'src', tags: ['react'] })
      const match = makeNote({
        id: 'match',
        tags: ['react'],
        content: 'React Hooks Guide\nDetailed explanation of hooks',
      })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())
      expect(result[0].title).toBe('React Hooks Guide')
    })

    it('truncates long titles to 60 chars with ellipsis', async () => {
      const source = makeNote({ id: 'src', tags: ['react'] })
      const longTitle =
        'A very long title that exceeds sixty characters and should be truncated with an ellipsis character'
      const match = makeNote({
        id: 'match',
        tags: ['react'],
        content: longTitle,
      })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())
      expect(result[0].title.length).toBeLessThanOrEqual(61) // 60 + ellipsis
      expect(result[0].title).toContain('\u2026')
    })

    it('strips HTML from content for title extraction', async () => {
      const source = makeNote({ id: 'src', tags: ['react'] })
      const match = makeNote({
        id: 'match',
        tags: ['react'],
        content: '<h1>React Guide</h1><p>Details here</p>',
      })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())
      expect(result[0].title).toBe('React GuideDetails here')
    })

    it('limits results to maximum 5', async () => {
      const source = makeNote({ id: 'src', tags: ['common'] })
      const candidates = Array.from({ length: 10 }, (_, i) =>
        makeNote({
          id: `note-${i}`,
          tags: ['common'],
          content: `Note number ${i}`,
        })
      )

      const result = await findRelatedNotes(source, [source, ...candidates], makeCourseNames())
      expect(result.length).toBeLessThanOrEqual(5)
    })

    it('handles vector search timeout gracefully (falls back to tag-only)', async () => {
      // Vector store returns empty due to size: 0 mock, so this tests graceful fallback
      const source = makeNote({ id: 'src', tags: ['react'] })
      const match = makeNote({ id: 'match', tags: ['react'], content: 'React stuff' })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())

      expect(result).toHaveLength(1)
      expect(result[0].tagOnly).toBe(true)
    })

    it('handles vector search failure gracefully', async () => {
      const { vectorStorePersistence } = await import('@/ai/vector-store')
      vi.mocked(vectorStorePersistence.getStore).mockImplementation(() => {
        throw new Error('Vector store unavailable')
      })

      const source = makeNote({ id: 'src', tags: ['react'] })
      const match = makeNote({ id: 'match', tags: ['react'], content: 'React content' })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())

      expect(result).toHaveLength(1)
      expect(result[0].tagOnly).toBe(true)
    })

    it('handles notes with duplicate tags', async () => {
      const source = makeNote({ id: 'src', tags: ['react', 'react'] })
      const match = makeNote({
        id: 'match',
        tags: ['react'],
        content: 'React content',
      })

      const result = await findRelatedNotes(source, [source, match], makeCourseNames())
      expect(result).toHaveLength(1)
      // Should still find the match
      expect(result[0].sharedTags).toContain('react')
    })
  })

  describe('findRelatedNotes with vector matches', () => {
    it('includes vector matches with similarity scores', async () => {
      const { vectorStorePersistence } = await import('@/ai/vector-store')
      const { db } = await import('@/db')

      const mockSearch = vi.fn(() => [
        { id: 'vec-match', similarity: 0.85 },
      ])
      vi.mocked(vectorStorePersistence.getStore).mockReturnValue({
        size: 5,
        search: mockSearch,
      } as never)
      vi.mocked(db.embeddings.get).mockResolvedValue({
        id: 'src',
        embedding: [0.1, 0.2, 0.3],
      } as never)

      const source = makeNote({ id: 'src', tags: [] })
      const vecMatch = makeNote({
        id: 'vec-match',
        tags: ['ai'],
        content: 'Vector matched content',
        courseId: 'c1',
      })
      const courseNames = makeCourseNames(['c1', 'AI Course'])

      const result = await findRelatedNotes(source, [source, vecMatch], courseNames)

      expect(result).toHaveLength(1)
      expect(result[0].noteId).toBe('vec-match')
      expect(result[0].similarityScore).toBe(0.85)
      expect(result[0].tagOnly).toBe(false)
      expect(result[0].courseName).toBe('AI Course')
    })

    it('filters vector results with similarity <= 0.3', async () => {
      const { vectorStorePersistence } = await import('@/ai/vector-store')
      const { db } = await import('@/db')

      const mockSearch = vi.fn(() => [
        { id: 'low-sim', similarity: 0.2 },
      ])
      vi.mocked(vectorStorePersistence.getStore).mockReturnValue({
        size: 5,
        search: mockSearch,
      } as never)
      vi.mocked(db.embeddings.get).mockResolvedValue({
        id: 'src',
        embedding: [0.1, 0.2],
      } as never)

      const source = makeNote({ id: 'src', tags: [] })
      const lowSim = makeNote({ id: 'low-sim', tags: [], content: 'Low similarity' })

      const result = await findRelatedNotes(source, [source, lowSim], makeCourseNames())
      expect(result).toEqual([])
    })

    it('excludes source note from vector results', async () => {
      const { vectorStorePersistence } = await import('@/ai/vector-store')
      const { db } = await import('@/db')

      const mockSearch = vi.fn(() => [
        { id: 'src', similarity: 1.0 },
        { id: 'other', similarity: 0.7 },
      ])
      vi.mocked(vectorStorePersistence.getStore).mockReturnValue({
        size: 5,
        search: mockSearch,
      } as never)
      vi.mocked(db.embeddings.get).mockResolvedValue({
        id: 'src',
        embedding: [0.1],
      } as never)

      const source = makeNote({ id: 'src', tags: [] })
      const other = makeNote({ id: 'other', tags: [], content: 'Other note' })

      const result = await findRelatedNotes(source, [source, other], makeCourseNames())
      expect(result).toHaveLength(1)
      expect(result[0].noteId).toBe('other')
    })

    it('returns empty when no embedding exists for source note', async () => {
      const { vectorStorePersistence } = await import('@/ai/vector-store')
      const { db } = await import('@/db')

      vi.mocked(vectorStorePersistence.getStore).mockReturnValue({
        size: 5,
        search: vi.fn(() => []),
      } as never)
      vi.mocked(db.embeddings.get).mockResolvedValue(undefined)

      const source = makeNote({ id: 'src', tags: [] })
      const other = makeNote({ id: 'other', tags: [], content: 'Other' })

      const result = await findRelatedNotes(source, [source, other], makeCourseNames())
      expect(result).toEqual([])
    })

    it('merges vector and tag matches, deduplicating by noteId', async () => {
      const { vectorStorePersistence } = await import('@/ai/vector-store')
      const { db } = await import('@/db')

      const mockSearch = vi.fn(() => [
        { id: 'overlap', similarity: 0.8 },
      ])
      vi.mocked(vectorStorePersistence.getStore).mockReturnValue({
        size: 5,
        search: mockSearch,
      } as never)
      vi.mocked(db.embeddings.get).mockResolvedValue({
        id: 'src',
        embedding: [0.1],
      } as never)

      const source = makeNote({ id: 'src', tags: ['react'] })
      const overlap = makeNote({
        id: 'overlap',
        tags: ['react'],
        content: 'React and hooks',
      })

      const result = await findRelatedNotes(source, [source, overlap], makeCourseNames())

      // Should be deduplicated — only one entry for 'overlap'
      expect(result).toHaveLength(1)
      expect(result[0].noteId).toBe('overlap')
      // Vector match should provide the similarity score
      expect(result[0].similarityScore).toBe(0.8)
      // Should merge tags from both sources
      expect(result[0].sharedTags).toContain('react')
    })

    it('sorts vector matches before tag-only matches', async () => {
      const { vectorStorePersistence } = await import('@/ai/vector-store')
      const { db } = await import('@/db')

      const mockSearch = vi.fn(() => [
        { id: 'vec-1', similarity: 0.6 },
      ])
      vi.mocked(vectorStorePersistence.getStore).mockReturnValue({
        size: 5,
        search: mockSearch,
      } as never)
      vi.mocked(db.embeddings.get).mockResolvedValue({
        id: 'src',
        embedding: [0.1],
      } as never)

      const source = makeNote({ id: 'src', tags: ['react', 'hooks', 'state'] })
      const tagOnly = makeNote({
        id: 'tag-only',
        tags: ['react', 'hooks', 'state'],
        content: 'Tag match with 3 tags',
      })
      const vecMatch = makeNote({
        id: 'vec-1',
        tags: [],
        content: 'Vector match content',
      })

      const result = await findRelatedNotes(
        source,
        [source, tagOnly, vecMatch],
        makeCourseNames()
      )

      // Vector match should come first even with fewer shared tags
      expect(result[0].noteId).toBe('vec-1')
      expect(result[0].similarityScore).toBe(0.6)
      expect(result[1].noteId).toBe('tag-only')
      expect(result[1].tagOnly).toBe(true)
    })

    it('sorts multiple vector matches by similarity descending', async () => {
      const { vectorStorePersistence } = await import('@/ai/vector-store')
      const { db } = await import('@/db')

      const mockSearch = vi.fn(() => [
        { id: 'low', similarity: 0.5 },
        { id: 'high', similarity: 0.9 },
        { id: 'mid', similarity: 0.7 },
      ])
      vi.mocked(vectorStorePersistence.getStore).mockReturnValue({
        size: 10,
        search: mockSearch,
      } as never)
      vi.mocked(db.embeddings.get).mockResolvedValue({
        id: 'src',
        embedding: [0.1],
      } as never)

      const source = makeNote({ id: 'src', tags: [] })
      const low = makeNote({ id: 'low', tags: [], content: 'Low similarity' })
      const high = makeNote({ id: 'high', tags: [], content: 'High similarity' })
      const mid = makeNote({ id: 'mid', tags: [], content: 'Mid similarity' })

      const result = await findRelatedNotes(
        source,
        [source, low, high, mid],
        makeCourseNames()
      )

      expect(result[0].noteId).toBe('high')
      expect(result[1].noteId).toBe('mid')
      expect(result[2].noteId).toBe('low')
    })
  })
})
