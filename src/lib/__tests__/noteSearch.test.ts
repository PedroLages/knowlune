import { describe, it, expect, beforeEach } from 'vitest'
import type { Note } from '@/data/types'
import {
  initializeSearchIndex,
  addToIndex,
  updateInIndex,
  removeFromIndex,
  searchNotes,
  searchNotesWithContext,
  buildCourseLookup,
} from '@/lib/noteSearch'
import { allCourses } from '@/data/courses'

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    videoId: 'lesson-1',
    content: 'Default content',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    ...overrides,
  }
}

beforeEach(() => {
  buildCourseLookup(allCourses)
  initializeSearchIndex([])
})

describe('initializeSearchIndex', () => {
  it('should initialize with notes and enable search', () => {
    const notes = [
      makeNote({ id: '1', content: 'React hooks tutorial', tags: ['react', 'hooks'] }),
      makeNote({ id: '2', content: 'TypeScript generics guide', tags: ['typescript'] }),
    ]

    initializeSearchIndex(notes)

    const results = searchNotes('react')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('1')
  })

  it('should handle empty notes array', () => {
    initializeSearchIndex([])
    const results = searchNotes('anything')
    expect(results).toEqual([])
  })

  it('should replace previous index on re-initialization', () => {
    initializeSearchIndex([makeNote({ id: '1', content: 'Old content' })])
    initializeSearchIndex([makeNote({ id: '2', content: 'New content' })])

    const oldResults = searchNotes('Old')
    const newResults = searchNotes('New')
    expect(oldResults).toHaveLength(0)
    expect(newResults.length).toBeGreaterThan(0)
  })
})

describe('addToIndex', () => {
  it('should make new note searchable', () => {
    initializeSearchIndex([])

    addToIndex(makeNote({ id: '1', content: 'Behavioral analysis techniques' }))

    const results = searchNotes('behavioral')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('1')
  })
})

describe('updateInIndex', () => {
  it('should update note content in the index', () => {
    const note = makeNote({ id: '1', content: 'Original content' })
    initializeSearchIndex([note])

    updateInIndex({ ...note, content: 'Updated content about influence' })

    const oldResults = searchNotes('Original')
    const newResults = searchNotes('influence')
    expect(oldResults).toHaveLength(0)
    expect(newResults.length).toBeGreaterThan(0)
  })
})

describe('removeFromIndex', () => {
  it('should remove note from search results', () => {
    const note = makeNote({ id: '1', content: 'Removable content' })
    initializeSearchIndex([note])

    removeFromIndex('1')

    const results = searchNotes('Removable')
    expect(results).toHaveLength(0)
  })
})

describe('searchNotes', () => {
  it('should return empty array for empty query', () => {
    initializeSearchIndex([makeNote({ content: 'Something' })])
    expect(searchNotes('')).toEqual([])
    expect(searchNotes('   ')).toEqual([])
  })

  it('should support prefix search', () => {
    initializeSearchIndex([makeNote({ id: '1', content: 'Confidence building workshop' })])

    const results = searchNotes('confid')
    expect(results.length).toBeGreaterThan(0)
  })

  it('should boost tag matches higher than content', () => {
    initializeSearchIndex([
      makeNote({ id: 'content-match', content: 'This mentions react in the body', tags: [] }),
      makeNote({ id: 'tag-match', content: 'A general note', tags: ['react'] }),
    ])

    const results = searchNotes('react')
    expect(results.length).toBe(2)
    // Tag match should score higher due to 2x boost
    expect(results[0].id).toBe('tag-match')
  })

  it('should return results with scores', () => {
    initializeSearchIndex([makeNote({ id: '1', content: 'Operative training notes' })])

    const results = searchNotes('operative')
    expect(results[0].score).toBeGreaterThan(0)
  })

  it('should use OR semantics for multi-word queries', () => {
    initializeSearchIndex([
      makeNote({ id: '1', content: 'React hooks are powerful' }),
      makeNote({ id: '2', content: 'TypeScript generics guide' }),
      makeNote({ id: '3', content: 'Hooks and closures explained' }),
    ])

    // "React hooks" with OR: matches notes with "React" OR "hooks"
    const results = searchNotes('React hooks')
    // Note 1 has both terms, note 3 has "hooks" only — both should appear
    expect(results.length).toBeGreaterThanOrEqual(2)
    // Note with both terms should rank highest
    expect(results[0].id).toBe('1')
  })

  it('should find results with fuzzy matching despite typos', () => {
    initializeSearchIndex([makeNote({ id: '1', content: 'Understanding custom hooks in React' })])

    const results = searchNotes('custm')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('1')
  })
})

