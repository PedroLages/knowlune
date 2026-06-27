import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { LearningPath, LearningPathEntry } from '@/data/types'

// Mock toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

// Mock persistWithRetry to just run the fn
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: (fn: () => Promise<void>) => fn(),
}))

// Mock AI tracking
vi.mock('@/lib/aiEventTracking', () => ({
  trackAIUsage: vi.fn().mockResolvedValue(undefined),
}))

let useLearningPathStore: (typeof import('@/stores/useLearningPathStore'))['useLearningPathStore']
let db: (typeof import('@/db/schema'))['db']
// E96-S02: writes now route through syncableWrite. Error-path tests that
// previously mocked Dexie table methods now mock this instead.
let syncableWriteModule: typeof import('@/lib/sync/syncableWrite')

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const storeMod = await import('@/stores/useLearningPathStore')
  useLearningPathStore = storeMod.useLearningPathStore
  const dbMod = await import('@/db/schema')
  db = dbMod.db
  syncableWriteModule = await import('@/lib/sync/syncableWrite')
})

describe('useLearningPathStore initial state', () => {
  it('should have correct defaults', () => {
    const state = useLearningPathStore.getState()
    expect(state.paths).toEqual([])
    expect(state.entries).toEqual([])
    expect(state.activePath).toBeNull()
    expect(state.isGenerating).toBe(false)
    expect(state.error).toBeNull()
  })
})

describe('loadPaths', () => {
  it('should load paths and entries from Dexie', async () => {
    const path = {
      id: 'p1',
      name: 'My Path',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      isAIGenerated: false,
    }
    await db.learningPaths.add(path)
    await db.learningPathEntries.add({
      id: 'e1',
      pathId: 'p1',
      courseId: 'c1',
      courseType: 'imported',
      position: 1,
      isManuallyOrdered: false,
    })

    await act(async () => {
      await useLearningPathStore.getState().loadPaths()
    })

    const state = useLearningPathStore.getState()
    expect(state.paths).toHaveLength(1)
    expect(state.entries).toHaveLength(1)
    expect(state.activePath).toEqual(path)
    expect(state.error).toBeNull()
  })

  it('should handle DB error', async () => {
    vi.spyOn(db.learningPaths, 'toArray').mockRejectedValue(new Error('DB fail'))

    await act(async () => {
      await useLearningPathStore.getState().loadPaths()
    })

    expect(useLearningPathStore.getState().error).toBe(
      'Failed to load learning paths from database'
    )
  })
})

describe('createPath', () => {
  it('should create a new path', async () => {
    const path = await act(async () => {
      return useLearningPathStore.getState().createPath('Test Path', 'Description')
    })

    expect(path.name).toBe('Test Path')
    expect(path.description).toBe('Description')

    const state = useLearningPathStore.getState()
    expect(state.paths).toHaveLength(1)
    expect(state.activePath).toBeTruthy()

    // Verify DB persistence
    const stored = await db.learningPaths.get(path.id)
    expect(stored!.name).toBe('Test Path')
  })

  it('should set as activePath if none exists', async () => {
    expect(useLearningPathStore.getState().activePath).toBeNull()

    await act(async () => {
      await useLearningPathStore.getState().createPath('First Path')
    })

    expect(useLearningPathStore.getState().activePath).toBeTruthy()
  })

  it('should rollback on DB error', async () => {
    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('Write fail'))

    try {
      await act(async () => {
        await useLearningPathStore.getState().createPath('Failing Path')
      })
    } catch {
      // createPath re-throws on error
    }

    expect(useLearningPathStore.getState().error).toBe('Failed to create learning path')
  })
})

describe('renamePath', () => {
  it('should rename path optimistically and persist', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Original')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().renamePath(pathId, 'Renamed')
    })

    expect(useLearningPathStore.getState().paths[0].name).toBe('Renamed')
    expect(useLearningPathStore.getState().activePath?.name).toBe('Renamed')
  })

  it('should rollback on DB error', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Original')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useLearningPathStore.getState().renamePath(pathId, 'Renamed')
    })

    expect(useLearningPathStore.getState().error).toBe('Failed to rename learning path')
  })
})

describe('updateDescription', () => {
  it('should update description', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().updateDescription(pathId, 'New desc')
    })

    expect(useLearningPathStore.getState().paths[0].description).toBe('New desc')
    expect(useLearningPathStore.getState().activePath?.description).toBe('New desc')
  })

  it('should rollback on error', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path', 'Old desc')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useLearningPathStore.getState().updateDescription(pathId, 'New desc')
    })

    expect(useLearningPathStore.getState().error).toBe('Failed to update path description')
  })
})

