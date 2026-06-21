/**
 * useCourseRoute — Extracts course context from the current URL pathname.
 *
 * Replaces the fragile `isLessonPlayerRoute` regex in Layout.tsx with a typed
 * hook that parses path segments and resolves the course name from the import
 * store.  Uses `useLocation` (not `useParams`) so it works outside <Routes>.
 *
 * Matching rules:
 *   isLessonRoute  — /courses/:courseId/lessons/:lessonId   (exact, no trailing sub-route)
 *   isCourseRoute  — /courses/:courseId                     (any sub-path matches)
 *
 * @see docs/plans/2026-05-02-001-feat-merge-lesson-toolbar-into-header-plan.md   Unit 2
 */

import { useLocation } from 'react-router'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

export interface CourseRouteInfo {
  /** True only for /courses/:courseId/lessons/:lessonId with nothing after */
  isLessonRoute: boolean
  /** True for any path starting with /courses/:courseId */
  isCourseRoute: boolean
  /** Extracted course ID, or null when not on a course page */
  courseId: string | null
  /** Extracted lesson ID, or null when not on an exact lesson route */
  lessonId: string | null
  /** Resolved course name from the import store, 'Course' fallback, or null when not on a course page */
  courseName: string | null
  /** Track context set by LearningTrackDetail when navigating to a course/lesson.
   *  Present only when the user entered the course from a learning track in this session.
   *  Lost on hard refresh (intentional — matches all other location.state flags). */
  fromTrack?: { trackId: string; trackName: string }
}

/** Narrow an unknown location.state to the fromTrack shape, returning undefined on mismatch. */
export function readFromTrack(state: unknown): { trackId: string; trackName: string } | undefined {
  if (typeof state !== 'object' || state === null) return undefined
  const s = state as Record<string, unknown>
  if (
    typeof s.fromTrack === 'object' &&
    s.fromTrack !== null &&
    typeof (s.fromTrack as Record<string, unknown>).trackId === 'string' &&
    typeof (s.fromTrack as Record<string, unknown>).trackName === 'string'
  ) {
    return s.fromTrack as { trackId: string; trackName: string }
  }
  return undefined
}

export function useCourseRoute(): CourseRouteInfo {
  const location = useLocation()
  const { pathname } = location
  const importedCourses = useCourseImportStore(s => s.importedCourses)

  // Split pathname and drop the leading empty segment from the initial '/'
  const segments = pathname.split('/').filter(Boolean)

  let courseId: string | null = null
  let lessonId: string | null = null

  // Must have at least /courses/:courseId
  if (segments[0] === 'courses' && segments.length >= 2) {
    courseId = segments[1]!

    // /courses/:courseId/lessons/:lessonId — exact match, nothing after
    if (segments.length === 4 && segments[2] === 'lessons') {
      lessonId = segments[3]!
    }
  }

  const isLessonRoute = lessonId !== null
  const isCourseRoute = courseId !== null

  // Resolve course name — synchronous lookup in the already-loaded import store
  const course = courseId ? importedCourses.find(c => c.id === courseId) : null
  const courseName = courseId ? (course?.name ?? 'Course') : null

  const fromTrack = readFromTrack(location.state)

  return { isLessonRoute, isCourseRoute, courseId, lessonId, courseName, fromTrack }
}
