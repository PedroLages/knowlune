/**
 * Unit tests for useCourseRoute hook
 *
 * Tests path-segment parsing, route-type classification, course-name
 * resolution, and graceful handling of malformed URLs.
 *
 * @see docs/plans/2026-05-02-001-feat-merge-lesson-toolbar-into-header-plan.md  Unit 2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCourseRoute } from '../useCourseRoute'
import type { ImportedCourse } from '@/data/types'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-abc123',
    name: 'React Patterns',
    importedAt: '2026-01-01T00:00:00.000Z',
    category: 'Frontend',
    tags: ['react'],
    status: 'active' as const,
    videoCount: 5,
    pdfCount: 2,
    directoryHandle: null,
    ...overrides,
  }
}

function setPathname(pathname: string) {
  mockLocation.pathname = pathname
}

function setStoreCourses(courses: ImportedCourse[]) {
  mockStoreCourses = courses
}

// ---------------------------------------------------------------------------
// Module-level mocks (vi.mock hoisted)
// ---------------------------------------------------------------------------

let mockLocation: { pathname: string; search: string; hash: string; state: unknown; key: string }

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useLocation: () => {
      // Return the current mockLocation so we can mutate it between renders
      if (!mockLocation) {
        return { pathname: '/overview', search: '', hash: '', state: null, key: 'default' }
      }
      return { ...mockLocation }
    },
  }
})

let mockStoreCourses: ImportedCourse[] = []

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      importedCourses: mockStoreCourses,
    }),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCourseRoute', () => {
  beforeEach(() => {
    // Reset to a non-course page with an empty store
    mockLocation = { pathname: '/overview', search: '', hash: '', state: null, key: 'default' }
    mockStoreCourses = []
  })

  // -- Happy path: lesson route -----------------------------------------------

  it('detects a lesson route with correct courseId, lessonId, and courseName', () => {
    setPathname('/courses/abc123/lessons/def456')
    setStoreCourses([makeCourse({ id: 'abc123', name: 'React Patterns' })])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(true)
    expect(result.current.isCourseRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
    expect(result.current.lessonId).toBe('def456')
    expect(result.current.courseName).toBe('React Patterns')
  })

  // -- Happy path: course overview route --------------------------------------

  it('detects a course overview route (isCourseRoute true, isLessonRoute false)', () => {
    setPathname('/courses/abc123')
    setStoreCourses([makeCourse({ id: 'abc123', name: 'React Patterns' })])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
    expect(result.current.lessonId).toBeNull()
    expect(result.current.courseName).toBe('React Patterns')
  })

  // -- Happy path: course sub-page (flashcards) -------------------------------

  it('detects course sub-page /flashcards as course route, not lesson route', () => {
    setPathname('/courses/abc123/flashcards')
    setStoreCourses([makeCourse({ id: 'abc123', name: 'React Patterns' })])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
    expect(result.current.lessonId).toBeNull()
  })

  // -- Happy path: lesson sub-route (quiz) — must NOT be isLessonRoute --------

  it('treats /courses/:id/lessons/:id/quiz as course route only (not lesson)', () => {
    setPathname('/courses/abc123/lessons/def456/quiz')
    setStoreCourses([makeCourse({ id: 'abc123', name: 'React Patterns' })])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
    expect(result.current.lessonId).toBeNull()
  })

  it('treats /courses/:id/lessons/:id/results as course route only (not lesson)', () => {
    setPathname('/courses/abc123/lessons/def456/results')
    setStoreCourses([makeCourse({ id: 'abc123', name: 'React Patterns' })])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
    expect(result.current.lessonId).toBeNull()
  })

  // -- Happy path: non-course page --------------------------------------------

  it('returns all false / null for a non-course page', () => {
    setPathname('/overview')

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(false)
    expect(result.current.courseId).toBeNull()
    expect(result.current.lessonId).toBeNull()
    expect(result.current.courseName).toBeNull()
  })

  // -- Edge case: malformed URL — no crash ------------------------------------

  it('handles a malformed /courses path without courseId gracefully', () => {
    setPathname('/courses')

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(false)
    expect(result.current.courseId).toBeNull()
    expect(result.current.lessonId).toBeNull()
    expect(result.current.courseName).toBeNull()
  })

  it('handles an empty pathname gracefully', () => {
    mockLocation = { pathname: '', search: '', hash: '', state: null, key: 'empty' }

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(false)
    expect(result.current.courseId).toBeNull()
    expect(result.current.lessonId).toBeNull()
    expect(result.current.courseName).toBeNull()
  })

  it('handles root path gracefully', () => {
    mockLocation = { pathname: '/', search: '', hash: '', state: null, key: 'root' }

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(false)
    expect(result.current.courseId).toBeNull()
    expect(result.current.lessonId).toBeNull()
    expect(result.current.courseName).toBeNull()
  })

  // -- Edge case: course in URL but not in import store -----------------------

  it('falls back to courseName "Course" when course is not in the import store', () => {
    setPathname('/courses/abc123/lessons/def456')
    // Empty store — course not found
    setStoreCourses([])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(true)
    expect(result.current.isCourseRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
    expect(result.current.lessonId).toBe('def456')
    expect(result.current.courseName).toBe('Course')
  })

  it('returns courseName "Course" for a course overview when not in store', () => {
    setPathname('/courses/abc123')
    setStoreCourses([])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.courseName).toBe('Course')
  })

  it('returns courseName from store when multiple courses exist', () => {
    setPathname('/courses/xyz789/lessons/l42')
    setStoreCourses([
      makeCourse({ id: 'abc123', name: 'React Patterns' }),
      makeCourse({ id: 'xyz789', name: 'Advanced TypeScript' }),
    ])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.courseId).toBe('xyz789')
    expect(result.current.courseName).toBe('Advanced TypeScript')
  })

  // -- Edge case: rapid route changes -----------------------------------------

  it('returns correct values after rapid route changes (no stale closure)', () => {
    setPathname('/overview')
    setStoreCourses([makeCourse({ id: 'abc123', name: 'React Patterns' })])

    const { result, rerender } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(false)

    // Navigate to a lesson route
    setPathname('/courses/abc123/lessons/def456')
    rerender()

    expect(result.current.isLessonRoute).toBe(true)
    expect(result.current.isCourseRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
    expect(result.current.lessonId).toBe('def456')
    expect(result.current.courseName).toBe('React Patterns')

    // Navigate to a course sub-page
    setPathname('/courses/abc123/flashcards')
    rerender()

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
    expect(result.current.lessonId).toBeNull()

    // Navigate away entirely
    setPathname('/settings')
    rerender()

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(false)
    expect(result.current.courseId).toBeNull()
    expect(result.current.lessonId).toBeNull()
    expect(result.current.courseName).toBeNull()
  })

  // -- Edge case: course sub-page with deep nesting ---------------------------

  it('handles nested course sub-pages correctly', () => {
    setPathname('/courses/abc123/lessons/def456/quiz/review')
    setStoreCourses([makeCourse({ id: 'abc123' })])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(false)
    expect(result.current.isCourseRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
  })

  // -- Edge case: URL with search params and hash -----------------------------

  it('ignores query string and hash in path matching', () => {
    // When the URL is /courses/abc123/lessons/def456?t=120#section
    // useLocation().pathname returns just the path portion (no query/hash)
    setPathname('/courses/abc123/lessons/def456')
    setStoreCourses([makeCourse({ id: 'abc123', name: 'React Patterns' })])

    const { result } = renderHook(() => useCourseRoute())

    expect(result.current.isLessonRoute).toBe(true)
    expect(result.current.courseId).toBe('abc123')
    expect(result.current.lessonId).toBe('def456')
    expect(result.current.courseName).toBe('React Patterns')
  })

  // -- Regression: matches the old isLessonPlayerRoute regex exactly ----------

  it('matches the same paths as the old Layout regex /\\/courses\\/[^/]+\\/lessons\\/[^/]+$/', () => {
    const regex = /\/courses\/[^/]+\/lessons\/[^/]+$/

    setStoreCourses([makeCourse({ id: 'abc123', name: 'Test' })])

    const testCases = [
      '/courses/abc123/lessons/def456', // exact match
      '/courses/abc123/lessons/def456/quiz', // sub-route — NOT a match
      '/courses/abc123', // not a lesson
      '/courses/abc123/lessons', // incomplete
      '/overview', // unrelated
      '/courses/abc/lessons/def', // short IDs
      '/courses/long-course-id-123/lessons/lesson-x', // longer IDs
    ]

    for (const path of testCases) {
      setPathname(path)
      const { result } = renderHook(() => useCourseRoute())
      const regexResult = regex.test(path)
      expect(result.current.isLessonRoute).toBe(regexResult)
    }
  })
})