describe('deletePath', () => {
  it('should remove path and its entries', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('To Delete')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await db.learningPathEntries.add({
      id: 'e1',
      pathId,
      courseId: 'c1',
      courseType: 'imported',
      position: 1,
      isManuallyOrdered: false,
    })
    useLearningPathStore.setState(state => ({
      entries: [
        ...state.entries,
        {
          id: 'e1',
          pathId,
          courseId: 'c1',
          courseType: 'imported' as const,
          position: 1,
          isManuallyOrdered: false,
        },
      ],
    }))

    await act(async () => {
      await useLearningPathStore.getState().deletePath(pathId)
    })

    expect(useLearningPathStore.getState().paths).toHaveLength(0)
    expect(useLearningPathStore.getState().entries).toHaveLength(0)
    expect(useLearningPathStore.getState().activePath).toBeNull()
  })
})

describe('setActivePath', () => {
  it('should set activePath to matching path', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path 1')
      await useLearningPathStore.getState().createPath('Path 2')
    })

    const path2 = useLearningPathStore.getState().paths[1]
    useLearningPathStore.getState().setActivePath(path2.id)
    expect(useLearningPathStore.getState().activePath?.id).toBe(path2.id)
  })

  it('should not change activePath for non-existent id', () => {
    useLearningPathStore.getState().setActivePath('nonexistent')
    expect(useLearningPathStore.getState().activePath).toBeNull()
  })
})

describe('addCourseToPath', () => {
  it('should add course entry', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported', 'Good course')
    })

    const entries = useLearningPathStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0].courseId).toBe('c1')
    expect(entries[0].justification).toBe('Good course')
    expect(entries[0].position).toBe(1)
  })

  it('should prevent duplicate course in same path', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported') // duplicate
    })

    expect(useLearningPathStore.getState().entries).toHaveLength(1)
    expect(useLearningPathStore.getState().error).toBe('Course is already in this learning path')
  })

  it('should rollback on DB error', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
    })

    expect(useLearningPathStore.getState().error).toBe('Failed to add course to learning path')
  })
})

describe('removeCourseFromPath', () => {
  it('should remove course and recalculate positions', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c2', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c3', 'imported')
    })

    await act(async () => {
      await useLearningPathStore.getState().removeCourseFromPath(pathId, 'c2')
    })

    const entries = useLearningPathStore.getState().getEntriesForPath(pathId)
    expect(entries).toHaveLength(2)
    expect(entries[0].courseId).toBe('c1')
    expect(entries[0].position).toBe(1)
    expect(entries[1].courseId).toBe('c3')
    expect(entries[1].position).toBe(2)
  })

  it('should do nothing if course not found', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().removeCourseFromPath(pathId, 'nonexistent')
    })
    // No error, no crash
  })

  it('should rollback on DB error', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
    })

    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useLearningPathStore.getState().removeCourseFromPath(pathId, 'c1')
    })

    expect(useLearningPathStore.getState().error).toBe('Failed to remove course from learning path')
  })
})

describe('reorderCourse', () => {
  it('should reorder entries', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c2', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c3', 'imported')
    })

    await act(async () => {
      await useLearningPathStore.getState().reorderCourse(pathId, 2, 0)
    })

    const entries = useLearningPathStore.getState().getEntriesForPath(pathId)
    const path = useLearningPathStore.getState().paths.find(p => p.id === pathId)
    expect(entries[0].courseId).toBe('c3')
    expect(path?.orderMode).toBe('custom')
  })

  it('should do nothing when fromIndex equals toIndex', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
    })

    await act(async () => {
      await useLearningPathStore.getState().reorderCourse(pathId, 0, 0)
    })

    // No change
    const entries = useLearningPathStore.getState().getEntriesForPath(pathId)
    expect(entries[0].courseId).toBe('c1')
  })

  it('reorderPathCourses keeps gap slots fixed when moving among real courses', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c2', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c3', 'imported')
    })

    await db.learningPathEntries.where('pathId').equals(pathId).delete()

    const fixed = new Date().toISOString()
    await db.learningPathEntries.bulkPut([
      {
        id: 'e-gap-reorder-1',
        pathId,
        courseId: 'c1',
        courseType: 'imported',
        position: 1,
        isManuallyOrdered: false,
      },
      {
        id: 'e-gap-reorder-gap',
        pathId,
        courseId: '',
        courseType: 'imported',
        position: 2,
        justification: 'gap',
        isManuallyOrdered: false,
      },
      {
        id: 'e-gap-reorder-2',
        pathId,
        courseId: 'c2',
        courseType: 'imported',
        position: 3,
        isManuallyOrdered: false,
      },
      {
        id: 'e-gap-reorder-3',
        pathId,
        courseId: 'c3',
        courseType: 'imported',
        position: 4,
        isManuallyOrdered: false,
      },
    ])
    await db.learningPaths.update(pathId, { updatedAt: fixed })

    const pathRows = await db.learningPathEntries.where('pathId').equals(pathId).toArray()
    useLearningPathStore.setState(state => ({
      entries: [...state.entries.filter(e => e.pathId !== pathId), ...pathRows],
    }))

    await act(async () => {
      await useLearningPathStore.getState().reorderPathCourses(pathId, 'c3', 'c1')
    })

    const entries = useLearningPathStore.getState().getEntriesForPath(pathId)
    const path = useLearningPathStore.getState().paths.find(p => p.id === pathId)
    expect(entries.map(e => e.courseId)).toEqual(['c3', '', 'c1', 'c2'])
    expect(entries[0].position).toBe(1)
    expect(entries[1].position).toBe(2)
    expect(entries[2].position).toBe(3)
    expect(entries[3].position).toBe(4)
    expect(path?.orderMode).toBe('custom')
  })
})

