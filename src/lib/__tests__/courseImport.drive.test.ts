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

  it('should set pdfCount to 0 (PDF records not persisted yet, deferred to E77B-S03+)', async () => {
    const files = [
      makeDriveFile({ fileId: 'f1', name: 'video.mp4', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'f2', name: 'workbook.pdf', mimeType: 'application/pdf' }),
    ]

    const result = await importCourseFromDrive('folder-1', 'Course with PDF', files)
    expect(result.videoCount).toBe(1)
    expect(result.pdfCount).toBe(0) // Zeroed — ImportedPdf records are not persisted for Drive yet
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

  it('should silently skip non-video, non-PDF files (images, audio, etc.)', async () => {
    const files = [
      makeDriveFile({ fileId: 'v1', name: 'lesson.mp4', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'i1', name: 'cover.png', mimeType: 'image/png' }),
      makeDriveFile({ fileId: 'a1', name: 'audio.mp3', mimeType: 'audio/mpeg' }),
      makeDriveFile({ fileId: 't1', name: 'notes.txt', mimeType: 'text/plain' }),
      makeDriveFile({ fileId: 'j1', name: 'data.json', mimeType: 'application/json' }),
    ]

    const result = await importCourseFromDrive('folder-1', 'Mixed Types', files)
    // Only the video file becomes a lesson
    expect(result.videoCount).toBe(1)

    const db = await getDb()
    const videos = await db.importedVideos.where('courseId').equals(result.id).toArray()
    expect(videos).toHaveLength(1)
    expect(videos[0].driveFileRef?.fileId).toBe('v1')
  })

  it('should throw for invalid fileId format', async () => {
    const files = [
      makeDriveFile({ fileId: 'valid-id_123', name: 'good.mp4', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'invalid/fileId', name: 'bad.mp4', mimeType: 'video/mp4' }),
    ]

    await expect(importCourseFromDrive('folder-1', 'Bad FileIds', files)).rejects.toThrow(
      'Invalid Drive fileId format'
    )

    // Nothing should be persisted when validation fails
    const db = await getDb()
    const allCourses = await db.importedCourses.toArray()
    expect(allCourses).toHaveLength(0)
  })

  it('should throw when syncableWrite fails mid-import leaving orphaned course', async () => {
    const files = [
      makeDriveFile({ fileId: 'f1', name: 'a.mp4', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'f2', name: 'b.mp4', mimeType: 'video/mp4' }),
    ]

    // Spy on syncableWrite after module load — first call delegates to the real
    // function (course write succeeds and persists), second call fails (first video
    // write), simulating a partial failure that leaves an orphaned course record.
    const syncMod = await import('@/lib/sync/syncableWrite')
    const realSyncableWrite = syncMod.syncableWrite
    const spy = vi.spyOn(syncMod, 'syncableWrite')
    spy
      .mockImplementationOnce(async (...args) => realSyncableWrite(...args)) // course write
      .mockRejectedValueOnce(new Error('IndexedDB write failed')) // first video fails

    await expect(importCourseFromDrive('folder-1', 'Orphan Risk', files)).rejects.toThrow(
      'IndexedDB write failed'
    )

    // The course record was written (orphaned) — the first syncableWrite succeeded.
    // This is an expected orphan scenario that the caller must handle.
    const db = await getDb()
    const allCourses = await db.importedCourses.toArray()
    expect(allCourses).toHaveLength(1)
    expect(allCourses[0].name).toBe('Orphan Risk')

    // No video records persisted — second syncableWrite threw
    const allVideos = await db.importedVideos.toArray()
    expect(allVideos).toHaveLength(0)

    spy.mockRestore()
  })

  it('should set driveFileRef.driveSource to "google" on all video records', async () => {
    const files = [
      makeDriveFile({ fileId: 'f1', mimeType: 'video/mp4' }),
      makeDriveFile({ fileId: 'f2', mimeType: 'video/webm' }),
    ]

    const result = await importCourseFromDrive('folder-src', 'Src Test', files)

    // Source should be set to 'drive' for Drive-imported courses
    expect(result.source).toBe('drive')

    const db = await getDb()
    const persisted = await db.importedCourses.get(result.id)
    expect(persisted?.source).toBe('drive')

    const videos = await db.importedVideos.where('courseId').equals(result.id).toArray()
    for (const video of videos) {
      expect(video.driveFileRef?.driveSource).toBe('google')
    }
  })
})
