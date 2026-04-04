/**
 * Unit tests for Course Embedding Service (E52-S04)
 *
 * Tests: metadata concatenation, sourceHash computation, change detection,
 * non-blocking failure, and backfill.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { ImportedCourse } from '@/data/types'

// Mock the worker coordinator — do NOT call real ONNX inference
vi.mock('@/ai/workers/coordinator', () => ({
  generateEmbeddings: vi.fn(async () => [new Float32Array(384).fill(0.1)]),
}))

let mod: typeof import('../courseEmbeddingService')

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: overrides.id ?? 'course-1',
    name: overrides.name ?? 'Test Course',
    description: overrides.description ?? 'A course about testing',
    importedAt: '2026-01-01T00:00:00Z',
    category: 'research-library',
    tags: overrides.tags ?? ['testing', 'vitest'],
    status: 'active',
    videoCount: 5,
    pdfCount: 1,
    directoryHandle: null,
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  // Re-mock after resetModules
  vi.doMock('@/ai/workers/coordinator', () => ({
    generateEmbeddings: vi.fn(async () => [new Float32Array(384).fill(0.1)]),
  }))
  await import('@/db/schema')
  mod = await import('../courseEmbeddingService')
})

describe('buildMetadataText', () => {
  it('concatenates title + description + tags', () => {
    const course = makeCourse()
    const text = mod.buildMetadataText(course)
    expect(text).toBe('Test Course A course about testing testing, vitest')
  })

  it('handles missing description', () => {
    const course = makeCourse({ description: undefined })
    const text = mod.buildMetadataText(course)
    expect(text).toBe('Test Course testing, vitest')
  })

  it('handles empty tags', () => {
    const course = makeCourse({ tags: [] })
    const text = mod.buildMetadataText(course)
    expect(text).toBe('Test Course A course about testing')
  })

  it('handles name only', () => {
    const course = makeCourse({ description: undefined, tags: [] })
    const text = mod.buildMetadataText(course)
    expect(text).toBe('Test Course')
  })
})

describe('computeSourceHash', () => {
  it('returns a hex string', async () => {
    const hash = await mod.computeSourceHash(makeCourse())
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns same hash for same metadata', async () => {
    const course = makeCourse()
    const h1 = await mod.computeSourceHash(course)
    const h2 = await mod.computeSourceHash(course)
    expect(h1).toBe(h2)
  })

  it('returns different hash when tags change', async () => {
    const h1 = await mod.computeSourceHash(makeCourse({ tags: ['a'] }))
    const h2 = await mod.computeSourceHash(makeCourse({ tags: ['b'] }))
    expect(h1).not.toBe(h2)
  })

  it('returns different hash when description changes', async () => {
    const h1 = await mod.computeSourceHash(makeCourse({ description: 'old' }))
    const h2 = await mod.computeSourceHash(makeCourse({ description: 'new' }))
    expect(h1).not.toBe(h2)
  })
})

describe('computeCourseEmbedding', () => {
  it('stores embedding in courseEmbeddings table', async () => {
    const course = makeCourse()
    const result = await mod.computeCourseEmbedding(course)

    expect(result).not.toBeNull()
    expect(result!.courseId).toBe('course-1')
    expect(result!.embedding).toHaveLength(384)
    expect(result!.sourceHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result!.generatedAt).toBeTruthy()

    // Verify in DB
    const { db } = await import('@/db/schema')
    const stored = await db.courseEmbeddings.get('course-1')
    expect(stored).toBeDefined()
    expect(stored!.embedding).toHaveLength(384)
  })

  it('skips regeneration when sourceHash unchanged', async () => {
    const course = makeCourse()
    const first = await mod.computeCourseEmbedding(course)
    expect(first).not.toBeNull()

    const second = await mod.computeCourseEmbedding(course)
    expect(second).toBeNull() // No change
  })

  it('regenerates when tags change', async () => {
    const course = makeCourse()
    await mod.computeCourseEmbedding(course)

    const updated = makeCourse({ tags: ['new-tag'] })
    const result = await mod.computeCourseEmbedding(updated)
    expect(result).not.toBeNull()
    expect(result!.sourceHash).not.toBe((await mod.computeSourceHash(course)))
  })
})

describe('generateCourseEmbeddingAfterImport', () => {
  it('does not throw when embedding generation fails', async () => {
    // Override the mock to throw
    const coordinator = await import('@/ai/workers/coordinator')
    vi.mocked(coordinator.generateEmbeddings).mockRejectedValueOnce(
      new Error('Worker crashed')
    )

    // Should not throw
    await expect(
      mod.generateCourseEmbeddingAfterImport(makeCourse())
    ).resolves.toBeUndefined()
  })
})

describe('backfillCourseEmbeddings', () => {
  it('generates embeddings for courses without them', async () => {
    const { db } = await import('@/db/schema')

    // Add 3 courses without embeddings
    await db.importedCourses.bulkAdd([
      makeCourse({ id: 'c1', name: 'Course 1' }),
      makeCourse({ id: 'c2', name: 'Course 2' }),
      makeCourse({ id: 'c3', name: 'Course 3' }),
    ])

    const result = await mod.backfillCourseEmbeddings()
    expect(result.processed).toBe(3)
    expect(result.failed).toBe(0)

    // All should have embeddings now
    const embeddings = await db.courseEmbeddings.toArray()
    expect(embeddings).toHaveLength(3)
  })

  it('skips courses that already have embeddings', async () => {
    const { db } = await import('@/db/schema')

    await db.importedCourses.bulkAdd([
      makeCourse({ id: 'c1', name: 'Course 1' }),
      makeCourse({ id: 'c2', name: 'Course 2' }),
    ])

    // Generate embedding for c1 first
    await mod.computeCourseEmbedding(makeCourse({ id: 'c1', name: 'Course 1' }))

    const result = await mod.backfillCourseEmbeddings()
    expect(result.processed).toBe(1) // Only c2
    expect(result.failed).toBe(0)
  })

  it('continues processing when individual course fails', async () => {
    const { db } = await import('@/db/schema')
    const coordinator = await import('@/ai/workers/coordinator')

    await db.importedCourses.bulkAdd([
      makeCourse({ id: 'c1', name: 'Course 1' }),
      makeCourse({ id: 'c2', name: 'Course 2' }),
    ])

    // First call fails, second succeeds
    vi.mocked(coordinator.generateEmbeddings)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([new Float32Array(384).fill(0.2)])

    const result = await mod.backfillCourseEmbeddings()
    expect(result.processed).toBe(1)
    expect(result.failed).toBe(1)
  })
})
