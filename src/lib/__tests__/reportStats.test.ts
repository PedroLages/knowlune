import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Course } from '@/data/types'

/* ------------------------------------------------------------------ */
/*  Test course factory                                                */
/* ------------------------------------------------------------------ */

function makeLesson(id: string) {
  return {
    id,
    title: `Lesson ${id}`,
    description: '',
    order: 1,
    resources: [],
    keyTopics: [],
  }
}

function makeModule(id: string, lessonIds: string[]) {
  return {
    id,
    title: `Module ${id}`,
    description: '',
    order: 1,
    lessons: lessonIds.map(makeLesson),
  }
}

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course-1',
    title: 'Test Course',
    shortTitle: 'TC',
    description: 'A test course',
    category: 'behavioral-analysis',
    difficulty: 'beginner',
    totalLessons: 2,
    totalVideos: 1,
    totalPDFs: 1,
    estimatedHours: 5,
    tags: ['test'],
    instructorId: 'instructor-1',
    modules: [makeModule('mod-1', ['lesson-1', 'lesson-2'])],
    isSequential: false,
    basePath: '/courses/test',
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Mock dependencies BEFORE importing the module under test           */
/* ------------------------------------------------------------------ */

// Mock @/data/courses — we control allCourses per-test
let mockCourses: Course[] = []

vi.mock('@/data/courses', () => ({
  get allCourses() {
    return mockCourses
  },
}))

// Mock @/lib/progress — return controlled data
const mockGetCourseCompletionPercent = vi.fn().mockReturnValue(0)
const mockGetAllProgress = vi.fn().mockReturnValue({})
const mockGetTotalCompletedLessons = vi.fn().mockReturnValue(0)
const mockGetCoursesInProgress = vi.fn().mockReturnValue([])
const mockGetCompletedCourses = vi.fn().mockReturnValue([])
const mockGetLast7DaysLessonCompletions = vi.fn().mockReturnValue([0, 0, 0, 0, 0, 0, 0])
const mockGetWeeklyChange = vi.fn().mockReturnValue(0)

vi.mock('@/lib/progress', () => ({
  getCourseCompletionPercent: (...args: unknown[]) => mockGetCourseCompletionPercent(...args),
  getAllProgress: () => mockGetAllProgress(),
  getTotalCompletedLessons: (...args: unknown[]) => mockGetTotalCompletedLessons(...args),
  getCoursesInProgress: (...args: unknown[]) => mockGetCoursesInProgress(...args),
  getCompletedCourses: (...args: unknown[]) => mockGetCompletedCourses(...args),
  getLast7DaysLessonCompletions: () => mockGetLast7DaysLessonCompletions(),
  getWeeklyChange: (...args: unknown[]) => mockGetWeeklyChange(...args),
}))

// Mock @/lib/studyLog
const mockGetActionsPerDay = vi.fn().mockReturnValue([])
const mockGetCurrentStreak = vi.fn().mockReturnValue(0)

vi.mock('@/lib/studyLog', () => ({
  getActionsPerDay: (...args: unknown[]) => mockGetActionsPerDay(...args),
  getCurrentStreak: () => mockGetCurrentStreak(),
}))