describe('clearPath', () => {
  it('should remove all entries for a path', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c2', 'imported')
    })

    await act(async () => {
      await useLearningPathStore.getState().clearPath(pathId)
    })

    expect(useLearningPathStore.getState().getEntriesForPath(pathId)).toHaveLength(0)
  })

  it('should handle DB error', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    // Seed at least one entry so clearPath has something to delete.
    await db.learningPathEntries.add({
      id: 'e-fail-1',
      pathId,
      courseId: 'c1',
      courseType: 'imported',
      position: 1,
      isManuallyOrdered: false,
    })

    // Force the syncableWrite delete to fail.
    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useLearningPathStore.getState().clearPath(pathId)
    })

    expect(useLearningPathStore.getState().error).toBe('Failed to clear learning path')
  })
})

describe('applyAIOrder', () => {
  it('should reorder entries according to AI suggestions', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c2', 'imported')
    })

    await act(async () => {
      await useLearningPathStore.getState().applyAIOrder(pathId, [
        { courseId: 'c2', position: 1, justification: 'Start here' },
        { courseId: 'c1', position: 2, justification: 'Then this' },
      ])
    })

    const entries = useLearningPathStore.getState().getEntriesForPath(pathId)
    expect(entries[0].courseId).toBe('c2')
    expect(entries[0].justification).toBe('Start here')
    expect(entries[1].courseId).toBe('c1')
  })
})

describe('generatePath', () => {
  it('should set error when less than 2 courses exist', async () => {
    // importedCourses empty in DB
    await act(async () => {
      await useLearningPathStore.getState().generatePath()
    })

    expect(useLearningPathStore.getState().error).toBe(
      'At least 2 courses are needed to generate a learning path'
    )
    expect(useLearningPathStore.getState().isGenerating).toBe(false)
  })

  it('should set error when only 1 course exists', async () => {
    await db.importedCourses.add({
      id: 'c1',
      name: 'Only Course',
      importedAt: '2026-01-01',
      category: '',
      tags: [],
      status: 'active',
      videoCount: 1,
      pdfCount: 0,
      directoryHandle: null,
    })

    await act(async () => {
      await useLearningPathStore.getState().generatePath()
    })

    expect(useLearningPathStore.getState().error).toBe(
      'At least 2 courses are needed to generate a learning path'
    )
  })

  it('should handle AI generation error', async () => {
    // Add 2 courses to pass the length check
    await db.importedCourses.bulkAdd([
      {
        id: 'c1',
        name: 'Course 1',
        importedAt: '2026-01-01',
        category: '',
        tags: [],
        status: 'active',
        videoCount: 1,
        pdfCount: 0,
        directoryHandle: null,
      },
      {
        id: 'c2',
        name: 'Course 2',
        importedAt: '2026-01-01',
        category: '',
        tags: [],
        status: 'active',
        videoCount: 1,
        pdfCount: 0,
        directoryHandle: null,
      },
    ])

    // Create an active path
    await act(async () => {
      await useLearningPathStore.getState().createPath('Test Path')
    })

    // Mock the dynamic import to throw
    vi.doMock('@/ai/learningPath/generatePath', () => ({
      generateLearningPath: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
    }))

    await act(async () => {
      await useLearningPathStore.getState().generatePath()
    })

    expect(useLearningPathStore.getState().isGenerating).toBe(false)
    expect(useLearningPathStore.getState().error).toBe('AI service unavailable')
  })
})

