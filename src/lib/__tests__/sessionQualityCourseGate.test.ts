/**
 * Session quality dialog is gated on full course completion — see useSessionStore.endSession.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { ImportedCourse, ImportedPdf, ImportedVideo, Module } from '@/data/types'

vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

vi.mock('sonner', () => {
  const toastFn = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  })
  return { toast: toastFn }
})

vi.mock('@/lib/toastHelpers', () => ({
  toastWithUndo: vi.fn(),
  toastError: {
    deleteFailed: vi.fn(),
    saveFailed: vi.fn(),
    storageFull: vi.fn(),
  },
}))

vi.mock('@/lib/eventBus', () => ({
  appEventBus: { emit: vi.fn() },
}))

let db: (typeof import('@/db'))['db']
let isCourseFullyCompleteForSessionQuality: (typeof import('@/lib/sessionQualityCourseGate'))['isCourseFullyCompleteForSessionQuality']
let useContentProgressStore: (typeof import('@/stores/useContentProgressStore'))['useContentProgressStore']

const COURSE_ID = 'course-quality-gate-1'
const V1 = 'video-1'
const V2 = 'video-2'

const modulesTwoLessons: Module[] = [
  {
    id: 'mod-1',
    title: 'Module',
    description: '',
    order: 0,
    lessons: [
      {
        id: V1,
        title: 'L1',
        description: '',
        order: 0,
        resources: [],
        keyTopics: [],
      },
      {
        id: V2,
        title: 'L2',
        description: '',
        order: 1,
        resources: [],
        keyTopics: [],
      },
    ],
  },
]

function makeCourse(): ImportedCourse {
  return {
    id: COURSE_ID,
    name: 'Gate Test Course',
    importedAt: new Date().toISOString(),
    category: 'research-library',
    tags: [],
    status: 'active',
    videoCount: 2,
    pdfCount: 0,
    directoryHandle: null,
  }
}

function makeVideo(id: string, order: number): ImportedVideo {
  return {
    id,
    courseId: COURSE_ID,
    filename: `${id}.mp4`,
    path: `/${id}.mp4`,
    duration: 120,
    format: 'mp4',
    order,
    fileHandle: null,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  localStorage.clear()
  vi.resetModules()

  const dbMod = await import('@/db')
  db = dbMod.db

  const gateMod = await import('@/lib/sessionQualityCourseGate')
  isCourseFullyCompleteForSessionQuality = gateMod.isCourseFullyCompleteForSessionQuality

  const progressStoreMod = await import('@/stores/useContentProgressStore')
  useContentProgressStore = progressStoreMod.useContentProgressStore

  await db.importedCourses.add(makeCourse())
  await db.importedVideos.bulkAdd([makeVideo(V1, 0), makeVideo(V2, 1)])
})

describe('isCourseFullyCompleteForSessionQuality', () => {
  it('returns false when no lessons are completed', async () => {
    await act(async () => {
      await useContentProgressStore.getState().loadCourseProgress(COURSE_ID)
    })
    await expect(isCourseFullyCompleteForSessionQuality(COURSE_ID)).resolves.toBe(false)
  })

  it('returns false when only some lessons are completed', async () => {
    await act(async () => {
      await useContentProgressStore.getState().loadCourseProgress(COURSE_ID)
      await useContentProgressStore
        .getState()
        .setItemStatus(COURSE_ID, V1, 'completed', modulesTwoLessons)
    })
    await expect(isCourseFullyCompleteForSessionQuality(COURSE_ID)).resolves.toBe(false)
  })

  it('returns true when every video lesson is completed', async () => {
    await act(async () => {
      await useContentProgressStore.getState().loadCourseProgress(COURSE_ID)
      await useContentProgressStore
        .getState()
        .setItemStatus(COURSE_ID, V1, 'completed', modulesTwoLessons)
      await useContentProgressStore
        .getState()
        .setItemStatus(COURSE_ID, V2, 'completed', modulesTwoLessons)
    })
    await expect(isCourseFullyCompleteForSessionQuality(COURSE_ID)).resolves.toBe(true)
  })
})

describe('isCourseFullyCompleteForSessionQuality (companion PDFs)', () => {
  const COMPANION_COURSE = 'course-companion-gate'
  const V_INTRO = 'v-intro'
  const P_COMPANION = 'p-intro-pdf'
  const P_STANDALONE = 'p-resources'

  const modulesWithStandalonePdf: Module[] = [
    {
      id: 'mod-c',
      title: 'Module',
      description: '',
      order: 0,
      lessons: [
        {
          id: V_INTRO,
          title: 'Intro video',
          description: '',
          order: 0,
          resources: [],
          keyTopics: [],
        },
        {
          id: P_STANDALONE,
          title: 'Resources',
          description: '',
          order: 1,
          resources: [],
          keyTopics: [],
        },
      ],
    },
  ]

  beforeEach(async () => {
    await Dexie.delete('ElearningDB')
    localStorage.clear()
    vi.resetModules()

    const dbMod = await import('@/db')
    db = dbMod.db

    const gateMod = await import('@/lib/sessionQualityCourseGate')
    isCourseFullyCompleteForSessionQuality = gateMod.isCourseFullyCompleteForSessionQuality

    const progressStoreMod = await import('@/stores/useContentProgressStore')
    useContentProgressStore = progressStoreMod.useContentProgressStore

    const course: ImportedCourse = {
      id: COMPANION_COURSE,
      name: 'Companion gate course',
      importedAt: new Date().toISOString(),
      category: 'research-library',
      tags: [],
      status: 'active',
      videoCount: 1,
      pdfCount: 2,
      directoryHandle: null,
    }
    await db.importedCourses.add(course)

    const video: ImportedVideo = {
      id: V_INTRO,
      courseId: COMPANION_COURSE,
      filename: '01-Intro.mp4',
      path: '/intro.mp4',
      duration: 120,
      format: 'mp4',
      order: 1,
      fileHandle: null,
    }
    const pdfCompanion: ImportedPdf = {
      id: P_COMPANION,
      courseId: COMPANION_COURSE,
      filename: '01-Intro.pdf',
      path: '/intro.pdf',
      pageCount: 3,
      fileHandle: {} as FileSystemFileHandle,
    }
    const pdfStandalone: ImportedPdf = {
      id: P_STANDALONE,
      courseId: COMPANION_COURSE,
      filename: 'Resources.pdf',
      path: '/resources.pdf',
      pageCount: 12,
      fileHandle: {} as FileSystemFileHandle,
    }
    await db.importedVideos.add(video)
    await db.importedPdfs.bulkAdd([pdfCompanion, pdfStandalone])
  })

  it('excludes companion PDFs from the completion set (video + standalone PDF only)', async () => {
    await act(async () => {
      await useContentProgressStore.getState().loadCourseProgress(COMPANION_COURSE)
      await useContentProgressStore
        .getState()
        .setItemStatus(COMPANION_COURSE, V_INTRO, 'completed', modulesWithStandalonePdf)
    })
    await expect(isCourseFullyCompleteForSessionQuality(COMPANION_COURSE)).resolves.toBe(false)

    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus(COMPANION_COURSE, P_STANDALONE, 'completed', modulesWithStandalonePdf)
    })
    await expect(isCourseFullyCompleteForSessionQuality(COMPANION_COURSE)).resolves.toBe(true)
  })
})