// Mock @/db/schema (for computeWeeklyGoalProgress)
vi.mock('@/db/schema', () => ({
  db: {
    studySessions: {
      where: vi.fn().mockReturnValue({
        aboveOrEqual: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
  },
}))

/* ------------------------------------------------------------------ */
/*  Import module under test (after mocks are established)             */
/* ------------------------------------------------------------------ */

import {
  computeStatTrends,
  getCategoryCompletionForRadar,
  getCourseCompletionData,
  getCategoryColorMap,
  computeSkillsDimensions,
  computeWeeklyGoalProgress,
} from '@/lib/reportStats'

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.clearAllMocks()
  mockCourses = []
})

describe('computeStatTrends', () => {
  it('returns lesson change, note change, and sparkline from progress module', () => {
    mockGetWeeklyChange.mockImplementation((metric: string) =>
      metric === 'lessons' ? 3 : metric === 'notes' ? -1 : 0
    )
    mockGetLast7DaysLessonCompletions.mockReturnValue([1, 0, 2, 1, 3, 0, 1])

    const result = computeStatTrends()

    expect(result.lessonsChange).toBe(3)
    expect(result.notesChange).toBe(-1)
    expect(result.sparkline).toEqual([1, 0, 2, 1, 3, 0, 1])
  })

  it('returns zeros when no activity exists', () => {
    mockGetWeeklyChange.mockReturnValue(0)
    mockGetLast7DaysLessonCompletions.mockReturnValue([0, 0, 0, 0, 0, 0, 0])

    const result = computeStatTrends()

    expect(result.lessonsChange).toBe(0)
    expect(result.notesChange).toBe(0)
    expect(result.sparkline).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe('getCategoryCompletionForRadar', () => {
  it('returns empty array when no courses exist', () => {
    const result = getCategoryCompletionForRadar()
    expect(result).toEqual([])
  })

  it('returns one entry per category with average completion', () => {
    mockCourses = [
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c3', category: 'influence-authority' }),
    ]
    mockGetCourseCompletionPercent.mockImplementation((courseId: string) => {
      if (courseId === 'c1') return 60
      if (courseId === 'c2') return 40
      if (courseId === 'c3') return 80
      return 0
    })

    const result = getCategoryCompletionForRadar()

    expect(result).toHaveLength(2)

    const behavioral = result.find(r => r.category === 'Behavioral Analysis')
    expect(behavioral).toBeDefined()
    expect(behavioral!.completion).toBe(50) // avg of 60 and 40
    expect(behavioral!.fullMark).toBe(100)

    const influence = result.find(r => r.category === 'Influence Authority')
    expect(influence).toBeDefined()
    expect(influence!.completion).toBe(80)
  })

  it('formats hyphenated category slugs to Title Case', () => {
    mockCourses = [
      makeCourse({ id: 'c1', category: 'operative-training' }),
    ]
    mockGetCourseCompletionPercent.mockReturnValue(50)

    const result = getCategoryCompletionForRadar()

    expect(result[0].category).toBe('Operative Training')
  })

  it('handles single course with zero completion', () => {
    mockCourses = [makeCourse({ id: 'c1' })]
    mockGetCourseCompletionPercent.mockReturnValue(0)

    const result = getCategoryCompletionForRadar()

    expect(result).toHaveLength(1)
    expect(result[0].completion).toBe(0)
  })

  it('handles all courses at 100% completion', () => {
    mockCourses = [
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', category: 'behavioral-analysis' }),
    ]
    mockGetCourseCompletionPercent.mockReturnValue(100)

    const result = getCategoryCompletionForRadar()

    expect(result[0].completion).toBe(100)
  })
})

describe('getCourseCompletionData', () => {
  it('returns empty array when no courses exist', () => {
    const result = getCourseCompletionData()
    expect(result).toEqual([])
  })

  it('returns sorted course data (highest completion first)', () => {
    mockCourses = [
      makeCourse({ id: 'c1', title: 'Low Course', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', title: 'High Course', category: 'influence-authority' }),
      makeCourse({ id: 'c3', title: 'Mid Course', category: 'operative-training' }),
    ]
    mockGetCourseCompletionPercent.mockImplementation((courseId: string) => {
      if (courseId === 'c1') return 20
      if (courseId === 'c2') return 90
      if (courseId === 'c3') return 50
      return 0
    })

    const result = getCourseCompletionData()

    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('High Course')
    expect(result[0].completion).toBe(90)
    expect(result[0].category).toBe('influence-authority')
    expect(result[1].name).toBe('Mid Course')
    expect(result[1].completion).toBe(50)
    expect(result[2].name).toBe('Low Course')
    expect(result[2].completion).toBe(20)
  })

  it('handles courses with equal completion (stable sort)', () => {
    mockCourses = [
      makeCourse({ id: 'c1', title: 'Course A' }),
      makeCourse({ id: 'c2', title: 'Course B' }),
    ]
    mockGetCourseCompletionPercent.mockReturnValue(50)

    const result = getCourseCompletionData()

    expect(result).toHaveLength(2)
    expect(result.every(r => r.completion === 50)).toBe(true)
  })

  it('handles single course', () => {
    mockCourses = [makeCourse({ id: 'c1', title: 'Solo' })]
    mockGetCourseCompletionPercent.mockReturnValue(75)

    const result = getCourseCompletionData()

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'Solo',
      completion: 75,
      category: 'behavioral-analysis',
    })
  })

  it('passes total lessons from modules to getCourseCompletionPercent', () => {
    const course = makeCourse({
      id: 'c1',
      modules: [
        makeModule('m1', ['l1', 'l2']),
        makeModule('m2', ['l3']),
      ],
    })
    mockCourses = [course]
    mockGetCourseCompletionPercent.mockReturnValue(33)

    getCourseCompletionData()

    // 3 total lessons across 2 modules
    expect(mockGetCourseCompletionPercent).toHaveBeenCalledWith('c1', 3)
  })
})

describe('getCategoryColorMap', () => {
  it('returns empty map when no courses exist', () => {
    const result = getCategoryColorMap()
    expect(result).toEqual({})
  })

  it('maps each unique category to a chart color variable', () => {
    mockCourses = [
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', category: 'influence-authority' }),
    ]

    const result = getCategoryColorMap()

    expect(Object.keys(result)).toHaveLength(2)
    expect(result['behavioral-analysis']).toMatch(/^var\(--chart-\d\)$/)
    expect(result['influence-authority']).toMatch(/^var\(--chart-\d\)$/)
    // First and second should get different colors
    expect(result['behavioral-analysis']).not.toBe(result['influence-authority'])
  })

  it('deduplicates categories from multiple courses', () => {
    mockCourses = [
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c3', category: 'behavioral-analysis' }),
    ]

    const result = getCategoryColorMap()

    expect(Object.keys(result)).toHaveLength(1)
    expect(result['behavioral-analysis']).toBeDefined()
  })

  it('wraps colors when more than 5 categories', () => {
    const categories = [
      'behavioral-analysis',
      'influence-authority',
      'confidence-mastery',
      'operative-training',
      'research-library',
      'extra-category',
    ] as const

    mockCourses = categories.map((cat, i) =>
      makeCourse({ id: `c${i}`, category: cat as Course['category'] })
    )

    const result = getCategoryColorMap()

    expect(Object.keys(result)).toHaveLength(6)
    // 6th category wraps to first color (index 5 % 5 === 0)
    expect(result['extra-category']).toBe(result['behavioral-analysis'])
  })
})

describe('computeSkillsDimensions', () => {
  it('returns 5 dimensions with zero values when no data exists', () => {
    mockCourses = []
    mockGetAllProgress.mockReturnValue({})
    mockGetTotalCompletedLessons.mockReturnValue(0)
    mockGetCurrentStreak.mockReturnValue(0)
    mockGetCoursesInProgress.mockReturnValue([])
    mockGetCompletedCourses.mockReturnValue([])
    mockGetActionsPerDay.mockReturnValue([])

    const result = computeSkillsDimensions()

    expect(result).toHaveLength(5)
    expect(result.map(d => d.dimension)).toEqual([
      'Completion',
      'Consistency',
      'Breadth',
      'Depth',
      'Engagement',
    ])
    expect(result.every(d => d.value === 0)).toBe(true)
    expect(result.every(d => d.fullMark === 100)).toBe(true)
  })

  it('calculates Completion score from total lessons completed', () => {
    mockCourses = [makeCourse({ id: 'c1', modules: [makeModule('m1', ['l1', 'l2', 'l3', 'l4'])] })]
    mockGetAllProgress.mockReturnValue({})
    mockGetTotalCompletedLessons.mockReturnValue(2) // 2 of 4 lessons
    mockGetCurrentStreak.mockReturnValue(0)
    mockGetCoursesInProgress.mockReturnValue([])
    mockGetCompletedCourses.mockReturnValue([])
    mockGetActionsPerDay.mockReturnValue([])

    const result = computeSkillsDimensions()

    const completion = result.find(d => d.dimension === 'Completion')
    expect(completion!.value).toBe(50) // 2/4 = 50%
  })

  it('calculates Consistency score from streak (capped at 100)', () => {
    mockCourses = []
    mockGetAllProgress.mockReturnValue({})
    mockGetTotalCompletedLessons.mockReturnValue(0)
    mockGetCurrentStreak.mockReturnValue(3) // 3 days
    mockGetCoursesInProgress.mockReturnValue([])
    mockGetCompletedCourses.mockReturnValue([])
    mockGetActionsPerDay.mockReturnValue([])

    const result = computeSkillsDimensions()

    const consistency = result.find(d => d.dimension === 'Consistency')
    // 3/7 * 100 = 42.86 -> rounds to 43
    expect(consistency!.value).toBe(43)
  })

  it('caps Consistency at 100 for streaks >= 7 days', () => {
    mockCourses = []
    mockGetAllProgress.mockReturnValue({})
    mockGetTotalCompletedLessons.mockReturnValue(0)
    mockGetCurrentStreak.mockReturnValue(14) // 14 days
    mockGetCoursesInProgress.mockReturnValue([])
    mockGetCompletedCourses.mockReturnValue([])
    mockGetActionsPerDay.mockReturnValue([])

    const result = computeSkillsDimensions()

    const consistency = result.find(d => d.dimension === 'Consistency')
    expect(consistency!.value).toBe(100)
  })

  it('calculates Breadth from started category ratio', () => {
    mockCourses = [
      makeCourse({ id: 'c1', category: 'behavioral-analysis' }),
      makeCourse({ id: 'c2', category: 'influence-authority' }),
      makeCourse({ id: 'c3', category: 'operative-training' }),
    ]
    // Progress exists for c1 and c3 (2 of 3 categories started)
    mockGetAllProgress.mockReturnValue({
      c1: { completedLessons: ['l1'] },
      c3: { completedLessons: ['l2'] },
    })
    mockGetTotalCompletedLessons.mockReturnValue(2)
    mockGetCurrentStreak.mockReturnValue(0)
    mockGetCoursesInProgress.mockReturnValue([])
    mockGetCompletedCourses.mockReturnValue([])
    mockGetActionsPerDay.mockReturnValue([])

    const result = computeSkillsDimensions()

    const breadth = result.find(d => d.dimension === 'Breadth')
    expect(breadth!.value).toBe(67) // 2/3 = 66.67 -> rounds to 67
  })

  it('calculates Depth from average completion of started courses', () => {
    mockCourses = [
      makeCourse({ id: 'c1' }),
      makeCourse({ id: 'c2' }),
    ]
    mockGetAllProgress.mockReturnValue({})
    mockGetTotalCompletedLessons.mockReturnValue(0)
    mockGetCurrentStreak.mockReturnValue(0)
    // In progress: one course at 60%
    mockGetCoursesInProgress.mockReturnValue([
      { ...makeCourse({ id: 'c1' }), completionPercent: 60 },
    ])
    // Completed: one course (100%)
    mockGetCompletedCourses.mockReturnValue([
      makeCourse({ id: 'c2', modules: [makeModule('m1', ['l1', 'l2'])] }),
    ])
    mockGetActionsPerDay.mockReturnValue([])

    const result = computeSkillsDimensions()

    const depth = result.find(d => d.dimension === 'Depth')
    // (60 + 100) / 2 = 80
    expect(depth!.value).toBe(80)
  })

  it('returns Depth 0 when no courses started', () => {
    mockCourses = [makeCourse({ id: 'c1' })]
    mockGetAllProgress.mockReturnValue({})
    mockGetTotalCompletedLessons.mockReturnValue(0)
    mockGetCurrentStreak.mockReturnValue(0)
    mockGetCoursesInProgress.mockReturnValue([])
    mockGetCompletedCourses.mockReturnValue([])
    mockGetActionsPerDay.mockReturnValue([])

    const result = computeSkillsDimensions()

    const depth = result.find(d => d.dimension === 'Depth')
    expect(depth!.value).toBe(0)
  })

  it('calculates Engagement from actions per day (capped at 100)', () => {
    mockCourses = []
    mockGetAllProgress.mockReturnValue({})
    mockGetTotalCompletedLessons.mockReturnValue(0)
    mockGetCurrentStreak.mockReturnValue(0)
    mockGetCoursesInProgress.mockReturnValue([])
    mockGetCompletedCourses.mockReturnValue([])
    // 3 actions/day average over 7 days
    mockGetActionsPerDay.mockReturnValue([
      { date: '2025-01-15', count: 2 },
      { date: '2025-01-14', count: 4 },
      { date: '2025-01-13', count: 3 },
      { date: '2025-01-12', count: 5 },
      { date: '2025-01-11', count: 1 },
      { date: '2025-01-10', count: 3 },
      { date: '2025-01-09', count: 3 },
    ])

    const result = computeSkillsDimensions()

    const engagement = result.find(d => d.dimension === 'Engagement')
    // total = 21, avg = 3, (3/5)*100 = 60
    expect(engagement!.value).toBe(60)
  })

  it('caps Engagement at 100 for high activity levels', () => {
    mockCourses = []
    mockGetAllProgress.mockReturnValue({})
    mockGetTotalCompletedLessons.mockReturnValue(0)
    mockGetCurrentStreak.mockReturnValue(0)
    mockGetCoursesInProgress.mockReturnValue([])
    mockGetCompletedCourses.mockReturnValue([])
    // 10 actions/day average (double the 5/day threshold)
    mockGetActionsPerDay.mockReturnValue([
      { date: '2025-01-15', count: 10 },
    ])

    const result = computeSkillsDimensions()

    const engagement = result.find(d => d.dimension === 'Engagement')
    expect(engagement!.value).toBe(100)
  })

  it('handles completed course with zero lessons for Depth', () => {
    mockCourses = [makeCourse({ id: 'c1', modules: [] })]
    mockGetAllProgress.mockReturnValue({})
    mockGetTotalCompletedLessons.mockReturnValue(0)
    mockGetCurrentStreak.mockReturnValue(0)
    mockGetCoursesInProgress.mockReturnValue([])
    // Completed course with no lessons — should get 0% not 100%
    mockGetCompletedCourses.mockReturnValue([
      makeCourse({ id: 'c1', modules: [] }),
    ])
    mockGetActionsPerDay.mockReturnValue([])

    const result = computeSkillsDimensions()

    const depth = result.find(d => d.dimension === 'Depth')
    expect(depth!.value).toBe(0)
  })
})

describe('computeWeeklyGoalProgress', () => {
  it('returns zero progress when no sessions exist', async () => {
    const result = await computeWeeklyGoalProgress()

    expect(result.currentMinutes).toBe(0)
    expect(result.goalMinutes).toBe(300) // 5 hours default
    expect(result.percentage).toBe(0)
  })

  it('calculates minutes from sessions in current week', async () => {
    const { db } = await import('@/db/schema')
    const mockSessions = [
      { id: '1', duration: 1800, startTime: '2025-01-15T10:00:00Z' }, // 30 min
      { id: '2', duration: 3600, startTime: '2025-01-14T10:00:00Z' }, // 60 min
    ]
    vi.mocked(db.studySessions.where).mockReturnValue({
      aboveOrEqual: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSessions),
      }),
    } as never)

    const result = await computeWeeklyGoalProgress()

    expect(result.currentMinutes).toBe(90) // 30 + 60
    expect(result.goalMinutes).toBe(300)
    expect(result.percentage).toBe(30) // 90/300 = 30%
  })

  it('handles database errors gracefully', async () => {
    const { db } = await import('@/db/schema')
    vi.mocked(db.studySessions.where).mockImplementation(() => {
      throw new Error('DB error')
    })

    const result = await computeWeeklyGoalProgress()

    expect(result.currentMinutes).toBe(0)
    expect(result.goalMinutes).toBe(300)
    expect(result.percentage).toBe(0)
  })

  it('rounds session durations to nearest minute', async () => {
    const { db } = await import('@/db/schema')
    const mockSessions = [
      { id: '1', duration: 90, startTime: '2025-01-15T10:00:00Z' }, // 1.5 min -> rounds to 2
    ]
    vi.mocked(db.studySessions.where).mockReturnValue({
      aboveOrEqual: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSessions),
      }),
    } as never)

    const result = await computeWeeklyGoalProgress()

    expect(result.currentMinutes).toBe(2) // Math.round(90/60) = 2
  })

  it('handles sessions with zero duration', async () => {
    const { db } = await import('@/db/schema')
    const mockSessions = [
      { id: '1', duration: 0, startTime: '2025-01-15T10:00:00Z' },
    ]
    vi.mocked(db.studySessions.where).mockReturnValue({
      aboveOrEqual: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSessions),
      }),
    } as never)

    const result = await computeWeeklyGoalProgress()

    expect(result.currentMinutes).toBe(0)
    expect(result.percentage).toBe(0)
  })

  it('handles sessions with undefined duration', async () => {
    const { db } = await import('@/db/schema')
    const mockSessions = [
      { id: '1', duration: undefined, startTime: '2025-01-15T10:00:00Z' },
    ]
    vi.mocked(db.studySessions.where).mockReturnValue({
      aboveOrEqual: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockSessions),
      }),
    } as never)

    const result = await computeWeeklyGoalProgress()

    expect(result.currentMinutes).toBe(0) // (undefined ?? 0) / 60 = 0
  })
})
