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
  getNotes,
  addNote,
  deleteNote,
  getCoursesInProgress,
  getCompletedCourses,
  getNotStartedCourses,
  saveVideoPosition,
  savePdfPage,
  getPdfPage,
  normalizeTags,
  getAllNoteTags,
  getTotalCompletedLessons,
  getTotalStudyNotes,
  getRecentActivity,
  getLast7DaysLessonCompletions,
  getWeeklyChange,
  getAverageProgressPercent,
  getTotalEstimatedStudyHours,
  getTimeRemaining,
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

  describe('savePdfPage / getPdfPage', () => {
    it('saves and retrieves a PDF page position', () => {
      savePdfPage('course-1', 'resource-1', 5)
      expect(getPdfPage('course-1', 'resource-1')).toBe(5)
    })

    it('returns undefined when no PDF page saved', () => {
      expect(getPdfPage('course-1', 'resource-1')).toBeUndefined()
    })

    it('overwrites previous page position', () => {
      savePdfPage('course-1', 'resource-1', 3)
      savePdfPage('course-1', 'resource-1', 10)
      expect(getPdfPage('course-1', 'resource-1')).toBe(10)
    })

    it('tracks multiple resources independently', () => {
      savePdfPage('course-1', 'resource-1', 5)
      savePdfPage('course-1', 'resource-2', 12)
      expect(getPdfPage('course-1', 'resource-1')).toBe(5)
      expect(getPdfPage('course-1', 'resource-2')).toBe(12)
    })
  })

  describe('normalizeTags', () => {
    it('lowercases and sorts tags', () => {
      expect(normalizeTags(['React', 'CSS', 'HTML'])).toEqual(['css', 'html', 'react'])
    })

    it('deduplicates tags', () => {
      expect(normalizeTags(['react', 'React', 'REACT'])).toEqual(['react'])
    })

    it('trims whitespace', () => {
      expect(normalizeTags([' react ', '  css  '])).toEqual(['css', 'react'])
    })

    it('filters empty strings', () => {
      expect(normalizeTags(['react', '', '  ', 'css'])).toEqual(['css', 'react'])
    })

    it('returns empty array for empty input', () => {
      expect(normalizeTags([])).toEqual([])
    })
  })

  describe('getAllNoteTags', () => {
    it('returns empty array when no notes exist', async () => {
      expect(await getAllNoteTags()).toEqual([])
    })

    it('returns sorted unique tags from saved notes', async () => {
      await saveNote('course-1', 'lesson-1', 'Note about React', ['react', 'frontend'])
      await saveNote('course-1', 'lesson-2', 'Note about CSS', ['css', 'frontend'])
      const tags = await getAllNoteTags()
      // Tags are stored as multiEntry index, so uniqueKeys returns individual tag strings
      expect(tags).toContain('react')
      expect(tags).toContain('css')
      expect(tags).toContain('frontend')
    })
  })

  describe('getNotes', () => {
    it('returns empty array when no notes for lesson', async () => {
      expect(await getNotes('course-1', 'lesson-1')).toEqual([])
    })

    it('returns notes for a specific lesson', async () => {
      await saveNote('course-1', 'lesson-1', 'First note')
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes).toHaveLength(1)
      expect(notes[0].content).toBe('First note')
    })

    it('does not return notes from other lessons', async () => {
      await saveNote('course-1', 'lesson-1', 'Note for lesson 1')
      await saveNote('course-1', 'lesson-2', 'Note for lesson 2')
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes).toHaveLength(1)
      expect(notes[0].content).toBe('Note for lesson 1')
    })
  })

  describe('addNote', () => {
    it('adds a new note and returns its id', async () => {
      const noteId = await addNote('course-1', 'lesson-1', 'New note')
      expect(noteId).toBeDefined()
      expect(typeof noteId).toBe('string')
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes).toHaveLength(1)
      expect(notes[0].content).toBe('New note')
    })

    it('allows multiple notes per lesson', async () => {
      await addNote('course-1', 'lesson-1', 'Note A')
      await addNote('course-1', 'lesson-1', 'Note B')
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes).toHaveLength(2)
    })

    it('normalizes tags on the note', async () => {
      await addNote('course-1', 'lesson-1', 'Tagged note', ['React', '  CSS  '])
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes[0].tags).toEqual(['css', 'react'])
    })

    it('stores videoTimestamp when provided', async () => {
      await addNote('course-1', 'lesson-1', 'Timestamped note', [], 42.5)
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes[0].timestamp).toBe(42.5)
    })
  })

  describe('deleteNote', () => {
    it('removes a specific note by id', async () => {
      const noteId = await addNote('course-1', 'lesson-1', 'To be deleted')
      await deleteNote('course-1', 'lesson-1', noteId)
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes).toHaveLength(0)
    })

    it('does not remove other notes', async () => {
      const id1 = await addNote('course-1', 'lesson-1', 'Keep this')
      const id2 = await addNote('course-1', 'lesson-1', 'Delete this')
      await deleteNote('course-1', 'lesson-1', id2)
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes).toHaveLength(1)
      expect(notes[0].id).toBe(id1)
    })
  })

  describe('getLast7DaysLessonCompletions', () => {
    it('returns array of 7 zeros when no completions', () => {
      const result = getLast7DaysLessonCompletions()
      expect(result).toEqual([0, 0, 0, 0, 0, 0, 0])
    })

    it('counts completions for today in last position', () => {
      // markLessonComplete logs with current timestamp (today)
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      const result = getLast7DaysLessonCompletions()
      // Today's completions go in index 6 (last position)
      expect(result[6]).toBe(2)
    })

    it('ignores non-lesson_complete log entries', () => {
      // saveVideoPosition logs a 'video_progress' action, not 'lesson_complete'
      saveVideoPosition('course-1', 'lesson-1', 30)
      const result = getLast7DaysLessonCompletions()
      expect(result).toEqual([0, 0, 0, 0, 0, 0, 0])
    })
  })

  describe('getWeeklyChange', () => {
    it('returns 0 when no study log entries', () => {
      expect(getWeeklyChange('lessons')).toBe(0)
    })

    it('returns positive count for lessons completed this week', () => {
      // markLessonComplete logs with current timestamp (this week)
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      // thisWeek = 2, lastWeek = 0 => change = 2
      expect(getWeeklyChange('lessons')).toBe(2)
    })

    it('tracks notes metric separately from lessons', () => {
      markLessonComplete('course-1', 'lesson-1')
      // getWeeklyChange('notes') looks for 'note_saved' actions
      expect(getWeeklyChange('notes')).toBe(0)
    })

    it('returns 0 for courses metric (no course_started tracking)', () => {
      markLessonComplete('course-1', 'lesson-1')
      // 'courses' metric doesn't match lesson_complete or note_saved
      expect(getWeeklyChange('courses')).toBe(0)
    })
  })

  describe('getAverageProgressPercent', () => {
    it('returns 0 when no courses in progress', () => {
      const courses = [makeCourse()]
      expect(getAverageProgressPercent(courses)).toBe(0)
    })

    it('calculates average across in-progress courses', () => {
      // course-1: 1/3 lessons = 33%
      markLessonComplete('course-1', 'lesson-1')
      // course-2: 2/3 lessons = 67%
      markLessonComplete('course-2', 'lesson-1')
      markLessonComplete('course-2', 'lesson-2')

      const course1 = makeCourse({ id: 'course-1' })
      const course2 = makeCourse({ id: 'course-2' })
      const avg = getAverageProgressPercent([course1, course2])
      // (33 + 67) / 2 = 50
      expect(avg).toBe(50)
    })

    it('excludes completed courses from average', () => {
      // course-1: fully completed (100%) — excluded from "in progress"
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      markLessonComplete('course-1', 'lesson-3')
      // course-2: 1/3 = 33%
      markLessonComplete('course-2', 'lesson-1')

      const course1 = makeCourse({ id: 'course-1' })
      const course2 = makeCourse({ id: 'course-2' })
      const avg = getAverageProgressPercent([course1, course2])
      expect(avg).toBe(33)
    })
  })

  describe('getTotalEstimatedStudyHours', () => {
    it('returns 0 when no lessons completed', () => {
      expect(getTotalEstimatedStudyHours()).toBe(0)
    })

    it('calculates hours from completed lessons at 15 min each', () => {
      // 4 lessons * 15 min = 60 min = 1 hour
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      markLessonComplete('course-1', 'lesson-3')
      markLessonComplete('course-2', 'lesson-a')
      expect(getTotalEstimatedStudyHours()).toBe(1)
    })

    it('rounds to one decimal place', () => {
      // 1 lesson * 15 min = 0.25 hours => rounds to 0.3
      markLessonComplete('course-1', 'lesson-1')
      expect(getTotalEstimatedStudyHours()).toBe(0.3)
    })
  })

  describe('getTimeRemaining', () => {
    it('returns full time when no lessons completed', () => {
      const course = makeCourse()
      // 3 lessons * 15 min = 45 min = 0.75 hours => rounds to 0.8
      expect(getTimeRemaining('course-1', course)).toBe(0.8)
    })

    it('returns 0 when all lessons completed', () => {
      markLessonComplete('course-1', 'lesson-1')
      markLessonComplete('course-1', 'lesson-2')
      markLessonComplete('course-1', 'lesson-3')
      const course = makeCourse()
      expect(getTimeRemaining('course-1', course)).toBe(0)
    })

    it('calculates remaining time for partial completion', () => {
      markLessonComplete('course-1', 'lesson-1')
      const course = makeCourse()
      // 2 remaining * 15 min = 30 min = 0.5 hours
      expect(getTimeRemaining('course-1', course)).toBe(0.5)
    })
  })

  describe('getAllProgress caching', () => {
    it('returns cached data on second call', () => {
      markLessonComplete('course-1', 'lesson-1')
      const first = getAllProgress()
      const second = getAllProgress()
      expect(first).toEqual(second)
    })

    it('invalidateProgressCache forces re-read from localStorage', () => {
      markLessonComplete('course-1', 'lesson-1')
      // First call populates the cache
      const before = getAllProgress()
      expect(before['course-1'].completedLessons).toContain('lesson-1')

      // Second call returns from cache (same data)
      const cached = getAllProgress()
      expect(cached['course-1'].completedLessons).toContain('lesson-1')

      // Directly mutate localStorage behind the cache's back
      localStorage.setItem(
        'course-progress',
        JSON.stringify({
          'course-1': {
            courseId: 'course-1',
            completedLessons: ['lesson-1', 'lesson-2'],
            notes: {},
            startedAt: '2024-01-01T00:00:00Z',
            lastAccessedAt: '2024-01-02T00:00:00Z',
          },
        })
      )
      // Mark the migration as done so getAllProgress doesn't re-migrate
      localStorage.setItem('notes-migration-version', '1')

      // Without invalidation, cache still returns old data (only lesson-1)
      const stillCached = getAllProgress()
      expect(stillCached['course-1'].completedLessons).toEqual(['lesson-1'])

      // After invalidation, re-reads localStorage (now has lesson-1 and lesson-2)
      invalidateProgressCache()
      const afterInvalidation = getAllProgress()
      expect(afterInvalidation['course-1'].completedLessons).toEqual(['lesson-1', 'lesson-2'])
    })
  })

  describe('saveNote with tags', () => {
    it('normalizes tags when saving', async () => {
      await saveNote('course-1', 'lesson-1', 'Tagged note', ['React', '  CSS  '])
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes[0].tags).toEqual(['css', 'react'])
    })

    it('stores videoTimestamp when provided', async () => {
      await saveNote('course-1', 'lesson-1', 'Timestamped', [], 99.5)
      const notes = await getNotes('course-1', 'lesson-1')
      expect(notes[0].timestamp).toBe(99.5)
    })
  })

  describe('getCoursesInProgress with explicit allProgress', () => {
    it('uses provided allProgress instead of localStorage', () => {
      const courses = [makeCourse({ id: 'course-1' })]
      const allProgress = {
        'course-1': {
          courseId: 'course-1',
          completedLessons: ['lesson-1'],
          notes: {},
          startedAt: '2024-01-01T00:00:00Z',
          lastAccessedAt: '2024-01-02T00:00:00Z',
        },
      }
      const inProgress = getCoursesInProgress(courses, allProgress)
      expect(inProgress).toHaveLength(1)
      expect(inProgress[0].completionPercent).toBe(33)
    })
  })

  describe('getCompletedCourses with explicit allProgress', () => {
    it('uses provided allProgress instead of localStorage', () => {
      const courses = [makeCourse({ id: 'course-1' })]
      const allProgress = {
        'course-1': {
          courseId: 'course-1',
          completedLessons: ['lesson-1', 'lesson-2', 'lesson-3'],
          notes: {},
          startedAt: '2024-01-01T00:00:00Z',
          lastAccessedAt: '2024-01-02T00:00:00Z',
        },
      }
      const completed = getCompletedCourses(courses, allProgress)
      expect(completed).toHaveLength(1)
    })
  })

  describe('getNotStartedCourses with explicit allProgress', () => {
    it('uses provided allProgress instead of localStorage', () => {
      const courses = [makeCourse({ id: 'course-1' })]
      const allProgress = {}
      const notStarted = getNotStartedCourses(courses, allProgress)
      expect(notStarted).toHaveLength(1)
    })
  })

  describe('getTotalCompletedLessons with explicit allProgress', () => {
    it('uses provided allProgress instead of localStorage', () => {
      const allProgress = {
        'course-1': {
          courseId: 'course-1',
          completedLessons: ['lesson-1', 'lesson-2'],
          notes: {},
          startedAt: '2024-01-01T00:00:00Z',
          lastAccessedAt: '2024-01-02T00:00:00Z',
        },
        'course-2': {
          courseId: 'course-2',
          completedLessons: ['lesson-a'],
          notes: {},
          startedAt: '2024-01-01T00:00:00Z',
          lastAccessedAt: '2024-01-02T00:00:00Z',
        },
      }
      expect(getTotalCompletedLessons(allProgress)).toBe(3)
    })
  })
})
