import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'

// Mock toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
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

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const storeMod = await import('@/stores/useLearningPathStore')
  useLearningPathStore = storeMod.useLearningPathStore
  const dbMod = await import('@/db/schema')
  db = dbMod.db
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
    vi.spyOn(db.learningPaths, 'add').mockRejectedValue(new Error('Write fail'))

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

    vi.spyOn(db.learningPaths, 'update').mockRejectedValue(new Error('fail'))

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

    vi.spyOn(db.learningPaths, 'update').mockRejectedValue(new Error('fail'))

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

    vi.spyOn(db.learningPathEntries, 'add').mockRejectedValue(new Error('fail'))

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

    vi.spyOn(db.learningPathEntries, 'delete').mockRejectedValue(new Error('fail'))

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
    expect(entries[0].courseId).toBe('c3')
    expect(entries[0].isManuallyOrdered).toBe(true)
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

    // Create a mock WhereClause to make the chained call work
    const mockWhere = {
      equals: vi.fn().mockReturnValue({
        delete: vi.fn().mockRejectedValue(new Error('fail')),
      }),
    }
    vi.spyOn(db.learningPathEntries, 'where').mockReturnValue(mockWhere as never)

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

    vi.spyOn(db.learningPathEntries, 'update').mockRejectedValue(new Error('fail'))

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

    vi.spyOn(db.learningPathEntries, 'update').mockRejectedValue(new Error('fail'))

    await act(async () => {
      await useLearningPathStore
        .getState()
        .applyAIOrder(pathId, [{ courseId: 'c1', position: 1, justification: 'test' }])
    })

    expect(useLearningPathStore.getState().error).toBe('Failed to save AI-suggested order')
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
})
