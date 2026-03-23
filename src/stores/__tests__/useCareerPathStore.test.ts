import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'

// Mock persistWithRetry to run once (no retries in tests)
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

// Mock sonner toast
vi.mock('sonner', () => {
  const toastFn = vi.fn() as ReturnType<typeof vi.fn> & {
    error: ReturnType<typeof vi.fn>
    success: ReturnType<typeof vi.fn>
  }
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  return { toast: toastFn }
})

// Import store AFTER mocks
const { useCareerPathStore } = await import('@/stores/useCareerPathStore')

function resetStore() {
  useCareerPathStore.setState({
    paths: [],
    enrollments: [],
    courseCompletionCache: {},
    isLoaded: false,
    error: null,
  })
}

beforeEach(async () => {
  vi.restoreAllMocks()
  resetStore()
  const { db } = await import('@/db')
  await Promise.all([
    db.careerPaths.clear(),
    db.pathEnrollments.clear(),
    db.contentProgress.clear(),
  ])
})

// ─────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────

describe('initial state', () => {
  it('has empty initial state', () => {
    const s = useCareerPathStore.getState()
    expect(s.paths).toEqual([])
    expect(s.enrollments).toEqual([])
    expect(s.isLoaded).toBe(false)
    expect(s.error).toBeNull()
  })
})

// ─────────────────────────────────────────────
// loadPaths — seeding
// ─────────────────────────────────────────────

