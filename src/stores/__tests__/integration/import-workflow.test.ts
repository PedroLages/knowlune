/**
 * Cross-Store Integration Test: Import Workflow
 *
 * Verifies that importing a course correctly updates:
 * - useCourseStore (course appears in courses list)
 * - useAuthorStore (author linked to course)
 * - useContentProgressStore (progress entries can be set for imported course)
 *
 * Uses real Dexie with fake-indexeddb (no mocks on persistence layer).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { Course, Module, ImportedCourse } from '@/data/types'

// Mock persistWithRetry to pass-through (retry logic tested elsewhere)
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

// Mock sonner to prevent DOM errors
vi.mock('sonner', () => {
  const toastFn = vi.fn() as ReturnType<typeof vi.fn> & {
    error: ReturnType<typeof vi.fn>
    success: ReturnType<typeof vi.fn>
    warning: ReturnType<typeof vi.fn>
  }
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  toastFn.warning = vi.fn()
  return { toast: toastFn }
})

// Mock thumbnail service (uses canvas/blob APIs unavailable in jsdom)
vi.mock('@/lib/thumbnailService', () => ({
  saveCourseThumbnail: vi.fn(),
  loadCourseThumbnailUrl: vi.fn().mockResolvedValue(null),
  deleteCourseThumbnail: vi.fn(),
}))

// Mock author photo resolver (uses File System Access API)
vi.mock('@/lib/authorPhotoResolver', () => ({
  resolvePhotoHandle: vi.fn().mockResolvedValue(null),
  revokePhotoUrl: vi.fn(),
}))

// Mock toastHelpers
vi.mock('@/lib/toastHelpers', () => ({
  toastWithUndo: vi.fn(),
  toastError: {
    deleteFailed: vi.fn(),
    saveFailed: vi.fn(),
    storageFull: vi.fn(),
  },
}))

// Mock progress bridge (uses localStorage directly)
vi.mock('@/lib/progress', () => ({
  markLessonComplete: vi.fn(),
  markLessonIncomplete: vi.fn(),
}))

let useCourseStore: (typeof import('@/stores/useCourseStore'))['useCourseStore']
let useAuthorStore: (typeof import('@/stores/useAuthorStore'))['useAuthorStore']
let useContentProgressStore: (typeof import('@/stores/useContentProgressStore'))['useContentProgressStore']
let useCourseImportStore: (typeof import('@/stores/useCourseImportStore'))['useCourseImportStore']
let db: (typeof import('@/db'))['db']

const COURSE_ID = 'course-import-1'
const AUTHOR_ID = 'author-import-1'
const LESSON_ID = 'lesson-import-1'
const MODULE_ID = 'mod-import-1'

const testModules: Module[] = [
  {
    id: MODULE_ID,
    title: 'Module 1',
    description: 'First module',
    order: 0,
    lessons: [
      {
        id: LESSON_ID,
        title: 'Lesson 1',
        description: 'First lesson',
        order: 0,
        resources: [],
        keyTopics: [],
        duration: '15:00',
      },
    ],
  },
]

const testCourse: Course = {
  id: COURSE_ID,
  title: 'Integration Test Course',
  shortTitle: 'ITC',
  description: 'A course for integration testing',
  category: 'research-library',
  difficulty: 'beginner',
  totalLessons: 1,
  totalVideos: 1,
  totalPDFs: 0,
  estimatedHours: 1,
  tags: ['test'],
  modules: testModules,
  isSequential: false,
  basePath: '/courses/test',
  authorId: AUTHOR_ID,
}

const testImportedCourse: ImportedCourse = {
  id: COURSE_ID,
  name: 'Integration Test Course',
  importedAt: '2026-03-27T10:00:00.000Z',
  category: 'research-library',
  tags: ['test'],
  status: 'active',
  videoCount: 1,
  pdfCount: 0,
  directoryHandle: null,
  authorId: AUTHOR_ID,
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()

  const dbMod = await import('@/db')
  db = dbMod.db

  const courseStoreMod = await import('@/stores/useCourseStore')
  useCourseStore = courseStoreMod.useCourseStore

  const authorStoreMod = await import('@/stores/useAuthorStore')
  useAuthorStore = authorStoreMod.useAuthorStore

  const progressStoreMod = await import('@/stores/useContentProgressStore')
  useContentProgressStore = progressStoreMod.useContentProgressStore

  const importStoreMod = await import('@/stores/useCourseImportStore')
  useCourseImportStore = importStoreMod.useCourseImportStore

  vi.clearAllMocks()
})

describe('Import Workflow: Cross-Store Integration', () => {
  it('imported course appears in useCourseStore after DB write and load', async () => {
    // Seed: write course directly to DB (simulating import pipeline output)
    await db.courses.put(testCourse)

    // Load into store
    await act(async () => {
      await useCourseStore.getState().loadCourses()
    })

    const courses = useCourseStore.getState().courses
    expect(courses).toHaveLength(1)
    expect(courses[0].id).toBe(COURSE_ID)
    expect(courses[0].title).toBe('Integration Test Course')
    expect(courses[0].authorId).toBe(AUTHOR_ID)
  })

  it('imported course and linked author both appear in their respective stores', async () => {
    // Seed: write imported course via store (simulating real import flow)
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(testImportedCourse)
    })

    // Verify importedCourses store updated
    const importedCourses = useCourseImportStore.getState().importedCourses
    expect(importedCourses).toHaveLength(1)
    expect(importedCourses[0].authorId).toBe(AUTHOR_ID)

    // Verify course persisted to IndexedDB
    const dbCourse = await db.importedCourses.get(COURSE_ID)
    expect(dbCourse).toBeDefined()
    expect(dbCourse!.authorId).toBe(AUTHOR_ID)

    // Now add the author and link the course
    await act(async () => {
      const author = await useAuthorStore.getState().addAuthor({
        name: 'Test Author',
        title: 'Instructor',
        courseIds: [COURSE_ID],
      })
      expect(author.id).toBeDefined()
    })

    // Load authors and verify linkage
    // Reset isLoaded to force reload
    useAuthorStore.setState({ isLoaded: false })
    await act(async () => {
      await useAuthorStore.getState().loadAuthors()
    })

    const authors = useAuthorStore.getState().authors
    expect(authors).toHaveLength(1)
    expect(authors[0].name).toBe('Test Author')
    expect(authors[0].courseIds).toContain(COURSE_ID)
  })

  it('content progress can be set for imported course lessons', async () => {
    // Seed: write course to DB
    await db.courses.put(testCourse)

    // Set progress for the lesson
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus(COURSE_ID, LESSON_ID, 'completed', testModules)
    })

    // Verify store state
    const status = useContentProgressStore.getState().getItemStatus(COURSE_ID, LESSON_ID)
    expect(status).toBe('completed')

    // Verify module status cascaded
    const moduleStatus = useContentProgressStore.getState().getItemStatus(COURSE_ID, MODULE_ID)
    expect(moduleStatus).toBe('completed')

    // Verify persisted to DB
    const dbRecords = await db.contentProgress.where({ courseId: COURSE_ID }).toArray()
    expect(dbRecords).toHaveLength(2) // lesson + module
    expect(dbRecords.find(r => r.itemId === LESSON_ID)?.status).toBe('completed')
    expect(dbRecords.find(r => r.itemId === MODULE_ID)?.status).toBe('completed')
  })

  it('loading course progress after import reflects previously set progress', async () => {
    // Seed: write course + progress to DB
    await db.courses.put(testCourse)
    await db.contentProgress.put({
      courseId: COURSE_ID,
      itemId: LESSON_ID,
      status: 'completed',
      updatedAt: '2026-03-27T10:00:00.000Z',
    })

    // Load progress into store
    await act(async () => {
      await useContentProgressStore.getState().loadCourseProgress(COURSE_ID)
    })

    const status = useContentProgressStore.getState().getItemStatus(COURSE_ID, LESSON_ID)
    expect(status).toBe('completed')
  })

  it('author linkCourseToAuthor updates author courseIds in DB', async () => {
    // Create author without course link
    const author = await useAuthorStore.getState().addAuthor({
      name: 'Unlinked Author',
      title: 'Professor',
      courseIds: [],
    })

    expect(author.courseIds).toEqual([])

    // Link course to author
    await act(async () => {
      await useAuthorStore.getState().linkCourseToAuthor(author.id, COURSE_ID)
    })

    // Verify store updated
    const updatedAuthor = useAuthorStore.getState().getAuthorById(author.id)
    expect(updatedAuthor?.courseIds).toContain(COURSE_ID)

    // Verify DB persisted
    const dbAuthor = await db.authors.get(author.id)
    expect(dbAuthor?.courseIds).toContain(COURSE_ID)
  })
})
