import { describe, it, expect } from 'vitest'
import { computeNextCourseSuggestion } from './suggestions'
import type { Course } from '@/data/types'
import type { CourseProgress } from './progress'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLesson(id: string) {
  return {
    id,
    title: id,
    description: '',
    keyTopics: [],
    resources: [],
    duration: 0,
    isPreview: false,
  }
}

function makeCourse(id: string, tags: string[], lessonCount = 3): Course {
  return {
    id,
    title: id,
    shortTitle: id,
    description: '',
    category: 'behavior' as const,
    difficulty: 'beginner' as const,
    totalLessons: lessonCount,
    totalVideos: 0,
    totalPDFs: 0,
    estimatedHours: lessonCount,
    tags,
    modules: [
      {
        id: `${id}-m1`,
        title: 'Module 1',
        description: '',
        lessons: Array.from({ length: lessonCount }, (_, i) => makeLesson(`${id}-l${i + 1}`)),
      },
    ],
    isSequential: false,
    basePath: id,
    instructorId: 'instructor-1',
  }
}

function makeProgress(
  courseId: string,
  completedCount: number,
  totalLessons: number,
  daysAgo = 1
): CourseProgress {
  const lessonIds = Array.from({ length: completedCount }, (_, i) => `${courseId}-l${i + 1}`)
  const lastAccessed = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return {
    courseId,
    completedLessons: lessonIds,
    lastAccessedAt: lastAccessed,
    startedAt: lastAccessed,
    notes: {},
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeNextCourseSuggestion', () => {
  it('returns null when all other courses are 100% complete', () => {
    const completed = makeCourse('c1', ['influence'], 2)
    const other = makeCourse('c2', ['influence'], 2)
    const progress: Record<string, CourseProgress> = {
      c1: makeProgress('c1', 2, 2),
      c2: makeProgress('c2', 2, 2), // 100% done
    }

    const result = computeNextCourseSuggestion('c1', [completed, other], progress)
    expect(result).toBeNull()
  })

  it('returns null when no other courses exist', () => {
    const completed = makeCourse('c1', ['influence'])
    const progress: Record<string, CourseProgress> = {
      c1: makeProgress('c1', 3, 3),
    }

    const result = computeNextCourseSuggestion('c1', [completed], progress)
    expect(result).toBeNull()
  })

  it('excludes the just-completed course from candidates', () => {
    const completed = makeCourse('c1', ['influence'])
    const other = makeCourse('c2', ['influence'])
    const progress = {
      c1: makeProgress('c1', 3, 3),
      c2: makeProgress('c2', 1, 3),
    }

    const result = computeNextCourseSuggestion('c1', [completed, other], progress)
    expect(result?.course.id).toBe('c2')
  })

  it('prefers course with more shared tags', () => {
    const completed = makeCourse('c1', ['a', 'b', 'c'], 3)
    const highOverlap = makeCourse('c2', ['a', 'b', 'c'], 3) // 3 shared
    const lowOverlap = makeCourse('c3', ['a'], 3)             // 1 shared

    const progress = {
      c1: makeProgress('c1', 3, 3),
      c2: makeProgress('c2', 1, 3),
      c3: makeProgress('c3', 1, 3),
    }

    const result = computeNextCourseSuggestion('c1', [completed, highOverlap, lowOverlap], progress)
    expect(result?.course.id).toBe('c2')
  })

  it('uses momentum as tiebreaker when tag overlap is equal', () => {
    const completed = makeCourse('c1', ['a', 'b'], 3)
    const slowMomentum = makeCourse('c2', ['a', 'b'], 3)  // same tags, studied 10 days ago
    const highMomentum = makeCourse('c3', ['a', 'b'], 3)  // same tags, studied yesterday

    const progress = {
      c1: makeProgress('c1', 3, 3),
      c2: makeProgress('c2', 1, 3, 10), // studied 10 days ago → lower recency
      c3: makeProgress('c3', 1, 3, 1),  // studied 1 day ago → higher recency
    }

    const result = computeNextCourseSuggestion('c1', [completed, slowMomentum, highMomentum], progress)
    expect(result?.course.id).toBe('c3')
  })

  it('ranks purely by momentum when completed course has no tags', () => {
    const completed = makeCourse('c1', [], 3) // no tags
    const highProgress = makeCourse('c2', ['x', 'y'], 4)
    const lowProgress = makeCourse('c3', ['z'], 4)

    const progress = {
      c1: makeProgress('c1', 3, 3),
      c2: makeProgress('c2', 3, 4, 1), // 75% done, recent → high momentum
      c3: makeProgress('c3', 0, 4, 1), // 0% done, recent → lower momentum
    }

    const result = computeNextCourseSuggestion('c1', [completed, highProgress, lowProgress], progress)
    expect(result?.course.id).toBe('c2')
  })

  it('recency score is 0 when course studied 14+ days ago', () => {
    const completed = makeCourse('c1', ['a'], 3)
    const stale = makeCourse('c2', ['a'], 3)
    const fresh = makeCourse('c3', ['a'], 3)

    const progress = {
      c1: makeProgress('c1', 3, 3),
      c2: makeProgress('c2', 0, 3, 20), // 20 days → recency = 0
      c3: makeProgress('c3', 0, 3, 1),  // 1 day → recency high
    }

    const result = computeNextCourseSuggestion('c1', [completed, stale, fresh], progress)
    expect(result?.course.id).toBe('c3')
  })

  it('returns a course even when it has no progress record (never started)', () => {
    const completed = makeCourse('c1', ['a'], 3)
    const neverStarted = makeCourse('c2', ['a'], 3)

    const progress = {
      c1: makeProgress('c1', 3, 3),
      // c2 has no entry
    }

    const result = computeNextCourseSuggestion('c1', [completed, neverStarted], progress)
    expect(result?.course.id).toBe('c2')
  })

  it('includes tagOverlapCount in the result', () => {
    const completed = makeCourse('c1', ['a', 'b', 'c'], 3)
    const other = makeCourse('c2', ['a', 'b'], 3)

    const progress = {
      c1: makeProgress('c1', 3, 3),
      c2: makeProgress('c2', 1, 3),
    }

    const result = computeNextCourseSuggestion('c1', [completed, other], progress)
    expect(result?.tagOverlapCount).toBe(2)
  })

  it('returns null when completed course id does not exist in allCourses', () => {
    const other = makeCourse('c2', ['a'], 3)
    const progress = { c2: makeProgress('c2', 1, 3) }

    const result = computeNextCourseSuggestion('nonexistent', [other], progress)
    expect(result).toBeNull()
  })
})
