import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import {
  getAllProgress,
  getProgress,
  markLessonComplete,
  markLessonIncomplete,
  getCourseCompletionPercent,
  isLessonComplete,
  saveNote,
  getNote,
  getCoursesInProgress,
  getCompletedCourses,
  getNotStartedCourses,
  saveVideoPosition,
  getTotalCompletedLessons,
  getTotalStudyNotes,
  getRecentActivity,
  invalidateProgressCache,
} from '@/lib/progress'
import type { Course } from '@/data/types'

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course-1',
    title: 'Test Course',
    shortTitle: 'TC',
    description: 'A test course',
    category: 'behavioral-analysis',
    difficulty: 'beginner',
    totalLessons: 3,
    totalVideos: 2,
    totalPDFs: 1,
    estimatedHours: 5,
    tags: ['test'],
    instructorId: 'instructor-1',
    modules: [
      {
        id: 'mod-1',
        title: 'Module 1',
        description: 'First module',
        order: 1,
        lessons: [
          {
            id: 'lesson-1',
            title: 'Lesson 1',
            description: '',
            order: 1,
            resources: [],
            keyTopics: [],
          },
          {
            id: 'lesson-2',
            title: 'Lesson 2',
            description: '',
            order: 2,
            resources: [],
            keyTopics: [],
          },
        ],
      },
      {
        id: 'mod-2',
        title: 'Module 2',
        description: 'Second module',
        order: 2,
        lessons: [
          {
            id: 'lesson-3',
            title: 'Lesson 3',
            description: '',
            order: 1,
            resources: [],
            keyTopics: [],
          },
        ],
      },
    ],
    isSequential: false,
    basePath: '/courses/test',
    ...overrides,
  }
}