describe('regeneratePath', () => {
  it('should call clearPath then generatePath', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })

    // generatePath will fail (not enough courses) but we verify the flow
    await act(async () => {
      await useLearningPathStore.getState().regeneratePath()
    })

    expect(useLearningPathStore.getState().error).toBe(
      'At least 2 courses are needed to generate a learning path'
    )
  })
})

describe('reorderCourse error handling', () => {
  it('should set error on DB failure', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c2', 'imported')
    })

    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useLearningPathStore.getState().reorderCourse(pathId, 0, 1)
    })

    expect(useLearningPathStore.getState().error).toBe('Failed to save reordering')
  })
})

describe('applyAIOrder error handling', () => {
  it('should set error on DB failure', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
    })

    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useLearningPathStore
        .getState()
        .applyAIOrder(pathId, [{ courseId: 'c1', position: 1, justification: 'test' }])
    })

    expect(useLearningPathStore.getState().error).toBe('Failed to save AI-suggested order')
  })
})

describe('createPathWithCourses', () => {
  it('should create path and add all courses', async () => {
    const path = await act(async () => {
      return useLearningPathStore.getState().createPathWithCourses('My Path', 'Desc', [
        { courseId: 'c1', courseType: 'imported', completionTarget: undefined },
        { courseId: 'c2', courseType: 'imported', completionTarget: undefined },
      ])
    })

    expect(path.name).toBe('My Path')
    expect(path.description).toBe('Desc')

    const state = useLearningPathStore.getState()
    expect(state.paths).toHaveLength(1)
    expect(state.entries).toHaveLength(2)
    expect(state.entries[0].courseId).toBe('c1')
    expect(state.entries[0].position).toBe(1)
    expect(state.entries[1].courseId).toBe('c2')
    expect(state.entries[1].position).toBe(2)
  })

  it('should skip duplicate course IDs', async () => {
    await act(async () => {
      return useLearningPathStore.getState().createPathWithCourses('Path', undefined, [
        { courseId: 'c1', courseType: 'imported', completionTarget: undefined },
        { courseId: 'c1', courseType: 'imported', completionTarget: undefined },
        { courseId: 'c2', courseType: 'imported', completionTarget: undefined },
      ])
    })

    expect(useLearningPathStore.getState().entries).toHaveLength(2)
  })

  it('should create path even with empty courses array', async () => {
    const path = await act(async () => {
      return useLearningPathStore.getState().createPathWithCourses('Empty Path', undefined, [])
    })

    expect(path.name).toBe('Empty Path')
    const state = useLearningPathStore.getState()
    expect(state.paths).toHaveLength(1)
    expect(state.entries).toHaveLength(0)
  })

  it('should rollback on syncableWrite failure', async () => {
    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('Write fail'))

    try {
      await act(async () => {
        await useLearningPathStore
          .getState()
          .createPathWithCourses('Fail', undefined, [
            { courseId: 'c1', courseType: 'imported', completionTarget: undefined },
          ])
      })
    } catch {
      // Expected to throw
    }

    const state = useLearningPathStore.getState()
    expect(state.paths).toHaveLength(0)
    expect(state.entries).toHaveLength(0)
    expect(state.error).toBe('Failed to create learning path with courses')
  })
})

describe('batchAddCoursesToPath', () => {
  it('should add courses to an existing path', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().batchAddCoursesToPath(pathId, [
        { courseId: 'c1', courseType: 'imported', completionTarget: undefined },
        { courseId: 'c2', courseType: 'imported', completionTarget: undefined },
      ])
    })

    const entries = useLearningPathStore.getState().entries
    expect(entries).toHaveLength(2)
    expect(entries[0].courseId).toBe('c1')
    expect(entries[0].position).toBe(1)
    expect(entries[1].courseId).toBe('c2')
    expect(entries[1].position).toBe(2)
  })

  it('should skip duplicates with existing entries', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    // Add c1 first
    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
    })

    // Try batch-adding c1 (duplicate) and c2
    await act(async () => {
      await useLearningPathStore.getState().batchAddCoursesToPath(pathId, [
        { courseId: 'c1', courseType: 'imported', completionTarget: undefined },
        { courseId: 'c2', courseType: 'imported', completionTarget: undefined },
      ])
    })

    const entries = useLearningPathStore.getState().entries
    expect(entries).toHaveLength(2)
    expect(entries[1].courseId).toBe('c2')
  })

  it('should do nothing for empty courses', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().batchAddCoursesToPath(pathId, [])
    })

    expect(useLearningPathStore.getState().entries).toHaveLength(0)
  })

  it('should rollback on DB error', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await expect(
        useLearningPathStore
          .getState()
          .batchAddCoursesToPath(pathId, [
            { courseId: 'c1', courseType: 'imported', completionTarget: undefined },
          ])
      ).rejects.toThrow('fail')
    })
    expect(useLearningPathStore.getState().error).toBe('Failed to add courses to learning path')
  })
})

