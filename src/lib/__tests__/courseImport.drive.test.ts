import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Dexie from 'dexie'

let importCourseFromDrive: (typeof import('@/lib/courseImport'))['importCourseFromDrive']

beforeEach(async () => {
  vi.clearAllMocks()
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const courseImportModule = await import('@/lib/courseImport')
  importCourseFromDrive = courseImportModule.importCourseFromDrive
})

async function getDb() {
  const { db } = await import('@/db/schema')
  return db
}

function makeDriveFile(
  overrides: Partial<{
    fileId: string
    name: string
    mimeType: string
  }> = {}
) {
  return {
    fileId: crypto.randomUUID(),
    name: 'lesson-01.mp4',
    mimeType: 'video/mp4',
    ...overrides,
  }
}

describe('importCourseFromDrive', () => {
  it('should create a course with sourceDriveId', async () => {
    const folderId = crypto.randomUUID()
    const files = [makeDriveFile({ name: 'intro.mp4' }), makeDriveFile({ name: 'lesson-01.mp4' })]

    const result = await importCourseFromDrive(folderId, 'My Drive Course', files)
    expect(result.sourceDriveId).toBe(folderId)
    expect(result.name).toBe('My Drive Course')
    expect(result.status).toBe('not-started')

    // Verify it's persisted
    const db = await getDb()
    const persisted = await db.importedCourses.get(result.id)
    expect(persisted).toBeDefined()
    expect(persisted!.sourceDriveId).toBe(folderId)
  })

  it('should create video records with driveFileRef for video files', async () => {
    const folderId = crypto.randomUUID()
    const files = [
      makeDriveFile({ fileId: 'f1', name: 'intro.mp4', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'f2', name: 'part2.webm', mimeType: 'video/webm' }),
    ]

    const result = await importCourseFromDrive(folderId, 'Video Course', files)

    const db = await getDb()
    const videos = await db.importedVideos.where('courseId').equals(result.id).toArray()

    expect(videos).toHaveLength(2)
    const v1 = videos.find(v => v.filename === 'intro.mp4')
    const v2 = videos.find(v => v.filename === 'part2.webm')
    expect(v1?.driveFileRef).toEqual({ fileId: 'f1', driveSource: 'google' })
    expect(v2?.driveFileRef).toEqual({ fileId: 'f2', driveSource: 'google' })
  })

  it('should filter out non-video files', async () => {
    const files = [
      makeDriveFile({ fileId: 'f1', name: 'intro.mp4', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'f2', name: 'notes.pdf', mimeType: 'application/pdf' }),
      makeDriveFile({ fileId: 'f3', name: 'image.png', mimeType: 'image/png' }),
    ]

    const result = await importCourseFromDrive('folder-1', 'Filtered', files)

    const db = await getDb()
    const videos = await db.importedVideos.where('courseId').equals(result.id).toArray()
    expect(videos).toHaveLength(1)
    expect(videos[0].driveFileRef?.fileId).toBe('f1')
  })

  it('should set pdfCount from PDF files', async () => {
    const files = [
      makeDriveFile({ fileId: 'f1', name: 'video.mp4', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'f2', name: 'workbook.pdf', mimeType: 'application/pdf' }),
    ]

    const result = await importCourseFromDrive('folder-1', 'Course with PDF', files)
    expect(result.videoCount).toBe(1)
    expect(result.pdfCount).toBe(1)
  })

  it('should assign sequential order numbers matching input array order', async () => {
    const files = [
      makeDriveFile({ fileId: 'f3', name: 'c.mp4', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'f1', name: 'a.mp4', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'f2', name: 'b.mp4', mimeType: 'video/mp4' }),
    ]

    const result = await importCourseFromDrive('folder-1', 'Ordered', files)

    const db = await getDb()
    const videos = await db.importedVideos.where('courseId').equals(result.id).sortBy('order')
    expect(videos).toHaveLength(3)
    // First input file gets order 1, second gets order 2, etc.
    expect(videos[0].filename).toBe('c.mp4')
    expect(videos[0].order).toBe(1)
    expect(videos[1].filename).toBe('a.mp4')
    expect(videos[1].order).toBe(2)
    expect(videos[2].filename).toBe('b.mp4')
    expect(videos[2].order).toBe(3)
  })

  it('should handle empty file list gracefully', async () => {
    const result = await importCourseFromDrive('empty-folder', 'Empty', [])
    expect(result.videoCount).toBe(0)
    expect(result.pdfCount).toBe(0)

    const db = await getDb()
    const videos = await db.importedVideos.where('courseId').equals(result.id).toArray()
    expect(videos).toHaveLength(0)
  })

  it('should set driveFileRef.driveSource to "google" on all video records', async () => {
    const files = [
      makeDriveFile({ fileId: 'f1', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'f2', mimeType: 'video/webm' }),
    ]

    const result = await importCourseFromDrive('folder-src', 'Src Test', files)

    const db = await getDb()
    const videos = await db.importedVideos.where('courseId').equals(result.id).toArray()
    for (const video of videos) {
      expect(video.driveFileRef?.driveSource).toBe('google')
    }
  })
})