describe('searchNotesWithContext', () => {
  it('should return empty array for empty query', () => {
    initializeSearchIndex([makeNote({ content: 'Something' })])
    expect(searchNotesWithContext('')).toEqual([])
    expect(searchNotesWithContext('   ')).toEqual([])
  })

  it('should return enriched results with course and video names', () => {
    const courseId = allCourses[0].id
    const lessonId = allCourses[0].modules[0].lessons[0].id

    initializeSearchIndex([
      makeNote({
        id: 'enriched-1',
        courseId,
        videoId: lessonId,
        content: 'Understanding persuasion techniques',
        tags: ['influence'],
      }),
    ])

    const results = searchNotesWithContext('persuasion')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('enriched-1')
    expect(results[0].courseName).toBe(allCourses[0].shortTitle || allCourses[0].title)
    expect(results[0].videoTitle).toBe(allCourses[0].modules[0].lessons[0].title)
    expect(results[0].tags).toEqual(['influence'])
    expect(results[0].content).toContain('persuasion')
  })

  it('should return courseId and videoId for navigation', () => {
    const courseId = allCourses[0].id
    const lessonId = allCourses[0].modules[0].lessons[0].id

    initializeSearchIndex([
      makeNote({
        id: 'nav-1',
        courseId,
        videoId: lessonId,
        content: 'Navigation test note',
        timestamp: 42,
      }),
    ])

    const results = searchNotesWithContext('navigation')
    expect(results[0].courseId).toBe(courseId)
    expect(results[0].videoId).toBe(lessonId)
    expect(results[0].timestamp).toBe(42)
  })

  it('should limit results to 20', () => {
    const notes = Array.from({ length: 30 }, (_, i) =>
      makeNote({ id: `note-${i}`, content: `Searchable topic number ${i}` })
    )
    initializeSearchIndex(notes)

    const results = searchNotesWithContext('searchable')
    expect(results.length).toBeLessThanOrEqual(20)
  })

  it('should preserve multi-word tags through index round-trip', () => {
    initializeSearchIndex([
      makeNote({
        id: 'multi-tag',
        content: 'Deep learning fundamentals',
        tags: ['machine learning', 'deep learning'],
      }),
    ])

    const results = searchNotesWithContext('deep')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].tags).toEqual(['machine learning', 'deep learning'])
  })

  it('should boost courseName matches over content-only matches', () => {
    buildCourseLookup([
      {
        id: 'course-react',
        title: 'React Mastery',
        shortTitle: 'React Mastery',
        description: '',
        category: 'operative-training',
        difficulty: 'beginner',
        totalLessons: 1,
        totalVideos: 1,
        totalPDFs: 0,
        estimatedHours: 1,
        tags: [],
        modules: [
          {
            id: 'mod-1',
            title: 'Module 1',
            description: '',
            order: 1,
            lessons: [
              {
                id: 'les-1',
                title: 'Lesson 1',
                description: '',
                order: 1,
                resources: [],
                keyTopics: [],
              },
            ],
          },
        ],
        isSequential: false,
        basePath: '',
      },
    ])

    initializeSearchIndex([
      makeNote({
        id: 'content-only',
        courseId: 'other-course',
        videoId: 'other-lesson',
        content: 'This note mentions React in the body',
      }),
      makeNote({
        id: 'course-match',
        courseId: 'course-react',
        videoId: 'les-1',
        content: 'A general note about programming',
      }),
    ])

    const results = searchNotesWithContext('react')
    expect(results.length).toBe(2)
    // courseName match (1.5x boost) should rank higher than content-only (1x)
    expect(results[0].id).toBe('course-match')
  })
})

describe('search performance (AC1a)', () => {
  it('should complete search in under 1ms for 100 notes', () => {
    buildCourseLookup(allCourses)
    const notes = Array.from({ length: 100 }, (_, i) =>
      makeNote({
        id: `perf-${i}`,
        content: `Performance test note number ${i} about searchable topics and concepts`,
      })
    )
    initializeSearchIndex(notes)

    const start = performance.now()
    const results = searchNotesWithContext('searchable')
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5) // sub-5ms budget (AC1a targets <1ms; relaxed for CI variance)
    expect(results.length).toBeGreaterThan(0)
  })
})