describe('loadPaths', () => {
  it('seeds CURATED_CAREER_PATHS into DB when table is empty', async () => {
    await act(async () => {
      await useCareerPathStore.getState().loadPaths()
    })

    const { db } = await import('@/db')
    const count = await db.careerPaths.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  it('does not duplicate paths on second load', async () => {
    await act(async () => {
      await useCareerPathStore.getState().loadPaths()
      resetStore()
      await useCareerPathStore.getState().loadPaths()
    })

    const { db } = await import('@/db')
    const count = await db.careerPaths.count()
    const { CURATED_CAREER_PATHS } = await import('@/data/careerPaths')
    expect(count).toBe(CURATED_CAREER_PATHS.length)
  })

  it('sets isLoaded to true after loading', async () => {
    await act(async () => {
      await useCareerPathStore.getState().loadPaths()
    })
    expect(useCareerPathStore.getState().isLoaded).toBe(true)
  })
})

// ─────────────────────────────────────────────
// Enrollment
// ─────────────────────────────────────────────

describe('enrollInPath', () => {
  beforeEach(async () => {
    await act(async () => {
      await useCareerPathStore.getState().loadPaths()
    })
  })

  it('creates a PathEnrollment record in Dexie', async () => {
    const pathId = useCareerPathStore.getState().paths[0]?.id
    expect(pathId).toBeDefined()

    await act(async () => {
      await useCareerPathStore.getState().enrollInPath(pathId)
    })

    const { db } = await import('@/db')
    const enrollment = await db.pathEnrollments.where('pathId').equals(pathId).first()
    expect(enrollment).toBeDefined()
    expect(enrollment?.status).toBe('active')
  })

  it('adds enrollment to store state after DB write', async () => {
    const pathId = useCareerPathStore.getState().paths[0]?.id
    await act(async () => {
      await useCareerPathStore.getState().enrollInPath(pathId)
    })

    const enrollments = useCareerPathStore.getState().enrollments
    expect(enrollments.some(e => e.pathId === pathId && e.status === 'active')).toBe(true)
  })

  it('does not create duplicate enrollment when called twice', async () => {
    const pathId = useCareerPathStore.getState().paths[0]?.id
    await act(async () => {
      await useCareerPathStore.getState().enrollInPath(pathId)
      await useCareerPathStore.getState().enrollInPath(pathId)
    })

    const { db } = await import('@/db')
    const count = await db.pathEnrollments.where('pathId').equals(pathId).count()
    expect(count).toBe(1)
  })

  it('getEnrollmentForPath returns enrollment after enrolling', async () => {
    const pathId = useCareerPathStore.getState().paths[0]?.id
    await act(async () => {
      await useCareerPathStore.getState().enrollInPath(pathId)
    })

    const enrollment = useCareerPathStore.getState().getEnrollmentForPath(pathId)
    expect(enrollment).toBeDefined()
    expect(enrollment?.pathId).toBe(pathId)
  })
})

// ─────────────────────────────────────────────
// dropPath
// ─────────────────────────────────────────────

describe('dropPath', () => {
  beforeEach(async () => {
    await act(async () => {
      await useCareerPathStore.getState().loadPaths()
    })
  })

  it('sets enrollment status to dropped', async () => {
    const pathId = useCareerPathStore.getState().paths[0]?.id
    await act(async () => {
      await useCareerPathStore.getState().enrollInPath(pathId)
      await useCareerPathStore.getState().dropPath(pathId)
    })

    const { db } = await import('@/db')
    const enrollment = await db.pathEnrollments.where('pathId').equals(pathId).first()
    expect(enrollment?.status).toBe('dropped')
  })

  it('getEnrollmentForPath returns undefined after dropping', async () => {
    const pathId = useCareerPathStore.getState().paths[0]?.id
    await act(async () => {
      await useCareerPathStore.getState().enrollInPath(pathId)
      await useCareerPathStore.getState().dropPath(pathId)
    })

    const enrollment = useCareerPathStore.getState().getEnrollmentForPath(pathId)
    expect(enrollment).toBeUndefined()
  })

  it('re-enroll after drop reactivates enrollment', async () => {
    const pathId = useCareerPathStore.getState().paths[0]?.id
    await act(async () => {
      await useCareerPathStore.getState().enrollInPath(pathId)
      await useCareerPathStore.getState().dropPath(pathId)
      await useCareerPathStore.getState().enrollInPath(pathId)
    })

    const enrollment = useCareerPathStore.getState().getEnrollmentForPath(pathId)
    expect(enrollment?.status).toBe('active')

    const { db } = await import('@/db')
    const count = await db.pathEnrollments.where('pathId').equals(pathId).count()
    expect(count).toBe(1) // no duplicate records
  })
})

// ─────────────────────────────────────────────
// Progress computation
// ─────────────────────────────────────────────

describe('getPathProgress', () => {
  it('returns 0% when no courses are completed', async () => {
    await act(async () => {
      await useCareerPathStore.getState().loadPaths()
    })

    const pathId = useCareerPathStore.getState().paths[0]?.id
    const progress = useCareerPathStore.getState().getPathProgress(pathId)
    expect(progress.percentage).toBe(0)
    expect(progress.completedCourses).toBe(0)
    expect(progress.totalCourses).toBeGreaterThan(0)
  })

  it('returns correct percentage when courses are marked complete', async () => {
    await act(async () => {
      await useCareerPathStore.getState().loadPaths()
    })

    const path = useCareerPathStore.getState().paths[0]
    const firstCourseId = path?.stages[0]?.courseIds[0]
    const totalCourses = path?.stages.flatMap(s => s.courseIds).length ?? 0

    // Manually mark first course complete in the cache
    useCareerPathStore.setState({
      courseCompletionCache: { [firstCourseId]: true },
    })

    const progress = useCareerPathStore.getState().getPathProgress(path.id)
    expect(progress.completedCourses).toBe(1)
    expect(progress.totalCourses).toBe(totalCourses)
    expect(progress.percentage).toBe(Math.round((1 / totalCourses) * 100))
  })
})

// ─────────────────────────────────────────────
// Stage locking
// ─────────────────────────────────────────────

describe('isStageUnlocked', () => {
  beforeEach(async () => {
    await act(async () => {
      await useCareerPathStore.getState().loadPaths()
    })
  })

  it('Stage 1 (index 0) is always unlocked', () => {
    const pathId = useCareerPathStore.getState().paths[0]?.id
    expect(useCareerPathStore.getState().isStageUnlocked(pathId, 0)).toBe(true)
  })

  it('Stage 2 is locked when Stage 1 is incomplete', () => {
    const pathId = useCareerPathStore.getState().paths[0]?.id
    expect(useCareerPathStore.getState().isStageUnlocked(pathId, 1)).toBe(false)
  })

  it('Stage 2 unlocks when all Stage 1 courses are complete', () => {
    const path = useCareerPathStore.getState().paths[0]
    const stage1CourseIds = path?.stages[0]?.courseIds ?? []

    // Mark all Stage 1 courses complete
    const cache: Record<string, boolean> = {}
    stage1CourseIds.forEach(id => (cache[id] = true))
    useCareerPathStore.setState({ courseCompletionCache: cache })

    expect(useCareerPathStore.getState().isStageUnlocked(path.id, 1)).toBe(true)
  })

  it('Stage 2 stays locked if only some Stage 1 courses are complete', () => {
    const path = useCareerPathStore.getState().paths[0]
    const stage1CourseIds = path?.stages[0]?.courseIds ?? []

    if (stage1CourseIds.length < 2) return // skip if only 1 course

    // Mark only the first course complete
    useCareerPathStore.setState({
      courseCompletionCache: { [stage1CourseIds[0]]: true },
    })

    expect(useCareerPathStore.getState().isStageUnlocked(path.id, 1)).toBe(false)
  })
})

// ─────────────────────────────────────────────
// getStageProgress
// ─────────────────────────────────────────────

describe('getStageProgress', () => {
  it('returns correct stage progress', async () => {
    await act(async () => {
      await useCareerPathStore.getState().loadPaths()
    })

    const path = useCareerPathStore.getState().paths[0]
    const stage = path?.stages[0]
    const firstCourse = stage?.courseIds[0]
    const totalInStage = stage?.courseIds.length ?? 0

    useCareerPathStore.setState({ courseCompletionCache: { [firstCourse]: true } })

    const stageProgress = useCareerPathStore.getState().getStageProgress(path.id, stage.id)
    expect(stageProgress.completedCourses).toBe(1)
    expect(stageProgress.totalCourses).toBe(totalInStage)
    expect(stageProgress.percentage).toBe(Math.round((1 / totalInStage) * 100))
  })

  it('returns zeros for unknown path/stage', () => {
    const progress = useCareerPathStore.getState().getStageProgress('unknown', 'unknown')
    expect(progress.totalCourses).toBe(0)
    expect(progress.completedCourses).toBe(0)
    expect(progress.percentage).toBe(0)
  })
})
