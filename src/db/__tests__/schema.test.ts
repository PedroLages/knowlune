import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'

// Must import after fake-indexeddb/auto polyfill is active
let db: Awaited<typeof import('@/db/schema')>['db']

beforeEach(async () => {
  // Delete any existing database before each test
  await Dexie.delete('ElearningDB')
  // Re-import fresh db instance
  const module = await import('@/db/schema')
  db = module.db
})

function makeCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Test Course',
    importedAt: new Date().toISOString(),
    category: '',
    tags: [] as string[],
    status: 'active' as const,
    videoCount: 0,
    pdfCount: 0,
    directoryHandle: {} as FileSystemDirectoryHandle,
    ...overrides,
  }
}

function makeVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    courseId: crypto.randomUUID(),
    filename: 'lesson-01.mp4',
    path: '/course/lesson-01.mp4',
    duration: 120,
    format: 'mp4' as const,
    order: 1,
    fileHandle: {} as FileSystemFileHandle,
    ...overrides,
  }
}

describe('ElearningDB schema', () => {
  it('should create the database with correct tables', async () => {
    expect(db.name).toBe('ElearningDB')
    expect(db.tables.map(t => t.name).sort()).toEqual([
      'bookmarks',
      'importedCourses',
      'importedPdfs',
      'importedVideos',
      'progress',
    ])
  })

  it('should be at version 3', () => {
    expect(db.verno).toBe(3)
  })
})

describe('importedCourses table', () => {
  it('should add and retrieve a course', async () => {
    const course = makeCourse({
      name: 'React Patterns',
      tags: ['react', 'patterns'],
      videoCount: 10,
      pdfCount: 2,
    })

    await db.importedCourses.add(course)
    const retrieved = await db.importedCourses.get(course.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('React Patterns')
    expect(retrieved!.videoCount).toBe(10)
    expect(retrieved!.pdfCount).toBe(2)
  })

  it('should query courses by name index', async () => {
    const course = makeCourse({ name: 'TypeScript Deep Dive', videoCount: 5 })

    await db.importedCourses.add(course)
    const results = await db.importedCourses.where('name').equals('TypeScript Deep Dive').toArray()
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(course.id)
  })

  it('should query courses by tags multi-entry index', async () => {
    const course1 = makeCourse({ name: 'Course A', tags: ['react', 'frontend'], videoCount: 5 })
    const course2 = makeCourse({
      name: 'Course B',
      tags: ['backend', 'node'],
      videoCount: 3,
      pdfCount: 1,
    })

    await db.importedCourses.bulkAdd([course1, course2])
    const reactCourses = await db.importedCourses.where('tags').equals('react').toArray()
    expect(reactCourses).toHaveLength(1)
    expect(reactCourses[0].name).toBe('Course A')
  })

  it('should delete a course by id', async () => {
    const course = makeCourse({ name: 'To Delete' })
    await db.importedCourses.add(course)

    await db.importedCourses.delete(course.id)
    const result = await db.importedCourses.get(course.id)
    expect(result).toBeUndefined()
  })

  it('should update a course', async () => {
    const course = makeCourse({ name: 'Original Name' })
    await db.importedCourses.add(course)

    await db.importedCourses.update(course.id, { name: 'Updated Name' })
    const updated = await db.importedCourses.get(course.id)
    expect(updated!.name).toBe('Updated Name')
  })
})

describe('importedVideos table', () => {
  it('should add and retrieve videos by courseId', async () => {
    const courseId = crypto.randomUUID()
    const videos = [
      makeVideo({ courseId, filename: 'lesson-01.mp4', path: '/course/lesson-01.mp4', order: 1 }),
      makeVideo({
        courseId,
        filename: 'lesson-02.mp4',
        path: '/course/lesson-02.mp4',
        duration: 240,
        order: 2,
      }),
    ]

    await db.importedVideos.bulkAdd(videos)
    const results = await db.importedVideos.where('courseId').equals(courseId).toArray()
    expect(results).toHaveLength(2)
    expect(results.map(v => v.filename).sort()).toEqual(['lesson-01.mp4', 'lesson-02.mp4'])
  })

  it('should query videos by filename', async () => {
    const video = makeVideo({
      filename: 'unique-video.webm',
      path: '/course/unique-video.webm',
      format: 'webm',
      duration: 60,
    })

    await db.importedVideos.add(video)
    const results = await db.importedVideos.where('filename').equals('unique-video.webm').toArray()
    expect(results).toHaveLength(1)
  })
})

describe('importedPdfs table', () => {
  it('should add and retrieve PDFs by courseId', async () => {
    const courseId = crypto.randomUUID()
    const pdfs = [
      {
        id: crypto.randomUUID(),
        courseId,
        filename: 'workbook.pdf',
        path: '/course/workbook.pdf',
        pageCount: 25,
        fileHandle: {} as FileSystemFileHandle,
      },
    ]

    await db.importedPdfs.bulkAdd(pdfs)
    const results = await db.importedPdfs.where('courseId').equals(courseId).toArray()
    expect(results).toHaveLength(1)
    expect(results[0].pageCount).toBe(25)
  })
})

describe('bulk operations', () => {
  it('should handle bulkAdd for batch imports', async () => {
    const courseId = crypto.randomUUID()
    const videos = Array.from({ length: 50 }, (_, i) =>
      makeVideo({
        courseId,
        filename: `lesson-${String(i + 1).padStart(2, '0')}.mp4`,
        path: `/course/lesson-${String(i + 1).padStart(2, '0')}.mp4`,
        duration: 120 + i * 10,
        order: i + 1,
      })
    )

    await db.importedVideos.bulkAdd(videos)
    const count = await db.importedVideos.where('courseId').equals(courseId).count()
    expect(count).toBe(50)
  })
})
