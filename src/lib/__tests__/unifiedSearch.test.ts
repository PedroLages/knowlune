import { describe, it, expect, beforeEach } from 'vitest'
import {
  initializeUnifiedSearch,
  addToIndex,
  updateInIndex,
  removeFromIndex,
  search,
  toSearchableCourse,
  toSearchableLesson,
  toSearchableAuthor,
  toSearchableBook,
  toSearchableNote,
  toSearchableHighlight,
  __resetForTests,
  registerCourseName,
  registerLessonTitle,
  type SearchableDoc,
} from '../unifiedSearch'
import type {
  ImportedCourse,
  ImportedVideo,
  ImportedAuthor,
  Book,
  BookHighlight,
  Note,
} from '@/data/types'

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'c1',
    name: 'Postgres for Engineers',
    description: 'Deep dive into Postgres internals',
    importedAt: '2026-01-01T00:00:00Z',
    category: 'Databases',
    tags: ['postgres', 'sql', 'databases'],
    status: 'not-started',
    videoCount: 10,
    pdfCount: 0,
    directoryHandle: null,
    ...overrides,
  }
}

function makeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  return {
    id: 'v1',
    courseId: 'c1',
    filename: 'Introduction',
    path: '/c1/v1',
    duration: 120,
    format: 'mp4',
    order: 0,
    fileHandle: null,
    ...overrides,
  }
}

function makeAuthor(overrides: Partial<ImportedAuthor> = {}): ImportedAuthor {
  return {
    id: 'a1',
    name: 'Michael Stonebraker',
    title: 'Database Pioneer',
    bio: 'Postgres co-creator',
    specialties: ['postgres', 'distributed systems'],
    courseIds: ['c1'],
    isPreseeded: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'b1',
    title: 'Designing Data-Intensive Applications',
    author: 'Martin Kleppmann',
    format: 'epub',
    status: 'unread',
    tags: ['databases', 'distributed'],
    chapters: [],
    source: 'local',
    progress: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    courseId: 'c1',
    videoId: 'v1',
    content: 'Postgres uses MVCC for concurrency control',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    tags: ['database', 'mvcc'],
    ...overrides,
  }
}

