import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useNextBestCourse } from '@/app/hooks/useNextBestCourse'
import type { LearningPathEntry, ImportedCourse, CompletionStatus } from '@/data/types'
import type { PathProgressSummary, CourseProgressInfo } from '@/app/hooks/usePathProgress'

// Hoisted constant for mock — vi.mock is hoisted above imports, so constants
// used inside mock factories must also be hoisted.
const { PROGRESS_UPDATED_EVENT } = vi.hoisted(() => ({
  PROGRESS_UPDATED_EVENT: 'course-progress-updated',
}))

// --- Mocks ---

const mockImportedCourses: ImportedCourse[] = [
  {
    id: 'course-1',
    name: 'Course One',
    videoCount: 5,
    pdfCount: 0,
    status: 'active',
    importedAt: '2024-01-01',
    category: 'tech',
    tags: ['tag1'],
    directoryHandle: null,
  },
  {
    id: 'course-2',
    name: 'Course Two',
    videoCount: 3,
    pdfCount: 0,
    status: 'active',
    importedAt: '2024-01-02',
    category: 'tech',
    tags: ['tag2'],
    directoryHandle: null,
  },
  {
    id: 'course-3',
    name: 'Course Three',
    videoCount: 0,
    pdfCount: 0,
    status: 'active',
    importedAt: '2024-01-03',
    category: 'tech',
    tags: ['tag3'],
    directoryHandle: null,
  },
]

const mockEntries: LearningPathEntry[] = [
  {
    id: 'entry-1',
    pathId: 'path-1',
    courseId: 'course-1',
    courseType: 'imported',
    position: 1,
    isManuallyOrdered: false,
  },
  {
    id: 'entry-2',
    pathId: 'path-1',
    courseId: 'course-2',
    courseType: 'imported',
    position: 2,
    isManuallyOrdered: false,
  },
  {
    id: 'entry-3',
    pathId: 'path-1',
    courseId: 'course-3',
    courseType: 'catalog',
    position: 3,
    isManuallyOrdered: false,
  },
]

const mockStatusMap: Record<string, CompletionStatus> = {
  'course-1:lesson-1': 'completed',
  'course-1:lesson-2': 'in-progress',
  'course-1:lesson-3': 'not-started',
  'course-1:lesson-4': 'not-started',
  'course-1:lesson-5': 'not-started',
}

// --- Store mocks ---

const mockEntriesStore = [...mockEntries]
let mockStatusMapStore = { ...mockStatusMap }

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const store = {
      entries: mockEntriesStore,
      getEntriesForPath: (pathId: string) =>
        mockEntriesStore.filter(e => e.pathId === pathId).sort((a, b) => a.position - b.position),
    }
    return selector(store as unknown as Record<string, unknown>)
  },
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const store = { importedCourses: mockImportedCourses }
    return selector(store as unknown as Record<string, unknown>)
  },
}))

vi.mock('@/stores/useContentProgressStore', () => ({
  useContentProgressStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const store = { statusMap: mockStatusMapStore }
    return selector(store as unknown as Record<string, unknown>)
  },
}))

// Mock useMultiPathProgress
const mockCourseProgressMap = new Map<string, import('@/app/hooks/usePathProgress').CourseProgressInfo>()
mockCourseProgressMap.set('course-1', { courseId: 'course-1', completionPct: 40, completedLessons: 2, totalLessons: 5 } as CourseProgressInfo)
mockCourseProgressMap.set('course-2', { courseId: 'course-2', completionPct: 0, completedLessons: 0, totalLessons: 3 } as CourseProgressInfo)
mockCourseProgressMap.set('course-3', { courseId: 'course-3', completionPct: 0, completedLessons: 0, totalLessons: 0 } as CourseProgressInfo)

const mockPathProgressSummary: PathProgressSummary = {
  completionPct: 20,
  completedLessons: 2,
  totalLessons: 8,
  completedCourses: 0,
  totalCourses: 3,
  estimatedRemainingHours: 1.5,
  courseProgress: mockCourseProgressMap,
}

let mockProgressMap = new Map<string, PathProgressSummary>()
mockProgressMap.set('path-1', mockPathProgressSummary)

vi.mock('@/app/hooks/usePathProgress', () => ({
  useMultiPathProgress: () => mockProgressMap,
}))

