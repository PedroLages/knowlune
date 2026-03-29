import { describe, it, expect } from 'vitest'
import { jaccardSimilarity, interleaveReviews } from '../interleave'
import type { ReviewRecord, Note } from '@/data/types'

const FIXED_DATE = new Date('2026-03-15T12:00:00.000Z')
const DAY_MS = 86_400_000

function makeRecord(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: crypto.randomUUID(),
    noteId: 'note-1',
    rating: 'good',
    stability: 3,
    difficulty: 5,
    reps: 1,
    lapses: 0,
    state: 2 as const, // Review
    elapsed_days: 3,
    scheduled_days: 3,
    due: new Date(FIXED_DATE.getTime() - 1 * DAY_MS).toISOString(),
    last_review: new Date(FIXED_DATE.getTime() - 3 * DAY_MS).toISOString(),
    ...overrides,
  }
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    videoId: 'video-1',
    content: 'Test note',
    createdAt: FIXED_DATE.toISOString(),
    updatedAt: FIXED_DATE.toISOString(),
    tags: [],
    ...overrides,
  }
}

describe('jaccardSimilarity', () => {
  it('returns 0 for empty arrays', () => {
    expect(jaccardSimilarity([], [])).toBe(0)
    expect(jaccardSimilarity(['a'], [])).toBe(0)
    expect(jaccardSimilarity([], ['a'])).toBe(0)
  })

  it('returns 1 for identical arrays', () => {
    expect(jaccardSimilarity(['a', 'b'], ['a', 'b'])).toBe(1)
  })

  it('returns 0 for disjoint arrays', () => {
    expect(jaccardSimilarity(['a', 'b'], ['c', 'd'])).toBe(0)
  })

  it('returns correct fraction for partial overlap', () => {
    // intersection = {a}, union = {a, b, c} → 1/3
    expect(jaccardSimilarity(['a', 'b'], ['a', 'c'])).toBeCloseTo(1 / 3)
  })
})

describe('interleaveReviews', () => {
  it('returns empty for empty input', () => {
    const result = interleaveReviews([], new Map(), FIXED_DATE)
    expect(result).toEqual([])
  })

  it('returns single item unchanged', () => {
    const record = makeRecord({ id: 'r1', noteId: 'n1' })
    const note = makeNote({ id: 'n1' })
    const noteMap = new Map([[note.id, note]])

    const result = interleaveReviews([record], noteMap, FIXED_DATE)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r1')
  })

  it('spreads notes from same course with identical tags apart', () => {
    // 4 notes: 2 with tags [react] (course-1), 2 with tags [python] (course-2)
    // Expect interleaving: react, python, react, python (or similar alternation)
    const notes = [
      makeNote({ id: 'n1', courseId: 'c1', tags: ['react'] }),
      makeNote({ id: 'n2', courseId: 'c1', tags: ['react'] }),
      makeNote({ id: 'n3', courseId: 'c2', tags: ['python'] }),
      makeNote({ id: 'n4', courseId: 'c2', tags: ['python'] }),
    ]
    const noteMap = new Map(notes.map(n => [n.id, n]))

    // All due with similar retention so dissimilarity dominates
    const records = notes.map((n, i) =>
      makeRecord({
        id: `r${i}`,
        noteId: n.id,
        last_review: new Date(FIXED_DATE.getTime() - 3 * DAY_MS).toISOString(),
        due: new Date(FIXED_DATE.getTime() - 1 * DAY_MS).toISOString(),
        stability: 3,
      })
    )

    const result = interleaveReviews(records, noteMap, FIXED_DATE)
    expect(result).toHaveLength(4)

    // Consecutive cards should not have the same tags
    for (let i = 1; i < result.length; i++) {
      const prevTags = noteMap.get(result[i - 1].noteId)?.tags ?? []
      const currTags = noteMap.get(result[i].noteId)?.tags ?? []
      expect(jaccardSimilarity(prevTags, currTags)).toBeLessThan(1)
    }
  })

  it('prioritises urgency when tags are empty', () => {
    // Two notes with no tags — urgency should dominate
    const notes = [makeNote({ id: 'n-old', tags: [] }), makeNote({ id: 'n-new', tags: [] })]
    const noteMap = new Map(notes.map(n => [n.id, n]))

    const records = [
      makeRecord({
        id: 'r-old',
        noteId: 'n-old',
        last_review: new Date(FIXED_DATE.getTime() - 8 * DAY_MS).toISOString(),
        due: new Date(FIXED_DATE.getTime() - 5 * DAY_MS).toISOString(),
        stability: 3,
      }),
      makeRecord({
        id: 'r-new',
        noteId: 'n-new',
        last_review: new Date(FIXED_DATE.getTime() - 1 * DAY_MS).toISOString(),
        due: new Date(FIXED_DATE.getTime() - 0.5 * DAY_MS).toISOString(),
        stability: 3,
      }),
    ]

    const result = interleaveReviews(records, noteMap, FIXED_DATE)
    // Older review (8 days ago, lower retention) should come first
    expect(result[0].id).toBe('r-old')
    expect(result[1].id).toBe('r-new')
  })

  it('handles notes missing from noteMap gracefully', () => {
    const record = makeRecord({ id: 'r1', noteId: 'missing-note' })
    // Empty noteMap — note not found
    const result = interleaveReviews([record], new Map(), FIXED_DATE)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r1')
  })
})