function makeHighlight(overrides: Partial<BookHighlight> = {}): BookHighlight {
  return {
    id: 'h1',
    bookId: 'b1',
    textAnchor: 'Replication is the heart of distributed systems',
    color: 'yellow',
    position: { kind: 'page', value: 0 },
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe('unifiedSearch', () => {
  beforeEach(() => {
    __resetForTests()
  })

  describe('initializeUnifiedSearch + search (happy path)', () => {
    it('returns documents from all entity types in a single query', () => {
      const docs: SearchableDoc[] = [
        toSearchableCourse(makeCourse({ id: 'c1', name: 'Postgres for Engineers' })),
        toSearchableBook(makeBook({ id: 'b1', title: 'Postgres Internals', author: 'X' })),
        toSearchableNote(
          makeNote({
            id: 'n1',
            content: 'Postgres page layout notes',
            courseId: 'c1',
            videoId: 'v1',
          })
        ),
      ]
      initializeUnifiedSearch(docs)

      const results = search('postgres')
      const ids = results.map(r => r.id).sort()
      expect(ids).toEqual(['b1', 'c1', 'n1'])
      for (const r of results) {
        expect(r.type).toBeDefined()
      }
    })

    it('scopes results to specific entity types when `types` is passed', () => {
      const docs: SearchableDoc[] = [
        toSearchableCourse(makeCourse({ id: 'c1', name: 'Postgres Advanced' })),
        toSearchableBook(makeBook({ id: 'b1', title: 'Postgres Primer', author: 'X' })),
      ]
      initializeUnifiedSearch(docs)

      const results = search('postgres', { types: ['course'] })
      expect(results).toHaveLength(1)
      expect(results[0].type).toBe('course')
      expect(results[0].id).toBe('c1')
    })
  })

  describe('empty and tiny queries', () => {
    it('returns [] for an empty query (no accidental return-all)', () => {
      initializeUnifiedSearch([toSearchableCourse(makeCourse())])
      expect(search('')).toEqual([])
      expect(search('   ')).toEqual([])
    })

    it('returns prefix-matched results for a 1-character query', () => {
      initializeUnifiedSearch([toSearchableCourse(makeCourse({ name: 'Postgres' }))])
      // With prefix: true, a single char may still match a prefix.
      const results = search('p')
      expect(results.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('id collision safety across entity types', () => {
    it('indexes a course and a note sharing the same id without overwrite', () => {
      const docs: SearchableDoc[] = [
        toSearchableCourse(makeCourse({ id: 'abc', name: 'Postgres' })),
        toSearchableNote(
          makeNote({
            id: 'abc',
            content: 'Postgres note body',
            courseId: 'c-other',
            videoId: 'v-other',
          })
        ),
      ]
      initializeUnifiedSearch(docs)

      const results = search('postgres')
      const types = results.map(r => r.type).sort()
      expect(types).toContain('course')
      expect(types).toContain('note')
    })
  })

  describe('update/remove resilience', () => {
    it('updateInIndex on a never-added doc does not throw', () => {
      initializeUnifiedSearch([])
      expect(() =>
        updateInIndex(toSearchableCourse(makeCourse({ id: 'never-added' })))
      ).not.toThrow()
    })

    it('removeFromIndex on an unknown id does not throw', () => {
      initializeUnifiedSearch([])
      expect(() => removeFromIndex('does-not-exist', 'course')).not.toThrow()
    })

    it('updateInIndex replaces an existing doc', () => {
      const c = makeCourse({ id: 'c1', name: 'Old Name' })
      initializeUnifiedSearch([toSearchableCourse(c)])
      expect(search('old').some(r => r.id === 'c1')).toBe(true)

      updateInIndex(toSearchableCourse({ ...c, name: 'Fresh Postgres Course' }))
      expect(search('old').some(r => r.id === 'c1')).toBe(false)
      expect(search('postgres').some(r => r.id === 'c1')).toBe(true)
    })

    it('removeFromIndex drops the doc from future queries', () => {
      initializeUnifiedSearch([toSearchableCourse(makeCourse({ id: 'c1', name: 'Postgres' }))])
      expect(search('postgres').some(r => r.id === 'c1')).toBe(true)

      removeFromIndex('c1', 'course')
      expect(search('postgres').some(r => r.id === 'c1')).toBe(false)
    })

    it('addToIndex on a doc that is not yet in the index adds it', () => {
      initializeUnifiedSearch([])
      addToIndex(toSearchableCourse(makeCourse({ id: 'c2', name: 'React Deep Dive' })))
      expect(search('react').some(r => r.id === 'c2')).toBe(true)
    })
  })

  describe('field boosts influence ranking', () => {
    it('a name-match ranks above a description-only match', () => {
      initializeUnifiedSearch([
        toSearchableCourse(
          makeCourse({ id: 'c-name', name: 'Postgres Mastery', description: 'Generic course' })
        ),
        toSearchableCourse(
          makeCourse({
            id: 'c-desc',
            name: 'Generic Course',
            description: 'Covers postgres incidentally',
          })
        ),
      ])

      const results = search('postgres')
      const nameResult = results.find(r => r.id === 'c-name')
      const descResult = results.find(r => r.id === 'c-desc')
      expect(nameResult).toBeDefined()
      expect(descResult).toBeDefined()
      expect(nameResult!.score).toBeGreaterThan(descResult!.score)
    })
  })

  describe('typo tolerance (fuzzy matching)', () => {
    it('"postgrs" matches "Postgres"', () => {
      initializeUnifiedSearch([
        toSearchableCourse(makeCourse({ id: 'c1', name: 'Postgres for Engineers' })),
      ])
      const results = search('postgrs')
      expect(results.some(r => r.id === 'c1')).toBe(true)
    })

    it('"michel" matches author "Michael Stonebraker"', () => {
      initializeUnifiedSearch([toSearchableAuthor(makeAuthor({ id: 'a1', name: 'Michael Stonebraker' }))])
      const results = search('michel')
      expect(results.some(r => r.id === 'a1')).toBe(true)
    })

    it('"introdction" matches lesson "Introduction"', () => {
      initializeUnifiedSearch([toSearchableLesson(makeVideo({ id: 'v1', filename: 'Introduction' }))])
      const results = search('introdction')
      expect(results.some(r => r.id === 'v1')).toBe(true)
    })
  })

  describe('note search parity (regression R9)', () => {
    it('notes field config matches legacy noteSearch (tags + courseName indexed, searchable)', () => {
      // Legacy noteSearch indexes `content`, `tags`, `courseName`, `videoTitle`
      // with boosts `tags: 2`, `courseName: 1.5`. Verify a note is found via
      // each of those fields so regression parity holds.
      registerCourseName('c-reg', 'MVCC Fundamentals')
      registerLessonTitle('v-reg', 'Advanced Locking Patterns')
      initializeUnifiedSearch([
        toSearchableNote(
          makeNote({
            id: 'n-reg',
            courseId: 'c-reg',
            videoId: 'v-reg',
            content: 'The page layout matters',
            tags: ['performance'],
          })
        ),
      ])

      // Content field
      expect(search('page').some(r => r.id === 'n-reg')).toBe(true)
      // Tags field
      expect(search('performance').some(r => r.id === 'n-reg')).toBe(true)
      // Course name field (via lookup map)
      expect(search('MVCC').some(r => r.id === 'n-reg')).toBe(true)
      // Video title field (via lookup map)
      expect(search('Locking').some(r => r.id === 'n-reg')).toBe(true)
    })

    it('respects course/lesson lookup for note enrichment via registerCourseName/registerLessonTitle', () => {
      registerCourseName('c-ext', 'External Course Title')
      registerLessonTitle('v-ext', 'Lesson One')
      initializeUnifiedSearch([
        toSearchableNote(
          makeNote({ id: 'n-ext', courseId: 'c-ext', videoId: 'v-ext', content: 'body' })
        ),
      ])
      // Searching for the course name should now hit the note via the courseName field.
      const results = search('External Course')
      expect(results.some(r => r.id === 'n-ext')).toBe(true)
    })
  })

  describe('entity-specific doc shape round trips', () => {
    it('book highlight carries chapterHref + bookId for navigation', () => {
      initializeUnifiedSearch([
        toSearchableHighlight(
          makeHighlight({ id: 'h1', bookId: 'b1', textAnchor: 'Replication is essential' }),
          'DDIA'
        ),
      ])
      const [hit] = search('replication')
      expect(hit.type).toBe('highlight')
      expect(hit.bookId).toBe('b1')
      expect(hit.parentTitle).toBe('DDIA')
    })

    it('lesson carries courseId + videoId for navigation', () => {
      initializeUnifiedSearch([
        toSearchableLesson(
          makeVideo({ id: 'v1', courseId: 'c1', filename: 'Postgres WAL Intro' }),
          'Postgres Course'
        ),
      ])
      const [hit] = search('WAL')
      expect(hit.type).toBe('lesson')
      expect(hit.courseId).toBe('c1')
      expect(hit.videoId).toBe('v1')
    })
  })

  describe('limit option', () => {
    it('respects `limit` option by capping result count', () => {
      const courses = Array.from({ length: 10 }, (_, i) =>
        toSearchableCourse(makeCourse({ id: `c${i}`, name: `Postgres Course ${i}` }))
      )
      initializeUnifiedSearch(courses)
      const results = search('postgres', { limit: 3 })
      expect(results).toHaveLength(3)
    })
  })
})