describe('getEntriesForPath', () => {
  it('should return sorted entries for a path', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Path')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c2', 'imported')
    })

    const entries = useLearningPathStore.getState().getEntriesForPath(pathId)
    expect(entries).toHaveLength(2)
    expect(entries[0].position).toBeLessThan(entries[1].position)
  })

  it('should return empty array for unknown pathId', () => {
    const entries = useLearningPathStore.getState().getEntriesForPath('nonexistent')
    expect(entries).toEqual([])
  })

  it('should sort by manifestOrdinal when path.orderMode is manifest (F-045)', async () => {
    // Simulate a pre-refactor track: entries have correct manifestOrdinals
    // but their position values are in the old import order.
    const pathId = 'p-f045'
    const path: LearningPath = {
      id: pathId,
      name: 'Manifest Track',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAIGenerated: false,
      progressionMode: 'free',
      orderMode: 'manifest',
    }
    const entries: LearningPathEntry[] = [
      {
        id: 'e-f045-1',
        pathId,
        courseId: 'c-p8-01', // P8-01 — manifest position 17
        courseType: 'imported',
        position: 1, // Wrong: rendered first because position=1
        manifestOrdinal: 17,
        source: 'manifest',
        state: 'active',
        manifestCourseKey: 'P8-01 - The Cutting Edge',
      },
      {
        id: 'e-f045-2',
        pathId,
        courseId: 'c-p1-02', // P1-02 — manifest position 2
        courseType: 'imported',
        position: 2, // Wrong: rendered second
        manifestOrdinal: 2,
        source: 'manifest',
        state: 'active',
        manifestCourseKey: 'P1-02 - DaVinci Resolve',
      },
      {
        id: 'e-f045-3',
        pathId,
        courseId: 'c-p3-01', // P3-01 — manifest position 4
        courseType: 'imported',
        position: 3, // Wrong: rendered third
        manifestOrdinal: 4,
        source: 'manifest',
        state: 'active',
        manifestCourseKey: 'P3-01 - Mastery Bootcamp',
      },
    ]

    await db.learningPaths.put(path)
    await db.learningPathEntries.bulkPut(entries)

    // Load from DB — migration will skip (orderMode is already set)
    await act(async () => {
      await useLearningPathStore.getState().loadPaths()
    })

    const sorted = useLearningPathStore.getState().getEntriesForPath(pathId)
    expect(sorted).toHaveLength(3)

    // Must be sorted by manifestOrdinal, NOT by position:
    // P1-02 (ordinal 2) first, P3-01 (ordinal 4) second, P8-01 (ordinal 17) third
    expect(sorted[0].manifestOrdinal).toBe(2)
    expect(sorted[0].courseId).toBe('c-p1-02')
    expect(sorted[1].manifestOrdinal).toBe(4)
    expect(sorted[1].courseId).toBe('c-p3-01')
    expect(sorted[2].manifestOrdinal).toBe(17)
    expect(sorted[2].courseId).toBe('c-p8-01')
  })

  it('should sort by position when path.orderMode is custom', async () => {
    const pathId = 'p-f045-custom'
    const path: LearningPath = {
      id: pathId,
      name: 'Custom Track',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAIGenerated: false,
      progressionMode: 'free',
      orderMode: 'custom',
    }
    const entries: LearningPathEntry[] = [
      {
        id: 'e-f045-c1',
        pathId,
        courseId: 'c-p8-01',
        courseType: 'imported',
        position: 1,
        manifestOrdinal: 17,
        source: 'manifest',
        state: 'active',
        manifestCourseKey: 'P8-01',
      },
      {
        id: 'e-f045-c2',
        pathId,
        courseId: 'c-p1-02',
        courseType: 'imported',
        position: 2,
        manifestOrdinal: 2,
        source: 'manifest',
        state: 'active',
        manifestCourseKey: 'P1-02',
      },
    ]

    await db.learningPaths.put(path)
    await db.learningPathEntries.bulkPut(entries)

    await act(async () => {
      await useLearningPathStore.getState().loadPaths()
    })

    // Custom mode: must sort by position, ignoring manifestOrdinal
    const sorted = useLearningPathStore.getState().getEntriesForPath(pathId)
    expect(sorted).toHaveLength(2)
    expect(sorted[0].position).toBe(1)
    expect(sorted[1].position).toBe(2)
  })
})