// Mock Dexie
vi.mock('@/db', () => ({
  db: {
    importedVideos: {
      where: () => ({
        equals: () => ({
          sortBy: async () => [
            { id: 'lesson-1', order: 1 },
            { id: 'lesson-2', order: 2 },
            { id: 'lesson-3', order: 3 },
            { id: 'lesson-4', order: 4 },
            { id: 'lesson-5', order: 5 },
          ],
          toArray: async () => [
            { id: 'lesson-1', order: 1 },
            { id: 'lesson-2', order: 2 },
            { id: 'lesson-3', order: 3 },
            { id: 'lesson-4', order: 4 },
            { id: 'lesson-5', order: 5 },
          ],
        }),
      }),
    },
    importedPdfs: {
      where: () => ({
        equals: () => ({
          sortBy: async () => [],
        }),
      }),
    },
  },
}))

vi.mock('@/lib/progress', () => ({
  PROGRESS_UPDATED_EVENT: 'course-progress-updated',
  getAllProgress: () => ({}),
}))

// --- Test hook wrapper ---
function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }
}

describe('useNextBestCourse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProgressMap = new Map<string, PathProgressSummary>()
    mockProgressMap.set('path-1', mockPathProgressSummary)
    mockStatusMapStore = { ...mockStatusMap }
  })

  it('returns the first in-progress entry (completionPct=40) with resume action', async () => {
    const { result } = renderHook(() => useNextBestCourse('path-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.action).toBe('resume')
    })

    expect(result.current.entry?.courseId).toBe('course-1')
    expect(result.current.course?.name).toBe('Course One')
    expect(result.current.targetLessonId).toBe('lesson-2') // first incomplete
  })

  it('returns the first unstarted entry when no courses are in progress', async () => {
    // Set all course-1 progress to 100% (completed), course-2 still 0%
    const completedProgressMap = new Map<string, CourseProgressInfo>()
    completedProgressMap.set('course-1', { courseId: 'course-1', completionPct: 100, completedLessons: 5, totalLessons: 5 } as CourseProgressInfo)
    completedProgressMap.set('course-2', { courseId: 'course-2', completionPct: 0, completedLessons: 0, totalLessons: 3 } as CourseProgressInfo)
    completedProgressMap.set('course-3', { courseId: 'course-3', completionPct: 0, completedLessons: 0, totalLessons: 0 } as CourseProgressInfo)

    const completedSummary: PathProgressSummary = {
      ...mockPathProgressSummary,
      courseProgress: completedProgressMap,
    }
    const completedMap = new Map<string, PathProgressSummary>()
    completedMap.set('path-1', completedSummary)
    mockProgressMap = completedMap

    const { result } = renderHook(() => useNextBestCourse('path-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.action).toBe('start')
    })

    expect(result.current.entry?.courseId).toBe('course-2')
    expect(result.current.course?.name).toBe('Course Two')
    // First lesson of course-2
    expect(result.current.targetLessonId).toBe('lesson-1')
  })

  it('returns complete action when all courses are at 100%', async () => {
    const allCompleteProgress = new Map<string, CourseProgressInfo>()
    allCompleteProgress.set('course-1', { courseId: 'course-1', completionPct: 100, completedLessons: 5, totalLessons: 5 } as CourseProgressInfo)
    allCompleteProgress.set('course-2', { courseId: 'course-2', completionPct: 100, completedLessons: 3, totalLessons: 3 } as CourseProgressInfo)
    allCompleteProgress.set('course-3', { courseId: 'course-3', completionPct: 100, completedLessons: 0, totalLessons: 0 } as CourseProgressInfo)

    const completeSummary: PathProgressSummary = {
      ...mockPathProgressSummary,
      courseProgress: allCompleteProgress,
    }
    const completeMap = new Map<string, PathProgressSummary>()
    completeMap.set('path-1', completeSummary)
    mockProgressMap = completeMap

    const { result } = renderHook(() => useNextBestCourse('path-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.action).toBe('complete')
    })

    expect(result.current.entry).toBeNull()
    expect(result.current.course).toBeNull()
    expect(result.current.targetLessonId).toBeNull()
  })

  it('returns null action when entries array is empty', async () => {
    const emptyProgressMap = new Map<string, PathProgressSummary>()
    emptyProgressMap.set('path-1', {
      ...mockPathProgressSummary,
      courseProgress: new Map(),
      totalCourses: 0,
    })
    mockProgressMap = emptyProgressMap

    // Also ensure no entries are returned for this path
    // We need to set entries to empty for a different path
    const { result } = renderHook(() => useNextBestCourse('path-empty'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.action).toBeNull()
    })
    expect(result.current.entry).toBeNull()
    expect(result.current.targetLessonId).toBeNull()
  })

  it('handles single course path — returns resume for in-progress', async () => {
    const singleProgressMap = new Map<string, CourseProgressInfo>()
    singleProgressMap.set('course-1', { courseId: 'course-1', completionPct: 50, completedLessons: 2, totalLessons: 5 } as CourseProgressInfo)

    const singleSummary: PathProgressSummary = {
      ...mockPathProgressSummary,
      totalCourses: 1,
      courseProgress: singleProgressMap,
    }
    const singleMap = new Map<string, PathProgressSummary>()
    singleMap.set('path-1', singleSummary)
    mockProgressMap = singleMap

    const { result } = renderHook(() => useNextBestCourse('path-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.action).toBe('resume')
    })
    expect(result.current.entry?.courseId).toBe('course-1')
  })

  it('handles single course path — returns complete for finished', async () => {
    const finishedProgress = new Map<string, CourseProgressInfo>()
    finishedProgress.set('course-1', { courseId: 'course-1', completionPct: 100, completedLessons: 5, totalLessons: 5 } as CourseProgressInfo)

    const finishedSummary: PathProgressSummary = {
      ...mockPathProgressSummary,
      totalCourses: 1,
      courseProgress: finishedProgress,
    }
    const finishedMap = new Map<string, PathProgressSummary>()
    finishedMap.set('path-1', finishedSummary)
    mockProgressMap = finishedMap

    const { result } = renderHook(() => useNextBestCourse('path-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.action).toBe('complete')
    })
  })

  it('returns null action when pathId has no entries (graceful degradation for missing/mismatched data)', async () => {
    // Uses a pathId ('path-nonexistent') with no matching entries in the store.
    // The hook should return INITIAL_RESULT as graceful degradation — even
    // though the progress map has entries, no entries mean no actionable courses.

    const emptyProgressMap = new Map<string, PathProgressSummary>()
    emptyProgressMap.set('path-nonexistent', {
      ...mockPathProgressSummary,
      // courseProgress only has 'missing-course' but no entries will match
      totalCourses: 0,
      courseProgress: new Map(),
    })
    mockProgressMap = emptyProgressMap

    const { result } = renderHook(() => useNextBestCourse('path-nonexistent'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.action).toBeNull()
    })
    expect(result.current.entry).toBeNull()
    expect(result.current.course).toBeNull()
  })

  it('re-computes when progress changes (PROGRESS_UPDATED_EVENT)', async () => {
    const { result } = renderHook(() => useNextBestCourse('path-1'), {
      wrapper: createWrapper(),
    })

    // Initially resume course-1
    await waitFor(() => {
      expect(result.current.action).toBe('resume')
    })
    expect(result.current.entry?.courseId).toBe('course-1')

    // Simulate progress change: course-1 completes, course-2 is now the target
    const updatedProgress = new Map<string, CourseProgressInfo>()
    updatedProgress.set('course-1', { courseId: 'course-1', completionPct: 100, completedLessons: 5, totalLessons: 5 } as CourseProgressInfo)
    updatedProgress.set('course-2', { courseId: 'course-2', completionPct: 0, completedLessons: 0, totalLessons: 3 } as CourseProgressInfo)
    updatedProgress.set('course-3', { courseId: 'course-3', completionPct: 0, completedLessons: 0, totalLessons: 0 } as CourseProgressInfo)

    const updatedSummary: PathProgressSummary = {
      ...mockPathProgressSummary,
      courseProgress: updatedProgress,
    }
    const updatedMap = new Map<string, PathProgressSummary>()
    updatedMap.set('path-1', updatedSummary)
    mockProgressMap = updatedMap

    // Dispatch progress event
    window.dispatchEvent(new CustomEvent(PROGRESS_UPDATED_EVENT))

    // Should now show start for course-2
    await waitFor(() => {
      expect(result.current.action).toBe('start')
    })
    expect(result.current.entry?.courseId).toBe('course-2')
  })
})
