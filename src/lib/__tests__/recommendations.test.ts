import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeCompositeScore, getRecommendedCourses } from '@/lib/recommendations'
import type { Course } from '@/data/types'
import type { CourseProgress } from '@/lib/progress'

// Pin time to a fixed point for deterministic recency calculations
const FIXED_NOW = new Date('2026-03-08T10:00:00.000Z')

// ── Factories ─────────────────────────────────────────────────────────

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course-1',
    title: 'Test Course',
    shortTitle: 'Test',
    description: 'A test course',
    category: 'behavioral-analysis',
    difficulty: 'beginner',
    totalLessons: 10,
    totalVideos: 8,
    totalPDFs: 2,
    estimatedHours: 5,
    tags: [],
    modules: [
      {
        id: 'mod-1',
        title: 'Module 1',
        description: '',
        order: 1,
        lessons: Array.from({ length: 10 }, (_, i) => ({
          id: `lesson-${i + 1}`,
          title: `Lesson ${i + 1}`,
          description: '',
          order: i + 1,
          resources: [],
          keyTopics: [],
        })),
      },
    ],
    isSequential: false,
    basePath: '/courses/test',
    authorId: 'author-1',
    ...overrides,
  }
}

function makeProgress(courseId: string, completedCount: number, daysAgo: number): CourseProgress {
  const date = new Date(FIXED_NOW)
  date.setDate(date.getDate() - daysAgo)
  return {
    courseId,
    completedLessons: Array.from({ length: completedCount }, (_, i) => `lesson-${i + 1}`),
    notes: {},
    startedAt: date.toISOString(),
    lastAccessedAt: date.toISOString(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('computeCompositeScore', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a score between 0 and 1', () => {
    const course = makeCourse({ totalLessons: 10 })
    const progress = makeProgress('course-1', 5, 5)
    const score = computeCompositeScore(course, progress, 3)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('scores higher for more recent access', () => {
    const course = makeCourse({ totalLessons: 10 })
    const recentProgress = makeProgress('course-1', 5, 1) // 1 day ago
    const oldProgress = makeProgress('course-1', 5, 20) // 20 days ago

    const recentScore = computeCompositeScore(course, recentProgress, 0)
    const oldScore = computeCompositeScore(course, oldProgress, 0)

    expect(recentScore).toBeGreaterThan(oldScore)
  })

  it('scores higher for higher completion percentage', () => {
    const course = makeCourse({ totalLessons: 10 })
    const highProgress = makeProgress('course-1', 9, 5) // 90% complete
    const lowProgress = makeProgress('course-1', 2, 5) // 20% complete

    const highScore = computeCompositeScore(course, highProgress, 0)
    const lowScore = computeCompositeScore(course, lowProgress, 0)

    expect(highScore).toBeGreaterThan(lowScore)
  })

  it('scores higher with more sessions (frequency)', () => {
    const course = makeCourse({ totalLessons: 10 })
    const progress = makeProgress('course-1', 5, 5)

    const manySessionsScore = computeCompositeScore(course, progress, 10)
    const fewSessionsScore = computeCompositeScore(course, progress, 0)

    expect(manySessionsScore).toBeGreaterThan(fewSessionsScore)
  })

  it('caps frequency score at 1.0 (10+ sessions)', () => {
    const course = makeCourse({ totalLessons: 10 })
    const progress = makeProgress('course-1', 5, 5)

    const score10 = computeCompositeScore(course, progress, 10)
    const score20 = computeCompositeScore(course, progress, 20)

    // 10 and 20 sessions should produce identical scores (both cap at 1.0)
    expect(score10).toBe(score20)
  })

  it('gives 0 recency score after 30+ days', () => {
    const course = makeCourse({ totalLessons: 10 })
    const oldProgress = makeProgress('course-1', 5, 30)
    const olderProgress = makeProgress('course-1', 5, 60)

    const oldScore = computeCompositeScore(course, oldProgress, 0)
    const olderScore = computeCompositeScore(course, olderProgress, 0)

    // Both should have 0 recency — identical recency contribution
    expect(oldScore).toBe(olderScore)
  })
})

describe('getRecommendedCourses', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty array when no active courses', () => {
    const courses = [makeCourse({ id: 'course-1', totalLessons: 10 })]
    const result = getRecommendedCourses(courses, {}, {})
    expect(result).toEqual([])
  })

  it('excludes courses with 0 completed lessons (not started)', () => {
    const courses = [makeCourse({ id: 'course-1', totalLessons: 10 })]
    const allProgress = { 'course-1': makeProgress('course-1', 0, 5) }
    const result = getRecommendedCourses(courses, allProgress, {})
    expect(result).toEqual([])
  })

  it('excludes courses at 100% completion (finished)', () => {
    const courses = [makeCourse({ id: 'course-1', totalLessons: 10 })]
    const allProgress = { 'course-1': makeProgress('course-1', 10, 5) }
    const result = getRecommendedCourses(courses, allProgress, {})
    expect(result).toEqual([])
  })

  it('returns all courses when fewer than limit active courses', () => {
    const courses = [
      makeCourse({ id: 'course-1', totalLessons: 10 }),
      makeCourse({ id: 'course-2', totalLessons: 10 }),
    ]
    const allProgress = {
      'course-1': makeProgress('course-1', 5, 3),
      'course-2': makeProgress('course-2', 3, 5),
    }
    const result = getRecommendedCourses(courses, allProgress, {})
    expect(result).toHaveLength(2)
  })

  it('returns at most 3 courses by default', () => {
    const courses = Array.from({ length: 5 }, (_, i) =>
      makeCourse({ id: `course-${i + 1}`, totalLessons: 10 })
    )
    const allProgress: Record<string, CourseProgress> = {}
    courses.forEach((c, i) => {
      allProgress[c.id] = makeProgress(c.id, i + 1, i + 1)
    })

    const result = getRecommendedCourses(courses, allProgress, {})
    expect(result).toHaveLength(3)
  })

  it('respects custom limit parameter', () => {
    const courses = Array.from({ length: 5 }, (_, i) =>
      makeCourse({ id: `course-${i + 1}`, totalLessons: 10 })
    )
    const allProgress: Record<string, CourseProgress> = {}
    courses.forEach((c, i) => {
      allProgress[c.id] = makeProgress(c.id, i + 1, i + 1)
    })

    const result = getRecommendedCourses(courses, allProgress, {}, 2)
    expect(result).toHaveLength(2)
  })

  it('ranks higher-scoring courses first', () => {
    const courses = [
      makeCourse({ id: 'course-1', totalLessons: 10 }),
      makeCourse({ id: 'course-2', totalLessons: 10 }),
    ]
    // course-1: accessed 1 day ago (high recency), course-2: 20 days ago (low recency)
    const allProgress = {
      'course-1': makeProgress('course-1', 5, 1),
      'course-2': makeProgress('course-2', 5, 20),
    }

    const result = getRecommendedCourses(courses, allProgress, {})
    expect(result[0].course.id).toBe('course-1')
    expect(result[1].course.id).toBe('course-2')
  })

  it('includes completionPercent in each result', () => {
    const courses = [makeCourse({ id: 'course-1', totalLessons: 10 })]
    const allProgress = { 'course-1': makeProgress('course-1', 7, 3) }

    const result = getRecommendedCourses(courses, allProgress, {})
    expect(result[0].completionPercent).toBe(70)
  })

  it('skips courses with no progress entry', () => {
    const courses = [
      makeCourse({ id: 'course-1', totalLessons: 10 }),
      makeCourse({ id: 'course-2', totalLessons: 10 }),
    ]
    const allProgress = { 'course-1': makeProgress('course-1', 5, 3) }

    const result = getRecommendedCourses(courses, allProgress, {})
    expect(result).toHaveLength(1)
    expect(result[0].course.id).toBe('course-1')
  })
})
