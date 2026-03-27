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

describe('addImportedCourse error handling', () => {
  it('should rollback on DB failure', async () => {
    const { db } = await import('@/db')
    vi.spyOn(db.importedCourses, 'add').mockRejectedValue(new Error('Write fail'))

    const course = makeCourse({ name: 'Failing course' })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    expect(useCourseImportStore.getState().importedCourses).toHaveLength(0)
    expect(useCourseImportStore.getState().importError).toContain('Failed to save course')
  })
})

describe('removeImportedCourse error handling', () => {
  it('should rollback on DB failure', async () => {
    const course = makeCourse()
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    const { db } = await import('@/db')
    vi.spyOn(db.importedCourses, 'delete').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useCourseImportStore.getState().removeImportedCourse(course.id)
    })

    expect(useCourseImportStore.getState().importedCourses).toHaveLength(1)
    expect(useCourseImportStore.getState().importError).toBe('Failed to remove course')
  })

  it('should revoke thumbnail URL on successful removal', async () => {
    const course = makeCourse()
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    // Set a thumbnail URL
    useCourseImportStore.setState({
      thumbnailUrls: { [course.id]: 'blob:http://localhost/fake' },
    })

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await act(async () => {
      await useCourseImportStore.getState().removeImportedCourse(course.id)
    })

    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/fake')
    expect(useCourseImportStore.getState().thumbnailUrls[course.id]).toBeUndefined()
    revokeSpy.mockRestore()
  })
})

describe('updateCourseTags', () => {
  it('should normalize and persist tags', async () => {
    const course = makeCourse({ tags: ['react'] })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    await act(async () => {
      await useCourseImportStore
        .getState()
        .updateCourseTags(course.id, ['React', 'JavaScript', 'react'])
    })

    const updated = useCourseImportStore.getState().importedCourses.find(c => c.id === course.id)
    // Normalized: lowercase, deduped, sorted
    expect(updated?.tags).toEqual(['javascript', 'react'])
  })

  it('should not update if course not found', async () => {
    await act(async () => {
      await useCourseImportStore.getState().updateCourseTags('nonexistent', ['tag'])
    })
    // No crash
  })

  it('should rollback on DB failure', async () => {
    const course = makeCourse({ tags: ['old'] })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    const { db } = await import('@/db')
    vi.spyOn(db.importedCourses, 'update').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useCourseImportStore.getState().updateCourseTags(course.id, ['new'])
    })

    expect(useCourseImportStore.getState().importedCourses[0].tags).toEqual(['old'])
    expect(useCourseImportStore.getState().importError).toBe('Failed to update tags')
  })
})

describe('updateCourseStatus error handling', () => {
  it('should rollback on DB failure', async () => {
    const course = makeCourse({ status: 'active' })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    const { db } = await import('@/db')
    vi.spyOn(db.importedCourses, 'update').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useCourseImportStore.getState().updateCourseStatus(course.id, 'completed')
    })

    expect(useCourseImportStore.getState().importedCourses[0].status).toBe('active')
    expect(useCourseImportStore.getState().importError).toBe('Failed to update status')
  })
})

describe('updateCourseDetails', () => {
  it('should update multiple fields', async () => {
    const course = makeCourse({ name: 'Old Name', category: 'old' })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    await act(async () => {
      await useCourseImportStore.getState().updateCourseDetails(course.id, {
        name: 'New Name',
        category: 'new',
        tags: ['tag1', 'tag2'],
        description: 'A description',
      })
    })

    const updated = useCourseImportStore.getState().importedCourses[0]
    expect(updated.name).toBe('New Name')
    expect(updated.category).toBe('new')
    expect(updated.tags).toEqual(['tag1', 'tag2'])
    expect(updated.description).toBe('A description')
  })

  it('should return false for non-existent course', async () => {
    const result = await useCourseImportStore
      .getState()
      .updateCourseDetails('nonexistent', { name: 'X' })
    expect(result).toBe(false)
  })

  it('should rollback on DB failure', async () => {
    const course = makeCourse({ name: 'Original' })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    const { db } = await import('@/db')
    vi.spyOn(db.importedCourses, 'update').mockRejectedValue(new Error('fail'))

    const result = await act(async () => {
      return useCourseImportStore.getState().updateCourseDetails(course.id, { name: 'Changed' })
    })

    expect(result).toBe(false)
    expect(useCourseImportStore.getState().importError).toBe('Failed to update course details')
  })

  it('should handle authorId=null to unlink', async () => {
    const course = makeCourse({ authorId: 'a1' })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    await act(async () => {
      await useCourseImportStore.getState().updateCourseDetails(course.id, { authorId: null })
    })

    expect(useCourseImportStore.getState().importedCourses[0].authorId).toBeUndefined()
  })

  it('should trim empty description to undefined', async () => {
    const course = makeCourse({ description: 'Old' })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(course)
    })

    await act(async () => {
      await useCourseImportStore.getState().updateCourseDetails(course.id, { description: '  ' })
    })

    expect(useCourseImportStore.getState().importedCourses[0].description).toBeUndefined()
  })
})

