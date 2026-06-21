import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import {
  calculatePathMilestoneProgress,
  PATH_MILESTONE_TIER_CONFIG,
  getPathMilestoneTierConfig,
} from '@/lib/challengePathMilestones'
import type { LearningPathEntry, ImportedCourse } from '@/data/types'

function makeEntry(overrides: Partial<LearningPathEntry> = {}): LearningPathEntry {
  return {
    id: crypto.randomUUID(),
    pathId: 'path-1',
    courseId: 'course-1',
    courseType: 'imported',
    position: 1,
    isManuallyOrdered: false,
    ...overrides,
  }
}

function makeImportedCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'Test Course',
    importedAt: new Date().toISOString(),
    category: 'uncategorized',
    tags: [],
    status: 'active',
    videoCount: 4,
    pdfCount: 0,
    directoryHandle: null,
    ...overrides,
  }
}

describe('PATH_MILESTONE_TIER_CONFIG', () => {
  it('has config entries for all 4 milestone thresholds', () => {
    expect(PATH_MILESTONE_TIER_CONFIG[25]).toBeDefined()
    expect(PATH_MILESTONE_TIER_CONFIG[50]).toBeDefined()
    expect(PATH_MILESTONE_TIER_CONFIG[75]).toBeDefined()
    expect(PATH_MILESTONE_TIER_CONFIG[100]).toBeDefined()
  })

  it('uses path-specific labels', () => {
    expect(PATH_MILESTONE_TIER_CONFIG[25].label).toBe('First Steps')
    expect(PATH_MILESTONE_TIER_CONFIG[50].label).toBe('Halfway There')
    expect(PATH_MILESTONE_TIER_CONFIG[75].label).toBe('Almost Done')
    expect(PATH_MILESTONE_TIER_CONFIG[100].label).toBe('Path Complete')
  })
})

describe('getPathMilestoneTierConfig', () => {
  it('returns correct config for known thresholds', () => {
    expect(getPathMilestoneTierConfig(25).label).toBe('First Steps')
    expect(getPathMilestoneTierConfig(100).label).toBe('Path Complete')
  })

  it('falls back to 25% config for unknown thresholds', () => {
    const config = getPathMilestoneTierConfig(37)
    expect(config.label).toBe('First Steps')
  })
})

describe('calculatePathMilestoneProgress', () => {
  beforeEach(async () => {
    await db.learningPathEntries.clear()
    await db.importedCourses.clear()
    await db.progress.clear()
  })

  it('returns 0 for a path with no entries', async () => {
    const result = await calculatePathMilestoneProgress('empty-path')
    expect(result).toBe(0)
  })

  it('returns 0 when no courses have progress', async () => {
    await db.learningPathEntries.bulkPut([
      makeEntry({ courseId: 'course-1' }),
      makeEntry({ id: crypto.randomUUID(), courseId: 'course-2', position: 2 }),
    ])

    const result = await calculatePathMilestoneProgress('path-1')
    expect(result).toBe(0)
  })

  it('returns 0 when imported course has no videoCount', async () => {
    await db.importedCourses.put(makeImportedCourse({ id: 'course-1', videoCount: 0 }))
    await db.learningPathEntries.put(makeEntry({ courseId: 'course-1' }))

    const result = await calculatePathMilestoneProgress('path-1')
    expect(result).toBe(0)
  })

  it('returns 0 for path with only catalog entries', async () => {
    await db.learningPathEntries.bulkPut([
      makeEntry({ courseId: 'catalog-1', courseType: 'catalog' }),
      makeEntry({
        id: crypto.randomUUID(),
        courseId: 'catalog-2',
        courseType: 'catalog',
        position: 2,
      }),
    ])

    const result = await calculatePathMilestoneProgress('path-1')
    expect(result).toBe(0)
  })

  it('returns 50% when half of imported course videos are completed', async () => {
    await db.importedCourses.put(makeImportedCourse({ id: 'course-1', videoCount: 4 }))
    await db.learningPathEntries.put(makeEntry({ courseId: 'course-1' }))

    // Seed 2 of 4 videos as completed
    await db.progress.bulkPut([
      {
        courseId: 'course-1',
        videoId: 'vid-1',
        currentTime: 300,
        completionPercentage: 100,
        completedAt: new Date().toISOString(),
      },
      {
        courseId: 'course-1',
        videoId: 'vid-2',
        currentTime: 300,
        completionPercentage: 100,
        completedAt: new Date().toISOString(),
      },
      {
        courseId: 'course-1',
        videoId: 'vid-3',
        currentTime: 0,
        completionPercentage: 0,
        completedAt: undefined,
      },
      {
        courseId: 'course-1',
        videoId: 'vid-4',
        currentTime: 0,
        completionPercentage: 0,
        completedAt: undefined,
      },
    ])

    const result = await calculatePathMilestoneProgress('path-1')
    expect(result).toBe(50)
  })

  it('returns 100% when all imported course videos are completed', async () => {
    await db.importedCourses.put(makeImportedCourse({ id: 'course-1', videoCount: 4 }))
    await db.learningPathEntries.put(makeEntry({ courseId: 'course-1' }))

    // Seed all 4 videos as completed
    await db.progress.bulkPut([
      {
        courseId: 'course-1',
        videoId: 'vid-1',
        currentTime: 300,
        completionPercentage: 100,
        completedAt: new Date().toISOString(),
      },
      {
        courseId: 'course-1',
        videoId: 'vid-2',
        currentTime: 300,
        completionPercentage: 100,
        completedAt: new Date().toISOString(),
      },
      {
        courseId: 'course-1',
        videoId: 'vid-3',
        currentTime: 300,
        completionPercentage: 100,
        completedAt: new Date().toISOString(),
      },
      {
        courseId: 'course-1',
        videoId: 'vid-4',
        currentTime: 300,
        completionPercentage: 100,
        completedAt: new Date().toISOString(),
      },
    ])

    const result = await calculatePathMilestoneProgress('path-1')
    expect(result).toBe(100)
  })

  it('handles mixed catalog and imported entries correctly', async () => {
    await db.importedCourses.put(makeImportedCourse({ id: 'course-1', videoCount: 4 }))
    await db.learningPathEntries.bulkPut([
      makeEntry({ courseId: 'catalog-1', courseType: 'catalog' }),
      makeEntry({ id: crypto.randomUUID(), courseId: 'course-1', position: 2 }),
    ])

    // Seed 3 of 4 imported videos as completed
    await db.progress.bulkPut([
      {
        courseId: 'course-1',
        videoId: 'vid-1',
        currentTime: 300,
        completionPercentage: 100,
        completedAt: new Date().toISOString(),
      },
      {
        courseId: 'course-1',
        videoId: 'vid-2',
        currentTime: 300,
        completionPercentage: 100,
        completedAt: new Date().toISOString(),
      },
      {
        courseId: 'course-1',
        videoId: 'vid-3',
        currentTime: 300,
        completionPercentage: 100,
        completedAt: new Date().toISOString(),
      },
      {
        courseId: 'course-1',
        videoId: 'vid-4',
        currentTime: 0,
        completionPercentage: 0,
        completedAt: undefined,
      },
    ])

    const result = await calculatePathMilestoneProgress('path-1')
    // 3 out of 4 imported videos = 75%. Catalog entries contribute 0.
    expect(result).toBe(75)
  })
})
