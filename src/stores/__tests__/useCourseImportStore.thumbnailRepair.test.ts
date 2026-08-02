import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dexie from 'dexie'
import type { ImportedCourse } from '@/data/types'

const mocks = vi.hoisted(() => ({
  findCourseThumbnailRepair: vi.fn(),
  syncableWrite: vi.fn(),
}))

vi.mock('@/lib/courseThumbnailRepair', () => ({
  findCourseThumbnailRepair: mocks.findCourseThumbnailRepair,
  toCourseThumbnailRecord: (
    courseId: string,
    repair: { kind: 'remote'; url: string; source: 'url' },
    createdAt: string
  ) => ({ courseId, remoteUrl: repair.url, source: repair.source, createdAt }),
}))

vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: mocks.syncableWrite,
}))

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'Legacy YouTube Course',
    importedAt: '2026-08-02T10:00:00.000Z',
    category: 'youtube',
    tags: [],
    status: 'not-started',
    videoCount: 1,
    pdfCount: 0,
    directoryHandle: null,
    source: 'youtube',
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  mocks.findCourseThumbnailRepair.mockReset()
  mocks.syncableWrite.mockReset().mockResolvedValue(undefined)
})

describe('useCourseImportStore thumbnail repair', () => {
  it('persists a recovered remote thumbnail and backfills the course URL', async () => {
    const repairedUrl = 'https://i.ytimg.com/vi/video-1/hqdefault.jpg'
    const course = makeCourse()
    mocks.findCourseThumbnailRepair.mockResolvedValue({
      kind: 'remote',
      url: repairedUrl,
      source: 'url',
    })

    const [{ db }, { useCourseImportStore }] = await Promise.all([
      import('@/db'),
      import('@/stores/useCourseImportStore'),
    ])
    await db.importedCourses.add(course)
    useCourseImportStore.setState({ importedCourses: [course] })

    await useCourseImportStore.getState().repairMissingThumbnails([course.id])

    await expect(db.courseThumbnails.get(course.id)).resolves.toEqual(
      expect.objectContaining({ courseId: course.id, remoteUrl: repairedUrl, source: 'url' })
    )
    expect(useCourseImportStore.getState().thumbnailUrls[course.id]).toBe(repairedUrl)
    expect(useCourseImportStore.getState().importedCourses[0].youtubeThumbnailUrl).toBe(repairedUrl)
    expect(mocks.syncableWrite).toHaveBeenCalledWith(
      'importedCourses',
      'put',
      expect.objectContaining({ id: course.id, youtubeThumbnailUrl: repairedUrl })
    )
  })
})