describe('progress', () => {
  beforeEach(async () => {
    localStorage.clear()
    invalidateProgressCache()
    await Dexie.delete('ElearningDB')
    vi.resetModules()
  })

  describe('getAllProgress', () => {
    it('returns empty object when nothing stored', () => {
      expect(getAllProgress()).toEqual({})
    })

    it('returns empty object when localStorage contains invalid JSON', () => {
      localStorage.setItem('course-progress', 'not-json')
      expect(getAllProgress()).toEqual({})
    })
  })

  describe('getProgress', () => {
    it('creates new progress entry for unknown course', () => {
      const progress = getProgress('new-course')
      expect(progress.courseId).toBe('new-course')
      expect(progress.completedLessons).toEqual([])
      expect(progress.notes).toEqual({})
      expect(progress.startedAt).toBeDefined()
      expect(progress.lastAccessedAt).toBeDefined()
    })

    it('returns existing progress for known course', () => {
      markLessonComplete('course-1', 'lesson-1')
      const progress = getProgress('course-1')
      expect(progress.completedLessons).toContain('lesson-1')
    })
  })

  describe('markLessonComplete', () => {
    it('adds lesson to completedLessons', () => {
      markLessonComplete('course-1', 'lesson-1')
      const progress = getProgress('course-1')
      expect(progress.completedLessons).toContain('lesson-1')
    })

    it('does not duplicate lesson if already complete', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-1')
      const progress = getProgress('course-1')
      expect(progress.completedLessons.filter(l => l === 'lesson-1')).toHaveLength(1)
    })

    it('can mark multiple different lessons complete', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      const progress = getProgress('course-1')
      expect(progress.completedLessons).toEqual(['lesson-1', 'lesson-2'])
    })

    it('updates lastAccessedAt timestamp', () => {
      const before = new Date().toISOString()
      markLessonComplete('course-1', 'lesson-1')
      const progress = getProgress('course-1')
      expect(progress.lastAccessedAt >= before).toBe(true)
    })
  })

  describe('markLessonIncomplete', () => {
    it('removes lesson from completedLessons', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonIncomplete('course-1', 'lesson-1')
      const progress = getProgress('course-1')
      expect(progress.completedLessons).not.toContain('lesson-1')
    })

    it('does nothing if lesson was not complete', () => {
      markLessonIncomplete('course-1', 'nonexistent')
      const progress = getProgress('course-1')
      expect(progress.completedLessons).toEqual([])
    })

    it('only removes the targeted lesson', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      markLessonIncomplete('course-1', 'lesson-1')
      const progress = getProgress('course-1')
      expect(progress.completedLessons).toEqual(['lesson-2'])
    })
  })

  describe('getCourseCompletionPercent', () => {
    it('returns 0 when totalLessons is 0', () => {
      expect(getCourseCompletionPercent('course-1', 0)).toBe(0)
    })

    it('returns 0 when no lessons completed', () => {
      // getProgress creates an entry with no completions
      getProgress('course-1')
      expect(getCourseCompletionPercent('course-1', 3)).toBe(0)
    })

    it('calculates correct percentage', () => {
      markLessonComplete('course-1', 'lesson-1')
      expect(getCourseCompletionPercent('course-1', 3)).toBe(33)
    })

    it('returns 100 when all lessons completed', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      markLessonComplete('course-1', 'lesson-3')
      expect(getCourseCompletionPercent('course-1', 3)).toBe(100)
    })

    it('rounds to nearest integer', () => {
      markLessonComplete('course-1', 'lesson-1')
      // 1/3 = 33.33... -> rounds to 33
      expect(getCourseCompletionPercent('course-1', 3)).toBe(33)
      markLessonComplete('course-1', 'lesson-2')
      // 2/3 = 66.66... -> rounds to 67
      expect(getCourseCompletionPercent('course-1', 3)).toBe(67)
    })
  })

  describe('isLessonComplete', () => {
    it('returns false when lesson not completed', () => {
      expect(isLessonComplete('course-1', 'lesson-1')).toBe(false)
    })

    it('returns true when lesson is completed', () => {
      markLessonComplete('course-1', 'lesson-1')
      expect(isLessonComplete('course-1', 'lesson-1')).toBe(true)
    })

    it('returns false after lesson marked incomplete', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonIncomplete('course-1', 'lesson-1')
      expect(isLessonComplete('course-1', 'lesson-1')).toBe(false)
    })
  })

  describe('saveNote / getNote', () => {
    it('round-trips note content', async () => {
      await saveNote('course-1', 'lesson-1', 'My study notes here')
      expect(await getNote('course-1', 'lesson-1')).toBe('My study notes here')
    })

    it('returns empty string when no note exists', async () => {
      expect(await getNote('course-1', 'lesson-1')).toBe('')
    })

    it('overwrites previous note content', async () => {
      await saveNote('course-1', 'lesson-1', 'First draft')
      await saveNote('course-1', 'lesson-1', 'Revised draft')
      expect(await getNote('course-1', 'lesson-1')).toBe('Revised draft')
    })

    it('saves notes independently per lesson', async () => {
      await saveNote('course-1', 'lesson-1', 'Note for lesson 1')
      await saveNote('course-1', 'lesson-2', 'Note for lesson 2')
      expect(await getNote('course-1', 'lesson-1')).toBe('Note for lesson 1')
      expect(await getNote('course-1', 'lesson-2')).toBe('Note for lesson 2')
    })
  })

  describe('saveVideoPosition', () => {
    it('saves last watched lesson and position', () => {
      saveVideoPosition('course-1', 'lesson-2', 120.5)
      const progress = getProgress('course-1')
      expect(progress.lastWatchedLesson).toBe('lesson-2')
      expect(progress.lastVideoPosition).toBe(120.5)
    })

    it('overwrites previous position', () => {
      saveVideoPosition('course-1', 'lesson-1', 30)
      saveVideoPosition('course-1', 'lesson-2', 60)
      const progress = getProgress('course-1')
      expect(progress.lastWatchedLesson).toBe('lesson-2')
      expect(progress.lastVideoPosition).toBe(60)
    })
  })

  describe('getCoursesInProgress', () => {
    it('returns empty array when no progress', () => {
      const courses = [makeCourse()]
      expect(getCoursesInProgress(courses)).toEqual([])
    })

    it('returns courses with partial completion', () => {
      markLessonComplete('course-1', 'lesson-1')
      const courses = [makeCourse()]
      const inProgress = getCoursesInProgress(courses)
      expect(inProgress).toHaveLength(1)
      expect(inProgress[0].id).toBe('course-1')
      expect(inProgress[0].completionPercent).toBe(33)
    })

    it('excludes fully completed courses', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      markLessonComplete('course-1', 'lesson-3')
      const courses = [makeCourse()]
      expect(getCoursesInProgress(courses)).toHaveLength(0)
    })

    it('excludes not-started courses', () => {
      const courses = [makeCourse()]
      expect(getCoursesInProgress(courses)).toHaveLength(0)
    })

    it('sorts by lastAccessedAt descending', () => {
      const course1 = makeCourse({ id: 'course-1' })
      const course2 = makeCourse({ id: 'course-2' })
      // Directly set progress with deterministic timestamps to test sorting
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-2', 'lesson-1')
      // Overwrite with explicit timestamps to guarantee ordering
      const all = getAllProgress()
      all['course-1'].lastAccessedAt = '2024-01-01T10:00:00Z'
      all['course-2'].lastAccessedAt = '2024-01-02T10:00:00Z'
      localStorage.setItem('course-progress', JSON.stringify(all))

      const inProgress = getCoursesInProgress([course1, course2])
      expect(inProgress[0].id).toBe('course-2')
    })
  })

  describe('getCompletedCourses', () => {
    it('returns empty array when nothing completed', () => {
      const courses = [makeCourse()]
      expect(getCompletedCourses(courses)).toEqual([])
    })

    it('returns courses where all lessons are completed', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      markLessonComplete('course-1', 'lesson-3')
      const courses = [makeCourse()]
      const completed = getCompletedCourses(courses)
      expect(completed).toHaveLength(1)
      expect(completed[0].id).toBe('course-1')
    })

    it('excludes partially completed courses', () => {
      markLessonComplete('course-1', 'lesson-1')
      const courses = [makeCourse()]
      expect(getCompletedCourses(courses)).toHaveLength(0)
    })
  })

  describe('getNotStartedCourses', () => {
    it('returns all courses when no progress exists', () => {
      const courses = [makeCourse()]
      expect(getNotStartedCourses(courses)).toHaveLength(1)
    })

    it('excludes courses with any completed lessons', () => {
      markLessonComplete('course-1', 'lesson-1')
      const courses = [makeCourse()]
      expect(getNotStartedCourses(courses)).toHaveLength(0)
    })

    it('includes courses with progress entry but zero completions', () => {
      // getProgress creates an entry with 0 completions
      getProgress('course-1')
      const courses = [makeCourse()]
      expect(getNotStartedCourses(courses)).toHaveLength(1)
    })

    it('handles mix of started and not started', () => {
      markLessonComplete('course-1', 'lesson-1')
      const course1 = makeCourse({ id: 'course-1' })
      const course2 = makeCourse({ id: 'course-2' })
      const notStarted = getNotStartedCourses([course1, course2])
      expect(notStarted).toHaveLength(1)
      expect(notStarted[0].id).toBe('course-2')
    })
  })

  describe('getTotalCompletedLessons', () => {
    it('returns 0 when no progress', () => {
      expect(getTotalCompletedLessons()).toBe(0)
    })

    it('sums completed lessons across all courses', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      markLessonComplete('course-2', 'lesson-a')
      expect(getTotalCompletedLessons()).toBe(3)
    })
  })

  describe('getTotalStudyNotes', () => {
    it('returns 0 when no notes', async () => {
      expect(await getTotalStudyNotes()).toBe(0)
    })

    it('counts notes across all courses', async () => {
      await saveNote('course-1', 'lesson-1', 'Note 1')
      await saveNote('course-1', 'lesson-2', 'Note 2')
      await saveNote('course-2', 'lesson-a', 'Note 3')
      expect(await getTotalStudyNotes()).toBe(3)
    })

    it('counts all notes including empty content (Dexie stores all)', async () => {
      await saveNote('course-1', 'lesson-1', 'Real note')
      await saveNote('course-1', 'lesson-2', '')
      // Dexie counts all rows — filtering empty notes is a UI concern
      expect(await getTotalStudyNotes()).toBe(2)
    })
  })

  describe('getRecentActivity', () => {
    it('returns empty array when no progress', () => {
      const courses = [makeCourse()]
      expect(getRecentActivity(courses)).toEqual([])
    })

    it('returns courses with progress sorted by lastAccessedAt', () => {
      const course1 = makeCourse({ id: 'course-1' })
      const course2 = makeCourse({ id: 'course-2' })
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-2', 'lesson-1')
      // Overwrite with explicit timestamps to guarantee ordering
      const all = getAllProgress()
      all['course-1'].lastAccessedAt = '2024-01-01T10:00:00Z'
      all['course-2'].lastAccessedAt = '2024-01-02T10:00:00Z'
      localStorage.setItem('course-progress', JSON.stringify(all))

      const recent = getRecentActivity([course1, course2])
      expect(recent).toHaveLength(2)
      // Most recently accessed should be first
      expect(recent[0].id).toBe('course-2')
    })

    it('respects limit parameter', () => {
      const course1 = makeCourse({ id: 'course-1' })
      const course2 = makeCourse({ id: 'course-2' })
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-2', 'lesson-1')
      const recent = getRecentActivity([course1, course2], 1)
      expect(recent).toHaveLength(1)
    })
  })
})