describe('getAllTags', () => {
  it('should return sorted unique tags', async () => {
    const c1 = makeCourse({ tags: ['react', 'typescript'] })
    const c2 = makeCourse({ tags: ['react', 'node'] })

    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(c1)
      await useCourseImportStore.getState().addImportedCourse(c2)
    })

    const tags = useCourseImportStore.getState().getAllTags()
    expect(tags).toEqual(['node', 'react', 'typescript'])
  })
})

describe('getTagsWithCounts', () => {
  it('should return tags with counts, sorted alphabetically', async () => {
    const c1 = makeCourse({ tags: ['react', 'typescript'] })
    const c2 = makeCourse({ tags: ['react', 'node'] })

    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(c1)
      await useCourseImportStore.getState().addImportedCourse(c2)
    })

    const tagsWithCounts = useCourseImportStore.getState().getTagsWithCounts()
    expect(tagsWithCounts).toContainEqual({ tag: 'react', count: 2 })
    expect(tagsWithCounts).toContainEqual({ tag: 'node', count: 1 })
    expect(tagsWithCounts).toContainEqual({ tag: 'typescript', count: 1 })
  })
})

describe('renameTagGlobally', () => {
  it('should rename tag across all courses', async () => {
    const c1 = makeCourse({ tags: ['react', 'js'] })
    const c2 = makeCourse({ tags: ['react'] })

    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(c1)
      await useCourseImportStore.getState().addImportedCourse(c2)
    })

    const result = await act(async () => {
      return useCourseImportStore.getState().renameTagGlobally('react', 'reactjs')
    })

    expect(result).toBe('renamed')
    const tags = useCourseImportStore.getState().getAllTags()
    expect(tags).toContain('reactjs')
    expect(tags).not.toContain('react')
  })

  it('should return merged when target tag already exists', async () => {
    const c1 = makeCourse({ tags: ['react', 'reactjs'] })

    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(c1)
    })

    const result = await act(async () => {
      return useCourseImportStore.getState().renameTagGlobally('react', 'reactjs')
    })

    expect(result).toBe('merged')
  })

  it('should handle same old and new tag', async () => {
    const result = await useCourseImportStore.getState().renameTagGlobally('react', 'react')
    expect(result).toBe('renamed')
  })

  it('should handle empty tags', async () => {
    const result = await useCourseImportStore.getState().renameTagGlobally('', 'new')
    expect(result).toBe('renamed')
  })

  it('should handle no affected courses', async () => {
    const result = await useCourseImportStore.getState().renameTagGlobally('nonexistent', 'new')
    expect(result).toBe('renamed')
  })

  it('should rollback on DB failure', async () => {
    const c1 = makeCourse({ tags: ['react'] })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(c1)
    })

    const { db } = await import('@/db')
    vi.spyOn(db.importedCourses, 'update').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useCourseImportStore.getState().renameTagGlobally('react', 'reactjs')
    })

    expect(useCourseImportStore.getState().importedCourses[0].tags).toContain('react')
    expect(useCourseImportStore.getState().importError).toBe('Failed to rename tag')
  })
})

describe('deleteTagGlobally', () => {
  it('should remove tag from all courses', async () => {
    const c1 = makeCourse({ tags: ['react', 'js'] })
    const c2 = makeCourse({ tags: ['react', 'node'] })

    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(c1)
      await useCourseImportStore.getState().addImportedCourse(c2)
    })

    await act(async () => {
      await useCourseImportStore.getState().deleteTagGlobally('react')
    })

    const tags = useCourseImportStore.getState().getAllTags()
    expect(tags).not.toContain('react')
    expect(tags).toContain('js')
  })

  it('should handle empty tag', async () => {
    await useCourseImportStore.getState().deleteTagGlobally('')
    // No crash
  })

  it('should handle no affected courses', async () => {
    await useCourseImportStore.getState().deleteTagGlobally('nonexistent')
    // No crash
  })

  it('should rollback on DB failure', async () => {
    const c1 = makeCourse({ tags: ['react'] })
    await act(async () => {
      await useCourseImportStore.getState().addImportedCourse(c1)
    })

    const { db } = await import('@/db')
    vi.spyOn(db.importedCourses, 'update').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useCourseImportStore.getState().deleteTagGlobally('react')
    })

    expect(useCourseImportStore.getState().importedCourses[0].tags).toContain('react')
    expect(useCourseImportStore.getState().importError).toBe('Failed to delete tag')
  })
})

describe('loadImportedCourses error handling', () => {
  it('should set error on DB failure', async () => {
    const { db } = await import('@/db')
    vi.spyOn(db.importedCourses, 'toArray').mockRejectedValue(new Error('DB crash'))

    await act(async () => {
      await useCourseImportStore.getState().loadImportedCourses()
    })

    expect(useCourseImportStore.getState().importError).toBe('Failed to load courses from database')
  })
})

describe('setAutoAnalysisStatus', () => {
  it('should set analysis status for a course', () => {
    useCourseImportStore.getState().setAutoAnalysisStatus('c1', 'analyzing')
    expect(useCourseImportStore.getState().autoAnalysisStatus['c1']).toBe('analyzing')

    useCourseImportStore.getState().setAutoAnalysisStatus('c1', 'complete')
    expect(useCourseImportStore.getState().autoAnalysisStatus['c1']).toBe('complete')
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
