import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Dexie from 'dexie'
import type { DriveFileRef } from '@/data/types'

const DB_NAME = 'MigrationV66Test'

beforeEach(async () => {
  await Dexie.delete(DB_NAME)
})

afterEach(async () => {
  await Dexie.delete(DB_NAME)
})

async function openWithFullMigrations(): Promise<Dexie> {
  const { declareLegacyMigrations } = await import('../schema')
  const newDb = new Dexie(DB_NAME)
  declareLegacyMigrations(newDb)
  await newDb.open()
  return newDb
}

describe('v66 drive source migration', () => {
  it('should be at version 66', async () => {
    const db = await openWithFullMigrations()
    expect(db.verno).toBe(66)
    db.close()
  })

  it('should allow reading and writing sourceDriveId on importedCourses', async () => {
    const db = await openWithFullMigrations()
    const courseId = crypto.randomUUID()
    const folderId = crypto.randomUUID()

    await db.table('importedCourses').add({
      id: courseId,
      name: 'Drive Course',
      importedAt: new Date().toISOString(),
      category: '',
      tags: [],
      status: 'not-started' as const,
      videoCount: 3,
      pdfCount: 0,
      directoryHandle: {} as FileSystemDirectoryHandle,
      sourceDriveId: folderId,
    })

    const retrieved = await db.table('importedCourses').get(courseId)
    expect(retrieved).toBeDefined()
    expect(retrieved!.sourceDriveId).toBe(folderId)
    db.close()
  })

  it('should allow reading and writing driveFileRef on importedVideos', async () => {
    const db = await openWithFullMigrations()
    const courseId = crypto.randomUUID()
    const videoId = crypto.randomUUID()
    const fileId = crypto.randomUUID()
    const ref: DriveFileRef = { fileId, driveSource: 'google' }

    await db.table('importedVideos').add({
      id: videoId,
      courseId,
      filename: 'lesson-01.mp4',
      path: '',
      duration: 0,
      format: 'mp4' as const,
      order: 1,
      fileHandle: null as unknown as FileSystemFileHandle,
      driveFileRef: ref,
    })

    const retrieved = await db.table('importedVideos').get(videoId)
    expect(retrieved).toBeDefined()
    expect(retrieved!.driveFileRef).toEqual(ref)
    expect(retrieved!.driveFileRef!.fileId).toBe(fileId)
    expect(retrieved!.driveFileRef!.driveSource).toBe('google')
    db.close()
  })

  it('should preserve existing records without the new fields (backward compatibility)', async () => {
    const db = await openWithFullMigrations()
    const courseId = crypto.randomUUID()

    // Write a course without sourceDriveId
    await db.table('importedCourses').add({
      id: courseId,
      name: 'Legacy Course',
      importedAt: new Date().toISOString(),
      category: '',
      tags: [],
      status: 'active' as const,
      videoCount: 5,
      pdfCount: 2,
      directoryHandle: {} as FileSystemDirectoryHandle,
    })

    const retrieved = await db.table('importedCourses').get(courseId)
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('Legacy Course')
    expect(retrieved!.sourceDriveId).toBeUndefined()
    db.close()
  })

  it('should allow mixed records — some with driveFileRef, some without', async () => {
    const db = await openWithFullMigrations()
    const courseId = crypto.randomUUID()

    // Video with driveFileRef
    const videoWithRef = {
      id: crypto.randomUUID(),
      courseId,
      filename: 'drive-video.mp4',
      path: '',
      duration: 0,
      format: 'mp4' as const,
      order: 1,
      fileHandle: null as unknown as FileSystemFileHandle,
      driveFileRef: { fileId: crypto.randomUUID(), driveSource: 'google' } as DriveFileRef,
    }

    // Video without driveFileRef (legacy)
    const videoWithoutRef = {
      id: crypto.randomUUID(),
      courseId,
      filename: 'local-video.mp4',
      path: '/course/local-video.mp4',
      duration: 120,
      format: 'mp4' as const,
      order: 2,
      fileHandle: {} as FileSystemFileHandle,
    }

    await db.table('importedVideos').bulkAdd([videoWithRef, videoWithoutRef])

    const retrieved = await db.table('importedVideos').where('courseId').equals(courseId).toArray()
    expect(retrieved).toHaveLength(2)

    const withRef = retrieved.find(v => v.id === videoWithRef.id)
    expect(withRef!.driveFileRef).toBeDefined()
    expect(withRef!.driveFileRef!.driveSource).toBe('google')

    const withoutRef = retrieved.find(v => v.id === videoWithoutRef.id)
    expect(withoutRef!.driveFileRef).toBeUndefined()

    db.close()
  })
})