describe('deletePathWithUndo / restorePath', () => {
  it('should remove path from state and queue in pendingDeletes', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('To Undo', 'desc')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      useLearningPathStore.getState().deletePathWithUndo(pathId)
    })

    const state = useLearningPathStore.getState()
    // Path removed from state
    expect(state.paths).toHaveLength(0)
    // Stored in pendingDeletes
    expect(state.pendingDeletes[pathId]).toBeDefined()
    expect(state.pendingDeletes[pathId].path.name).toBe('To Undo')
    expect(state.pendingDeletes[pathId].path.description).toBe('desc')
  })

  it('should restore path on restorePath and clear pendingDeletes', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('To Restore')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      useLearningPathStore.getState().deletePathWithUndo(pathId)
    })

    await act(async () => {
      useLearningPathStore.getState().restorePath(pathId)
    })

    // restorePath clears pendingDeletes asynchronously via persistWithRetry().then().
    // persistWithRetry is mocked to run immediately, so a microtask flush is sufficient.
    await vi.waitFor(() => {
      const state = useLearningPathStore.getState()
      expect(state.pendingDeletes[pathId]).toBeUndefined()
    })

    const state = useLearningPathStore.getState()
    // Path restored
    expect(state.paths).toHaveLength(1)
    expect(state.paths[0].name).toBe('To Restore')
  })

  it('should capture and restore entries alongside path', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('With Entries')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c1', 'imported')
      await useLearningPathStore.getState().addCourseToPath(pathId, 'c2', 'imported')
    })

    await act(async () => {
      useLearningPathStore.getState().deletePathWithUndo(pathId)
    })

    // Entries also removed
    expect(useLearningPathStore.getState().entries).toHaveLength(0)

    await act(async () => {
      useLearningPathStore.getState().restorePath(pathId)
    })

    // Both path and entries restored
    expect(useLearningPathStore.getState().paths).toHaveLength(1)
    expect(useLearningPathStore.getState().entries).toHaveLength(2)
  })

  it('should be a no-op for non-existent path', async () => {
    await act(async () => {
      useLearningPathStore.getState().deletePathWithUndo('nonexistent')
    })

    const state = useLearningPathStore.getState()
    expect(state.paths).toHaveLength(0)
    expect(state.pendingDeletes['nonexistent']).toBeUndefined()
  })

  it('should be a no-op when calling deletePathWithUndo twice before timer expires', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Double Delete')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      useLearningPathStore.getState().deletePathWithUndo(pathId)
    })

    // Second call should be no-op
    await act(async () => {
      useLearningPathStore.getState().deletePathWithUndo(pathId)
    })

    const state = useLearningPathStore.getState()
    expect(state.paths).toHaveLength(0)
    expect(state.pendingDeletes[pathId]).toBeDefined()
  })

  it('should be a no-op when restorePath called after finalize', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Expired Undo')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      useLearningPathStore.getState().deletePathWithUndo(pathId)
    })

    // Simulate timer expiry by calling finalize directly
    await act(async () => {
      await useLearningPathStore.getState()._finalizeDelete(pathId)
    })

    // restorePath should be no-op — pendingDeletes already cleared
    await act(async () => {
      useLearningPathStore.getState().restorePath(pathId)
    })

    // Path still deleted
    const state = useLearningPathStore.getState()
    expect(state.paths).toHaveLength(0)
    expect(state.pendingDeletes[pathId]).toBeUndefined()
  })

  it('should finalize delete via _finalizeDelete and persist to Dexie', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Timer Finalize', 'desc')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    // Add entries to the path
    await db.learningPathEntries.add({
      id: 'e-timer',
      pathId,
      courseId: 'course-1',
      courseType: 'imported',
      position: 1,
      isManuallyOrdered: false,
    })
    useLearningPathStore.setState(state => ({
      entries: [
        ...state.entries,
        {
          id: 'e-timer',
          pathId,
          courseId: 'course-1',
          courseType: 'imported' as const,
          position: 1,
          isManuallyOrdered: false,
        },
      ],
    }))

    await act(async () => {
      useLearningPathStore.getState().deletePathWithUndo(pathId)
    })

    // Path still in pendingDeletes before finalize
    expect(useLearningPathStore.getState().pendingDeletes[pathId]).toBeDefined()

    // Call finalize directly (simulates timer expiry)
    await act(async () => {
      await useLearningPathStore.getState()._finalizeDelete(pathId)
    })

    const state = useLearningPathStore.getState()
    expect(state.paths).toHaveLength(0)
    expect(state.pendingDeletes[pathId]).toBeUndefined()

    // Verify Dexie deletion
    const stored = await db.learningPaths.get(pathId)
    expect(stored).toBeUndefined()
  })

  it('should keep pendingDeletes entry if finalizeDelete Dexie write fails', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Finalize Fail')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await act(async () => {
      useLearningPathStore.getState().deletePathWithUndo(pathId)
    })

    // Mock syncableWrite to fail on finalize
    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('DB fail'))

    await act(async () => {
      await useLearningPathStore.getState()._finalizeDelete(pathId)
    })

    // Path still gone from state (optimistic delete)
    expect(useLearningPathStore.getState().paths).toHaveLength(0)
    // pendingDeletes entry kept to prevent re-finalization attempts
    expect(useLearningPathStore.getState().pendingDeletes[pathId]).toBeDefined()
  })

  it('should not interfere with existing deletePath used by internal callers', async () => {
    await act(async () => {
      await useLearningPathStore.getState().createPath('Direct Delete')
    })
    const pathId = useLearningPathStore.getState().paths[0].id

    await db.learningPathEntries.add({
      id: 'e-direct',
      pathId,
      courseId: 'c1',
      courseType: 'imported',
      position: 1,
      isManuallyOrdered: false,
    })
    useLearningPathStore.setState(state => ({
      entries: [
        ...state.entries,
        {
          id: 'e-direct',
          pathId,
          courseId: 'c1',
          courseType: 'imported' as const,
          position: 1,
          isManuallyOrdered: false,
        },
      ],
    }))

    await act(async () => {
      await useLearningPathStore.getState().deletePath(pathId)
    })

    expect(useLearningPathStore.getState().paths).toHaveLength(0)
    expect(useLearningPathStore.getState().entries).toHaveLength(0)
    // No undo toast was shown (no pendingDeletes entry)
    // (Sonner toast mock can't easily distinguish, but the store state proves it)
  })
})

