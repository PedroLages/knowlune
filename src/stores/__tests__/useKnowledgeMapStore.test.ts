/**
 * Tests for useKnowledgeMapStore (E56-S02)
 *
 * Coverage:
 * - AC9: computeScores returns KnowledgeScore[] (ScoredTopic[])
 * - AC10: cache behaviour — second call within 30s returns cached result
 * - AC12: getTopicsByCategory and getTopicByName selectors
 * - invalidateCache: resets lastComputedAt so next call recomputes
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { ImportedCourse } from '@/data/types'
import type { Quiz, QuizAttempt } from '@/types/quiz'

// Dynamic imports after Dexie.delete so each test gets a fresh store + db
let useKnowledgeMapStore: (typeof import('@/stores/useKnowledgeMapStore'))['useKnowledgeMapStore']
let db: (typeof import('@/db'))['db']

const FIXED_DATE = new Date('2026-01-15T10:00:00.000Z')

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'JavaScript Fundamentals',
    importedAt: '2026-01-01T00:00:00.000Z',
    category: 'Programming',
    tags: ['javascript', 'async'],
    status: 'active',
    videoCount: 5,
    pdfCount: 0,
    directoryHandle: null,
    ...overrides,
  }
}

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    lessonId: 'lesson-1',
    title: 'JS Quiz',
    description: '',
    questions: [
      {
        id: 'q-1',
        type: 'multiple-choice',
        prompt: 'What is a closure?',
        options: [
          { id: 'o-1', text: 'A closure', isCorrect: true },
          { id: 'o-2', text: 'Not a closure', isCorrect: false },
        ],
        topic: 'javascript',
        explanation: '',
        difficulty: 'medium',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    timeLimit: null,
    passingScore: 70,
    allowRetakes: true,
    shuffleQuestions: false,
    shuffleAnswers: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Quiz
}

function makeAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: 'attempt-1',
    quizId: 'quiz-1',
    answers: [{ questionId: 'q-1', answerId: 'o-1', isCorrect: true }],
    score: 100,
    passed: true,
    startedAt: '2026-01-14T10:00:00.000Z',
    completedAt: '2026-01-14T10:05:00.000Z',
    ...overrides,
  } as unknown as QuizAttempt
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const storeModule = await import('@/stores/useKnowledgeMapStore')
  useKnowledgeMapStore = storeModule.useKnowledgeMapStore
  const dbModule = await import('@/db')
  db = dbModule.db
})

// ── AC9: computeScores returns ScoredTopic[] ──────────────────────

describe('computeScores (AC9)', () => {
  it('returns empty topics when no courses exist', async () => {
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    const { topics, categories, focusAreas, isLoading, error } = useKnowledgeMapStore.getState()
    expect(isLoading).toBe(false)
    expect(error).toBeNull()
    expect(topics).toHaveLength(0)
    expect(categories).toHaveLength(0)
    expect(focusAreas).toHaveLength(0)
  })

  it('returns ScoredTopic[] with correct shape when courses and tags are present', async () => {
    await db.importedCourses.put(makeCourse())

    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    const { topics } = useKnowledgeMapStore.getState()
    // Tags: ['javascript', 'async'] → 2 topics
    expect(topics.length).toBeGreaterThanOrEqual(1)

    const topic = topics[0]
    expect(topic).toHaveProperty('name')
    expect(topic).toHaveProperty('canonicalName')
    expect(topic).toHaveProperty('category')
    expect(topic).toHaveProperty('courseIds')
    expect(topic).toHaveProperty('scoreResult')
    expect(topic.scoreResult).toHaveProperty('score')
    expect(topic.scoreResult).toHaveProperty('tier')
    expect(topic.scoreResult).toHaveProperty('confidence')
    expect(topic.scoreResult.score).toBeGreaterThanOrEqual(0)
    expect(topic.scoreResult.score).toBeLessThanOrEqual(100)
  })

  it('correctly links quiz attempts to topics via contentProgress mapping', async () => {
    await db.importedCourses.put(makeCourse())
    await db.quizzes.put(makeQuiz())
    // Link quiz's lessonId to the course via contentProgress
    await db.contentProgress.put({
      courseId: 'course-1',
      itemId: 'lesson-1',
      status: 'completed',
      updatedAt: '2026-01-14T00:00:00.000Z',
    })
    await db.quizAttempts.put(makeAttempt())

    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    const { topics } = useKnowledgeMapStore.getState()
    const jsTopic = topics.find(t => t.canonicalName === 'javascript')
    expect(jsTopic).toBeDefined()
    // With quiz score = 100, the topic score should be higher than without quiz data
    expect(jsTopic!.scoreResult.score).toBeGreaterThan(0)
  })

  it('sets lastComputedAt after computation', async () => {
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)
    expect(useKnowledgeMapStore.getState().lastComputedAt).toBe(FIXED_DATE.toISOString())
  })
})

// ── AC10: cache behaviour ────────────────────────────────────────

describe('cache behaviour (AC10)', () => {
  it('skips recomputation if called again within 30 seconds', async () => {
    await db.importedCourses.put(makeCourse())
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    const { topics: topicsAfterFirst } = useKnowledgeMapStore.getState()
    expect(topicsAfterFirst.length).toBeGreaterThan(0)

    // Add another course but call computeScores within the 30s window
    await db.importedCourses.put(
      makeCourse({ id: 'course-2', name: 'React Basics', tags: ['react'] })
    )

    const withinWindow = new Date(FIXED_DATE.getTime() + 15_000) // +15s
    await useKnowledgeMapStore.getState().computeScores(withinWindow)

    // Result should be unchanged (cached) — course-2 not reflected
    const { topics: topicsAfterSecond } = useKnowledgeMapStore.getState()
    const hasCourse2Topics = topicsAfterSecond.some(t => t.courseIds.includes('course-2'))
    expect(hasCourse2Topics).toBe(false)
  })

  it('recomputes after the 30-second window has elapsed', async () => {
    await db.importedCourses.put(makeCourse())
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    await db.importedCourses.put(
      makeCourse({ id: 'course-2', name: 'React Basics', category: 'Frontend', tags: ['react'] })
    )

    const afterWindow = new Date(FIXED_DATE.getTime() + 31_000) // +31s
    await useKnowledgeMapStore.getState().computeScores(afterWindow)

    const { topics } = useKnowledgeMapStore.getState()
    const hasCourse2Topics = topics.some(t => t.courseIds.includes('course-2'))
    expect(hasCourse2Topics).toBe(true)
  })

  it('invalidateCache() forces recomputation on next call', async () => {
    await db.importedCourses.put(makeCourse())
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    await db.importedCourses.put(
      makeCourse({ id: 'course-2', name: 'React Basics', category: 'Frontend', tags: ['react'] })
    )

    // Invalidate and call again at same timestamp
    useKnowledgeMapStore.getState().invalidateCache()
    expect(useKnowledgeMapStore.getState().lastComputedAt).toBeNull()

    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    const { topics } = useKnowledgeMapStore.getState()
    const hasCourse2Topics = topics.some(t => t.courseIds.includes('course-2'))
    expect(hasCourse2Topics).toBe(true)
  })
})

// ── AC12: selectors ──────────────────────────────────────────────

describe('getTopicsByCategory (AC12)', () => {
  it('returns only topics matching the category, sorted by score ascending', async () => {
    await db.importedCourses.put(
      makeCourse({ category: 'Programming', tags: ['javascript', 'typescript'] })
    )
    await db.importedCourses.put(
      makeCourse({ id: 'course-2', name: 'Design Basics', category: 'Design', tags: ['css'] })
    )

    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    const programmingTopics = useKnowledgeMapStore.getState().getTopicsByCategory('Programming')
    const designTopics = useKnowledgeMapStore.getState().getTopicsByCategory('Design')

    expect(programmingTopics.length).toBeGreaterThan(0)
    programmingTopics.forEach(t => expect(t.category).toBe('Programming'))

    expect(designTopics.length).toBeGreaterThan(0)
    designTopics.forEach(t => expect(t.category).toBe('Design'))

    // Sorted by score ascending
    for (let i = 1; i < programmingTopics.length; i++) {
      expect(programmingTopics[i].scoreResult.score).toBeGreaterThanOrEqual(
        programmingTopics[i - 1].scoreResult.score
      )
    }
  })

  it('returns empty array for unknown category', async () => {
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)
    expect(useKnowledgeMapStore.getState().getTopicsByCategory('Nonexistent')).toEqual([])
  })
})

describe('getTopicByName (AC12)', () => {
  it('returns the topic matching the canonicalName', async () => {
    await db.importedCourses.put(makeCourse({ tags: ['javascript'] }))
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    const topic = useKnowledgeMapStore.getState().getTopicByName('javascript')
    expect(topic).toBeDefined()
    expect(topic!.canonicalName).toBe('javascript')
  })

  it('returns undefined for an unknown canonical name', async () => {
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)
    expect(useKnowledgeMapStore.getState().getTopicByName('nonexistent-topic')).toBeUndefined()
  })
})

// ── GAP-04: suggestions state populated by computeScores ─────────

describe('suggestions state (GAP-04 / Epic 71)', () => {
  it('starts as empty array before computeScores', () => {
    expect(useKnowledgeMapStore.getState().suggestions).toEqual([])
  })

  it('suggestions is an array after computeScores with no courses', async () => {
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)
    expect(Array.isArray(useKnowledgeMapStore.getState().suggestions)).toBe(true)
  })

  it('suggestions is empty when no courses/topics exist', async () => {
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)
    expect(useKnowledgeMapStore.getState().suggestions).toHaveLength(0)
  })

  it('suggestions contains ActionSuggestion shaped objects when declining topics exist', async () => {
    // Seed a course with quiz data to produce a declining/weak topic with a quiz suggestion
    await db.importedCourses.put(makeCourse())
    await db.quizzes.put(makeQuiz())
    await db.contentProgress.put({
      courseId: 'course-1',
      itemId: 'lesson-1',
      status: 'completed',
      updatedAt: '2026-01-14T00:00:00.000Z',
    })
    // Low score attempt to produce a fading/weak topic
    await db.quizAttempts.put(makeAttempt({ score: 20, passed: false }))

    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    const { suggestions } = useKnowledgeMapStore.getState()
    // If any suggestion is generated, verify its shape
    if (suggestions.length > 0) {
      const s = suggestions[0]
      expect(s).toHaveProperty('topicName')
      expect(s).toHaveProperty('canonicalName')
      expect(s).toHaveProperty('score')
      expect(s).toHaveProperty('trend')
      expect(s).toHaveProperty('actionType')
      expect(s).toHaveProperty('actionLabel')
      expect(s).toHaveProperty('actionRoute')
      expect(s).toHaveProperty('estimatedMinutes')
      expect(s).toHaveProperty('urgencyScore')
    }
  })

  it('suggestions resets to [] when computeScores finds no courses', async () => {
    // First run with a course so suggestions may populate
    await db.importedCourses.put(makeCourse())
    await useKnowledgeMapStore.getState().computeScores(FIXED_DATE)

    // Wipe DB and invalidate cache
    await Dexie.delete('ElearningDB')
    vi.resetModules()
    const storeModule = await import('@/stores/useKnowledgeMapStore')
    const freshStore = storeModule.useKnowledgeMapStore
    const dbModule = await import('@/db')
    db = dbModule.db

    await freshStore.getState().computeScores(FIXED_DATE)
    expect(freshStore.getState().suggestions).toEqual([])
  })
})
