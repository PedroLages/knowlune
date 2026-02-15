import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { ImportedCourse } from '@/data/types'

let useCourseImportStore: (typeof import('@/stores/useCourseImportStore'))['useCourseImportStore']

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: crypto.randomUUID(),
    name: 'Test Course',
    importedAt: new Date().toISOString(),
    category: '',
    tags: [],
    status: 'active',
    videoCount: 5,
    pdfCount: 1,
    directoryHandle: {} as FileSystemDirectoryHandle,
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  // Force re-import to get fresh store and db instances
  vi.resetModules()
  const mod = await import('@/stores/useCourseImportStore')
  useCourseImportStore = mod.useCourseImportStore
})

describe('useCourseImportStore initial state', () => {
  it('should have empty initial state', () => {
    const state = useCourseImportStore.getState()
    expect(state.importedCourses).toEqual([])
    expect(state.isImporting).toBe(false)
    expect(state.importError).toBeNull()
    expect(state.importProgress).toBeNull()
  })
})

describe('addImportedCourse', () => {
  it('should add a course optimistically', async () => {
    const course = makeCourse({ name: 'React Patterns' })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    const state = useCourseImportStore.getState()
    expect(state.importedCourses).toHaveLength(1)
    expect(state.importedCourses[0].name).toBe('React Patterns')
    expect(state.importError).toBeNull()
  })

  it('should persist course to IndexedDB', async () => {
    const course = makeCourse()
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    // Verify in IndexedDB via a fresh db import
    const { db } = await import('@/db')
    const stored = await db.importedCourses.get(course.id)
    expect(stored).toBeDefined()
    expect(stored!.name).toBe(course.name)
  })

  it('should add multiple courses', async () => {
    const course1 = makeCourse({ name: 'Course A' })
    const course2 = makeCourse({ name: 'Course B' })

    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course1)
      await useCourseImportStore.getState().addImportedCourse(course2)
    })

    expect(useCourseImportStore.getState().importedCourses).toHaveLength(2)
  })
})

describe('removeImportedCourse', () => {
  it('should remove a course optimistically', async () => {
    const course = makeCourse()
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })
    expect(useCourseImportStore.getState().importedCourses).toHaveLength(1)

    await act(async () => {
      await useCourseImportStore.getState().removeImportedCourse(course.id)
    })
    expect(useCourseImportStore.getState().importedCourses).toHaveLength(0)
  })

  it('should remove course and related records from IndexedDB', async () => {
    const course = makeCourse()
    const { db } = await import('@/db')

    // Add course and some videos/pdfs
    await db.importedCourses.add(course)
    await db.importedVideos.add({
      id: crypto.randomUUID(),
      courseId: course.id,
      filename: 'test.mp4',
      path: '/test.mp4',
      duration: 120,
      format: 'mp4',
      order: 1,
      fileHandle: {} as FileSystemFileHandle,
    })
    await db.importedPdfs.add({
      id: crypto.randomUUID(),
      courseId: course.id,
      filename: 'test.pdf',
      path: '/test.pdf',
      pageCount: 10,
      fileHandle: {} as FileSystemFileHandle,
    })

    // Set store state to include the course
    useCourseImportStore.setState({ importedCourses: [course] })

    await act(async () => {
      await useCourseImportStore.getState().removeImportedCourse(course.id)
    })

    // Verify all records deleted from IndexedDB
    const storedCourse = await db.importedCourses.get(course.id)
    const storedVideos = await db.importedVideos.where('courseId').equals(course.id).count()
    const storedPdfs = await db.importedPdfs.where('courseId').equals(course.id).count()

    expect(storedCourse).toBeUndefined()
    expect(storedVideos).toBe(0)
    expect(storedPdfs).toBe(0)
  })
})

describe('loadImportedCourses', () => {
  it('should load courses from IndexedDB', async () => {
    const { db } = await import('@/db')
    const course = makeCourse({ name: 'Persisted Course' })
    await db.importedCourses.add(course)

    await act(async () => {
      await useCourseImportStore.getState().loadImportedCourses()
    })

    const state = useCourseImportStore.getState()
    expect(state.importedCourses).toHaveLength(1)
    expect(state.importedCourses[0].name).toBe('Persisted Course')
  })

  it('should replace current state with database contents', async () => {
    const { db } = await import('@/db')
    // Set stale state
    useCourseImportStore.setState({
      importedCourses: [makeCourse({ name: 'Stale' })],
    })

    // Put different data in DB
    const freshCourse = makeCourse({ name: 'Fresh' })
    await db.importedCourses.add(freshCourse)

    await act(async () => {
      await useCourseImportStore.getState().loadImportedCourses()
    })

    const state = useCourseImportStore.getState()
    expect(state.importedCourses).toHaveLength(1)
    expect(state.importedCourses[0].name).toBe('Fresh')
  })
})

describe('updateCourseStatus', () => {
  it('should update status optimistically in store', async () => {
    const course = makeCourse({ status: 'active' })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    await act(async () => {
      await useCourseImportStore.getState().updateCourseStatus(course.id, 'completed')
    })

    const updated = useCourseImportStore.getState().importedCourses.find(c => c.id === course.id)
    expect(updated?.status).toBe('completed')
  })

  it('should persist status change to IndexedDB', async () => {
    const course = makeCourse({ status: 'active' })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    await act(async () => {
      await useCourseImportStore.getState().updateCourseStatus(course.id, 'paused')
    })

    const { db } = await import('@/db')
    const stored = await db.importedCourses.get(course.id)
    expect(stored?.status).toBe('paused')
  })

  it('should not update if course does not exist', async () => {
    await act(async () => {
      await useCourseImportStore.getState().updateCourseStatus('nonexistent', 'completed')
    })

    expect(useCourseImportStore.getState().importedCourses).toHaveLength(0)
    expect(useCourseImportStore.getState().importError).toBeNull()
  })
})

describe('setters', () => {
  it('should set importing state', () => {
    useCourseImportStore.getState().setImporting(true)
    expect(useCourseImportStore.getState().isImporting).toBe(true)

    useCourseImportStore.getState().setImporting(false)
    expect(useCourseImportStore.getState().isImporting).toBe(false)
  })

  it('should set import error', () => {
    useCourseImportStore.getState().setImportError('Something went wrong')
    expect(useCourseImportStore.getState().importError).toBe('Something went wrong')

    useCourseImportStore.getState().setImportError(null)
    expect(useCourseImportStore.getState().importError).toBeNull()
  })

  it('should set import progress', () => {
    useCourseImportStore.getState().setImportProgress({ current: 5, total: 10 })
    expect(useCourseImportStore.getState().importProgress).toEqual({ current: 5, total: 10 })

    useCourseImportStore.getState().setImportProgress(null)
    expect(useCourseImportStore.getState().importProgress).toBeNull()
  })
})