describe('buildMigrationPatches', () => {
  it('should use normalized course name for manifestCourseKey when folder is unavailable', async () => {
    // Import the function
    const { buildMigrationPatches } = await import('@/stores/useLearningPathStore')

    // Create a course in Dexie
    await db.importedCourses.add({
      id: 'c1',
      name: ' React Fundamentals ', // has leading/trailing spaces
      importedAt: '2026-01-01T00:00:00Z',
      category: 'behavioral-analysis',
      tags: [],
      status: 'not-started',
      videoCount: 0,
      pdfCount: 0,
      directoryHandle: null,
    })

    const pathNoOrderMode: LearningPath = {
      id: 'p1',
      name: 'Test Path',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      isAIGenerated: false,
    }

    // Old-style entry: missing source, state, and manifestCourseKey
    // Simulates a pre-migration entry that needs backfill from the course name.
    const entry: LearningPathEntry = {
      id: 'e1',
      pathId: 'p1',
      courseId: 'c1',
      courseType: 'imported',
      position: 1,
      isManuallyOrdered: false,
      manifestOrdinal: 1,
      source: undefined, // triggers migration backfill
      state: undefined,  // triggers migration backfill
      manifestCourseKey: null, // needs backfill from name
    }

    const result = await buildMigrationPatches([pathNoOrderMode], [entry], [pathNoOrderMode])
    expect(result).not.toBeNull()

    const manifestCourseKeyPatch = result!.allEntryPatches.find(ep => ep.id === 'e1')?.patch.manifestCourseKey
    expect(manifestCourseKeyPatch).toBe('React Fundamentals') // trimmed + NFC-normalized
    // The leading/trailing spaces were trimmed
    expect(manifestCourseKeyPatch).not.toMatch(/^\s|\s$/)
  })

  it('should preserve existing manifestCourseKey rather than overwrite', async () => {
    const { buildMigrationPatches } = await import('@/stores/useLearningPathStore')

    await db.importedCourses.add({
      id: 'c2',
      name: 'Advanced Topics',
      importedAt: '2026-01-01T00:00:00Z',
      category: 'behavioral-analysis',
      tags: [],
      status: 'not-started',
      videoCount: 0,
      pdfCount: 0,
      directoryHandle: null,
    })

    const pathNoOrderMode: LearningPath = {
      id: 'p2',
      name: 'Test Path 2',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      isAIGenerated: false,
    }

    const entry: LearningPathEntry = {
      id: 'e2',
      pathId: 'p2',
      courseId: 'c2',
      courseType: 'imported',
      position: 1,
      isManuallyOrdered: false,
      manifestOrdinal: 1,
      source: 'manifest',
      state: 'active',
      manifestCourseKey: '02-advanced-topics', // already set — should be preserved
    }

    const result = await buildMigrationPatches([pathNoOrderMode], [entry], [pathNoOrderMode])
    // Entry already has all provenance fields set — no entry patch generated.
    // The existing manifestCourseKey is preserved (not overwritten by name).
    expect(result).not.toBeNull()
    const entryPatch = result!.allEntryPatches.find(ep => ep.id === 'e2')
    expect(entryPatch).toBeUndefined() // no patch needed for this entry
    // The path patch is generated (orderMode computed), but entry is untouched.
    expect(result!.allPathPatches.length).toBeGreaterThanOrEqual(1)
  })
})

