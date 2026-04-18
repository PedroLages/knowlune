import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { Module } from '@/data/types'

let useContentProgressStore: (typeof import('@/stores/useContentProgressStore'))['useContentProgressStore']
let db: (typeof import('@/db'))['db']

const mockModules: Module[] = [
  {
    id: 'mod-1',
    title: 'Module 1',
    description: '',
    order: 1,
    lessons: [
      { id: 'les-1', title: 'Lesson 1', description: '', order: 1, resources: [], keyTopics: [] },
      { id: 'les-2', title: 'Lesson 2', description: '', order: 2, resources: [], keyTopics: [] },
    ],
  },
]

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const storeMod = await import('@/stores/useContentProgressStore')
  useContentProgressStore = storeMod.useContentProgressStore
  const dbMod = await import('@/db')
  db = dbMod.db
})

describe('useContentProgressStore initial state', () => {
  it('should have empty initial state', () => {
    const state = useContentProgressStore.getState()
    expect(state.statusMap).toEqual({})
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})

describe('getItemStatus', () => {
  it('should return not-started for unknown items', () => {
    const status = useContentProgressStore.getState().getItemStatus('course-1', 'unknown')
    expect(status).toBe('not-started')
  })
})

describe('setItemStatus', () => {
  it('should update statusMap optimistically', async () => {
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'completed', mockModules)
    })

    const status = useContentProgressStore.getState().getItemStatus('c1', 'les-1')
    expect(status).toBe('completed')
  })

  it('should persist to IndexedDB', async () => {
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'in-progress', mockModules)
    })

    const records = await db.contentProgress.where({ courseId: 'c1' }).toArray()
    const lessonRecord = records.find(r => r.itemId === 'les-1')
    expect(lessonRecord).toBeDefined()
    expect(lessonRecord!.status).toBe('in-progress')
  })

  it('should cascade to parent module when all children completed', async () => {
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'completed', mockModules)
    })
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-2', 'completed', mockModules)
    })

    const moduleStatus = useContentProgressStore.getState().getItemStatus('c1', 'mod-1')
    expect(moduleStatus).toBe('completed')
  })

  it('should derive in-progress when children have mixed statuses', async () => {
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'completed', mockModules)
    })

    const moduleStatus = useContentProgressStore.getState().getItemStatus('c1', 'mod-1')
    expect(moduleStatus).toBe('in-progress')
  })

  it('should derive not-started when all children are not-started', async () => {
    // Set one to completed, then back to not-started
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'completed', mockModules)
    })
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'not-started', mockModules)
    })

    const moduleStatus = useContentProgressStore.getState().getItemStatus('c1', 'mod-1')
    expect(moduleStatus).toBe('not-started')
  })

  it('should persist cascade records to IndexedDB', async () => {
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'completed', mockModules)
    })
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-2', 'completed', mockModules)
    })

    const records = await db.contentProgress.where({ courseId: 'c1' }).toArray()
    const moduleRecord = records.find(r => r.itemId === 'mod-1')
    expect(moduleRecord).toBeDefined()
    expect(moduleRecord!.status).toBe('completed')
  })

  it('should rollback on persistence failure', async () => {
    // Set initial state
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'completed', mockModules)
    })

    // E92-S09: writes now route through syncableWrite → db.table('contentProgress').put.
    // Mock both call paths so the rollback fires regardless of which API persistWithRetry hits.
    const originalPut = db.contentProgress.put.bind(db.contentProgress)
    vi.spyOn(db.contentProgress, 'put').mockRejectedValue(new Error('DB write failed'))
    const originalTablePut = db.table('contentProgress').put.bind(db.table('contentProgress'))
    vi.spyOn(db.table('contentProgress'), 'put').mockRejectedValue(new Error('DB write failed'))

    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'in-progress', mockModules)
    })

    // Should rollback Zustand state to previous value
    const status = useContentProgressStore.getState().getItemStatus('c1', 'les-1')
    expect(status).toBe('completed')
    expect(useContentProgressStore.getState().error).toBe('Failed to save progress')

    // Should rollback localStorage progress bridge (lesson should still be in completedLessons)
    const progressRaw = localStorage.getItem('course-progress')
    if (progressRaw) {
      const allProgress = JSON.parse(progressRaw)
      const courseProgress = allProgress['c1']
      if (courseProgress) {
        expect(courseProgress.completedLessons).toContain('les-1')
      }
    }

    // Restore originals
    vi.mocked(db.contentProgress.put).mockImplementation(originalPut)
    vi.mocked(db.table('contentProgress').put).mockImplementation(originalTablePut)
  })
})

describe('loadCourseProgress', () => {
  it('should load records from IndexedDB into statusMap', async () => {
    // Seed data directly
    await db.contentProgress.put({
      courseId: 'c1',
      itemId: 'les-1',
      status: 'completed',
      updatedAt: new Date().toISOString(),
    })

    await act(async () => {
      await useContentProgressStore.getState().loadCourseProgress('c1')
    })

    const status = useContentProgressStore.getState().getItemStatus('c1', 'les-1')
    expect(status).toBe('completed')
    expect(useContentProgressStore.getState().isLoading).toBe(false)
  })

  it('should clear stale entries for the course before loading', async () => {
    // Set a status via the store
    await act(async () => {
      await useContentProgressStore
        .getState()
        .setItemStatus('c1', 'les-1', 'completed', mockModules)
    })

    // Delete from DB directly (simulating stale data)
    await db.contentProgress.where({ courseId: 'c1' }).delete()

    // Reload — should clear the stale entry
    await act(async () => {
      await useContentProgressStore.getState().loadCourseProgress('c1')
    })

    const status = useContentProgressStore.getState().getItemStatus('c1', 'les-1')
    expect(status).toBe('not-started')
  })

  it('should set error on failure', async () => {
    vi.spyOn(db.contentProgress, 'where').mockImplementation(() => {
      throw new Error('DB read failed')
    })

    await act(async () => {
      await useContentProgressStore.getState().loadCourseProgress('c1')
    })

    expect(useContentProgressStore.getState().error).toBe('Failed to load progress')
    expect(useContentProgressStore.getState().isLoading).toBe(false)

    vi.restoreAllMocks()
  })
})