describe('applyManifestOrder', () => {
  it('should match by manifestCourseKey before falling back to courseId', async () => {
    // Set up the store state with entries that have manifestCourseKey set
    const path = await act(async () => {
      return useLearningPathStore.getState().createPath('Manifest Key Test')
    })
    const pathId = path.id

    // Add entries directly to store state with manifestCourseKey set
    useLearningPathStore.setState(() => ({ entries: [
        {
          id: 'e-keymatch',
          pathId,
          courseId: 'c-nomatch', // courseId deliberately different — tests key matching
          courseType: 'imported' as const,
          position: 1,
          isManuallyOrdered: false,
          manifestOrdinal: 1,
          source: 'manifest',
          state: 'active',
          manifestCourseKey: '01-react-fundamentals',
        },
        {
          id: 'e-idfallback',
          pathId,
          courseId: 'c-linear-algebra',
          courseType: 'imported' as const,
          position: 2,
          isManuallyOrdered: false,
          manifestOrdinal: 2,
          source: 'manifest',
          state: 'active',
          manifestCourseKey: null, // no key — will fall back to courseId
        },
      ],
    }))

    await act(async () => {
      await useLearningPathStore.getState().applyManifestOrder(pathId, [
        { folder: '01-react-fundamentals', courseId: 'c-nomatch', position: 1 },
        { folder: '02-linear-algebra', courseId: 'c-linear-algebra', position: 2 },
      ])
    })

    const entries = useLearningPathStore.getState().entries
    const keyMatchEntry = entries.find(e => e.id === 'e-keymatch')
    const idFallbackEntry = entries.find(e => e.id === 'e-idfallback')

    // key-match entry: should be found by manifestCourseKey despite courseId not matching folder
    expect(keyMatchEntry).toBeDefined()
    expect(keyMatchEntry!.manifestOrdinal).toBe(1)
    expect(keyMatchEntry!.manifestCourseKey).toBe('01-react-fundamentals')

    // id-fallback entry: should still be found by courseId
    expect(idFallbackEntry).toBeDefined()
    expect(idFallbackEntry!.manifestOrdinal).toBe(2)
    expect(idFallbackEntry!.manifestCourseKey).toBe('02-linear-algebra')
  })
})

describe('loadPaths migration error path', () => {
  it('should preserve isLoaded:false and error when migration persist fails', async () => {
    // Create paths and entries that trigger the migration (no orderMode)
    const path1 = {
      id: 'p-migrate',
      name: 'Migration Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      isAIGenerated: false,
    }
    await db.learningPaths.add(path1)

    // Add a course that the migration can look up
    await db.importedCourses.add({
      id: 'c-migrate',
      name: 'Course 1',
      importedAt: '2026-01-01T00:00:00Z',
      category: 'behavioral-analysis',
      tags: [],
      status: 'not-started',
      videoCount: 0,
      pdfCount: 0,
      directoryHandle: null,
      manifestPosition: 1,
    })

    await db.learningPathEntries.add({
      id: 'e-migrate',
      pathId: 'p-migrate',
      courseId: 'c-migrate',
      courseType: 'imported',
      position: 1,
      isManuallyOrdered: false,
    })

    // Mock syncableWrite to fail during migration persistence
    vi.spyOn(syncableWriteModule, 'syncableWrite').mockRejectedValue(new Error('Migration persist fail'))

    await act(async () => {
      await useLearningPathStore.getState().loadPaths()
    })

    const state = useLearningPathStore.getState()
    // F-003: isLoaded is true even on migration failure — avoids infinite spinner.
    // Consumers check migrationFailed to show an error banner instead.
    expect(state.isLoaded).toBe(true)
    expect(state.migrationFailed).toBe(true)
    expect(state.error).toBe('Failed to migrate track ordering — rolled back')
  })
})
