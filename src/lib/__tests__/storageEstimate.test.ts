import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (before imports) ---

const mockTable = vi.fn()

// Reusable mock table builder for the db property mocks used by new functions
function makeDbTableMock(rows: Record<string, unknown>[] = []) {
  return {
    toArray: vi.fn().mockResolvedValue(rows),
    where: vi.fn().mockReturnThis(),
    equals: vi.fn().mockReturnThis(),
    delete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    bulkDelete: vi.fn().mockResolvedValue(undefined),
    above: vi.fn().mockReturnThis(),
  }
}

// Mutable refs so individual tests can override them
let mockImportedCourses = makeDbTableMock()
let mockImportedVideos = makeDbTableMock()
let mockImportedPdfs = makeDbTableMock()
let mockNotes = makeDbTableMock()
let mockScreenshots = makeDbTableMock()
let mockCourseThumbnails = makeDbTableMock()
let mockEmbeddings = makeDbTableMock()
let mockVideoCaptions = makeDbTableMock()
let mockYoutubeTranscripts = makeDbTableMock()
let mockStudySessions = makeDbTableMock()
let mockContentProgress = makeDbTableMock()
let mockBookmarks = makeDbTableMock()
let mockFlashcards = makeDbTableMock()
let mockQuizzes = makeDbTableMock()
let mockQuizAttempts = makeDbTableMock()
let mockReviewRecords = makeDbTableMock()

vi.mock('@/db', () => ({
  db: {
    table: (...args: unknown[]) => mockTable(...args),
    get importedCourses() { return mockImportedCourses },
    get importedVideos() { return mockImportedVideos },
    get importedPdfs() { return mockImportedPdfs },
    get notes() { return mockNotes },
    get screenshots() { return mockScreenshots },
    get courseThumbnails() { return mockCourseThumbnails },
    get embeddings() { return mockEmbeddings },
    get videoCaptions() { return mockVideoCaptions },
    get youtubeTranscripts() { return mockYoutubeTranscripts },
    get studySessions() { return mockStudySessions },
    get contentProgress() { return mockContentProgress },
    get bookmarks() { return mockBookmarks },
    get flashcards() { return mockFlashcards },
    get quizzes() { return mockQuizzes },
    get quizAttempts() { return mockQuizAttempts },
    get reviewRecords() { return mockReviewRecords },
    transaction: vi.fn((_mode: string, _tables: unknown[], fn: () => Promise<void>) => fn()),
  },
}))

const mockGetStorageEstimate = vi.fn()

vi.mock('@/lib/storageQuotaMonitor', () => ({
  getStorageEstimate: (...args: unknown[]) => mockGetStorageEstimate(...args),
}))

// --- Imports (after mocks) ---

import {
  estimateTableSize,
  getStorageOverview,
  getPerCourseUsage,
  clearCourseThumbnail,
  deleteCourseData,
  STORAGE_CATEGORIES,
} from '@/lib/storageEstimate'

// --- Helpers ---

function createMockTable(rows: Record<string, unknown>[]) {
  return {
    count: vi.fn().mockResolvedValue(rows.length),
    limit: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(rows),
    }),
  }
}

function createEmptyMockTable() {
  return {
    count: vi.fn().mockResolvedValue(0),
    limit: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
  }
}

function createFailingMockTable() {
  return {
    count: vi.fn().mockRejectedValue(new Error('DB error')),
    limit: vi.fn().mockReturnValue({
      toArray: vi.fn().mockRejectedValue(new Error('DB error')),
    }),
  }
}

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks()
  // Reset db table mocks to empty defaults
  mockImportedCourses = makeDbTableMock()
  mockImportedVideos = makeDbTableMock()
  mockImportedPdfs = makeDbTableMock()
  mockNotes = makeDbTableMock()
  mockScreenshots = makeDbTableMock()
  mockCourseThumbnails = makeDbTableMock()
  mockEmbeddings = makeDbTableMock()
  mockVideoCaptions = makeDbTableMock()
  mockYoutubeTranscripts = makeDbTableMock()
  mockStudySessions = makeDbTableMock()
  mockContentProgress = makeDbTableMock()
  mockBookmarks = makeDbTableMock()
  mockFlashcards = makeDbTableMock()
  mockQuizzes = makeDbTableMock()
  mockQuizAttempts = makeDbTableMock()
  mockReviewRecords = makeDbTableMock()
})

describe('estimateTableSize', () => {
  it('returns 0 for an empty table', async () => {
    mockTable.mockReturnValue(createEmptyMockTable())

    const size = await estimateTableSize('notes')
    expect(size).toBe(0)
  })

  it('estimates size from sampled rows', async () => {
    const rows = [
      { id: '1', title: 'Note A', content: 'Hello world' },
      { id: '2', title: 'Note B', content: 'Another note' },
    ]
    const table = createMockTable(rows)
    // Override count to simulate a larger table
    table.count.mockResolvedValue(100)
    mockTable.mockReturnValue(table)

    const size = await estimateTableSize('notes')

    // Size should be avgRowBytes * 100
    const expectedAvg =
      rows.reduce((sum, r) => sum + new Blob([JSON.stringify(r)]).size, 0) / rows.length
    expect(size).toBe(Math.round(expectedAvg * 100))
  })

  it('returns 0 when the table query throws', async () => {
    mockTable.mockReturnValue(createFailingMockTable())

    const size = await estimateTableSize('notes')
    expect(size).toBe(0)
  })

  it('handles tables with fewer rows than sampleSize', async () => {
    const rows = [{ id: '1', text: 'only one' }]
    mockTable.mockReturnValue(createMockTable(rows))

    const size = await estimateTableSize('notes', 5)

    const expectedBytes = new Blob([JSON.stringify(rows[0])]).size
    expect(size).toBe(expectedBytes) // 1 row * avgSize of 1 row
  })

  it('uses custom sampleSize parameter', async () => {
    const rows = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const table = createMockTable(rows)
    table.count.mockResolvedValue(50)
    mockTable.mockReturnValue(table)

    await estimateTableSize('notes', 3)
    expect(table.limit).toHaveBeenCalledWith(3)
  })

  it('uses Blob.size for rows containing Blob fields', async () => {
    const blob = new Blob(['x'.repeat(500)])
    const rows = [{ id: '1', thumbnail: blob }]
    const table = createMockTable(rows)
    table.count.mockResolvedValue(10)
    mockTable.mockReturnValue(table)

    const size = await estimateTableSize('courseThumbnails')

    // Should use blob.size plus metadata for non-blob fields
    const metadataSize = new Blob([JSON.stringify({ id: '1' })]).size
    expect(size).toBe((blob.size + metadataSize) * 10)
  })

  it('sums all Blob fields plus metadata in the same row', async () => {
    const blob1 = new Blob(['x'.repeat(500)])
    const blob2 = new Blob(['y'.repeat(300)])
    const rows = [{ id: '1', thumbnail: blob1, screenshot: blob2 }]
    const table = createMockTable(rows)
    table.count.mockResolvedValue(10)
    mockTable.mockReturnValue(table)

    const size = await estimateTableSize('courseThumbnails')

    // Should sum both blobs + metadata for non-blob fields
    const metadataSize = new Blob([JSON.stringify({ id: '1' })]).size
    expect(size).toBe((blob1.size + blob2.size + metadataSize) * 10)
  })
})

describe('getStorageOverview', () => {
  it('returns full overview with all categories', async () => {
    mockGetStorageEstimate.mockResolvedValue({
      usage: 500_000_000,
      quota: 2_000_000_000,
      usagePercent: 0.25,
      usageMB: 500,
      quotaMB: 2000,
    })
    // All tables return some data
    mockTable.mockReturnValue(createMockTable([{ id: '1', data: 'test' }]))

    const overview = await getStorageOverview()

    expect(overview.apiAvailable).toBe(true)
    expect(overview.totalUsage).toBe(500_000_000)
    expect(overview.totalQuota).toBe(2_000_000_000)
    expect(overview.usagePercent).toBe(0.25)
    expect(overview.categories).toHaveLength(6)
    expect(overview.categorizedTotal).toBeGreaterThan(0)
  })

  it('returns apiAvailable: false when Storage API is unavailable', async () => {
    mockGetStorageEstimate.mockResolvedValue(null)
    mockTable.mockReturnValue(createEmptyMockTable())

    const overview = await getStorageOverview()

    expect(overview.apiAvailable).toBe(false)
    expect(overview.totalUsage).toBe(0)
    expect(overview.totalQuota).toBe(0)
    expect(overview.usagePercent).toBe(0)
    // Categories should still be attempted even without the API
    expect(overview.categories).toHaveLength(6)
  })

  it('handles partial table failures via Promise.allSettled', async () => {
    mockGetStorageEstimate.mockResolvedValue({
      usage: 100_000_000,
      quota: 1_000_000_000,
      usagePercent: 0.1,
      usageMB: 100,
      quotaMB: 1000,
    })

    // Some tables succeed, some fail
    let callCount = 0
    mockTable.mockImplementation(() => {
      callCount++
      if (callCount % 3 === 0) {
        return createFailingMockTable()
      }
      return createMockTable([{ id: '1', data: 'test' }])
    })

    const overview = await getStorageOverview()

    // Should still return all 6 categories (failed tables contribute 0 bytes)
    expect(overview.categories).toHaveLength(6)
    expect(overview.apiAvailable).toBe(true)
  })

  it('returns zero-sized categories when all tables are empty', async () => {
    mockGetStorageEstimate.mockResolvedValue({
      usage: 1000,
      quota: 1_000_000_000,
      usagePercent: 0,
      usageMB: 0,
      quotaMB: 1000,
    })
    mockTable.mockReturnValue(createEmptyMockTable())

    const overview = await getStorageOverview()

    expect(overview.categorizedTotal).toBe(0)
    for (const cat of overview.categories) {
      expect(cat.sizeBytes).toBe(0)
    }
  })

  it('clamps uncategorizedBytes to 0 when estimate exceeds total', async () => {
    // categorizedTotal might exceed totalUsage due to JSON estimation inaccuracy
    mockGetStorageEstimate.mockResolvedValue({
      usage: 100,
      quota: 1_000_000_000,
      usagePercent: 0,
      usageMB: 0,
      quotaMB: 1000,
    })
    // Large rows make categorizedTotal > totalUsage
    const bigRow = { id: '1', data: 'x'.repeat(1000) }
    const table = createMockTable([bigRow])
    table.count.mockResolvedValue(10)
    mockTable.mockReturnValue(table)

    const overview = await getStorageOverview()

    expect(overview.uncategorizedBytes).toBe(0)
  })

  it('produces correct category labels', async () => {
    mockGetStorageEstimate.mockResolvedValue({
      usage: 0,
      quota: 0,
      usagePercent: 0,
      usageMB: 0,
      quotaMB: 0,
    })
    mockTable.mockReturnValue(createEmptyMockTable())

    const overview = await getStorageOverview()

    const labels = overview.categories.map(c => c.label)
    expect(labels).toEqual([
      'Courses',
      'Notes',
      'Flashcards',
      'AI Search Data',
      'Thumbnails',
      'Transcripts',
    ])
  })
})

describe('getStorageOverview — edge cases', () => {
  it('clamps usagePercent to max 1.0 when usage exceeds quota', async () => {
    mockGetStorageEstimate.mockResolvedValue({
      usage: 1_500_000_000,
      quota: 1_000_000_000,
      usagePercent: 1.5,
      usageMB: 1500,
      quotaMB: 1000,
    })
    mockTable.mockReturnValue(createEmptyMockTable())

    const overview = await getStorageOverview()
    expect(overview.usagePercent).toBe(1)
  })

  it('returns usagePercent at exactly 0.8 boundary', async () => {
    mockGetStorageEstimate.mockResolvedValue({
      usage: 800_000_000,
      quota: 1_000_000_000,
      usagePercent: 0.8,
      usageMB: 800,
      quotaMB: 1000,
    })
    mockTable.mockReturnValue(createEmptyMockTable())

    const overview = await getStorageOverview()
    expect(overview.usagePercent).toBe(0.8)
    expect(overview.apiAvailable).toBe(true)
  })

  it('returns usagePercent at exactly 0.95 boundary', async () => {
    mockGetStorageEstimate.mockResolvedValue({
      usage: 950_000_000,
      quota: 1_000_000_000,
      usagePercent: 0.95,
      usageMB: 950,
      quotaMB: 1000,
    })
    mockTable.mockReturnValue(createEmptyMockTable())

    const overview = await getStorageOverview()
    expect(overview.usagePercent).toBe(0.95)
  })

  it('totalUsage and categorizedTotal can diverge', async () => {
    mockGetStorageEstimate.mockResolvedValue({
      usage: 500_000_000,
      quota: 2_000_000_000,
      usagePercent: 0.25,
      usageMB: 500,
      quotaMB: 2000,
    })
    // Small sampled rows will produce a categorizedTotal << totalUsage
    mockTable.mockReturnValue(createMockTable([{ id: '1', data: 'tiny' }]))

    const overview = await getStorageOverview()
    expect(overview.totalUsage).toBe(500_000_000)
    expect(overview.categorizedTotal).toBeLessThan(overview.totalUsage)
    expect(overview.uncategorizedBytes).toBeGreaterThan(0)
  })
})

describe('STORAGE_CATEGORIES', () => {
  it('contains all 6 categories in order', () => {
    expect(STORAGE_CATEGORIES).toEqual([
      'courses',
      'notes',
      'flashcards',
      'embeddings',
      'thumbnails',
      'transcripts',
    ])
  })
})

// ---------------------------------------------------------------------------
// getPerCourseUsage
// ---------------------------------------------------------------------------

describe('getPerCourseUsage', () => {
  it('returns empty array when no courses exist', async () => {
    mockImportedCourses.toArray.mockResolvedValue([])
    const result = await getPerCourseUsage()
    expect(result).toEqual([])
  })

  it('returns one entry per course sorted by totalBytes descending', async () => {
    mockImportedCourses.toArray.mockResolvedValue([
      { id: 'c1', name: 'Course A' },
      { id: 'c2', name: 'Course B' },
    ])
    // c1 has a larger video, c2 smaller
    mockImportedVideos.where.mockReturnThis()
    mockImportedVideos.equals.mockImplementation((id: string) => ({
      toArray: vi.fn().mockResolvedValue(id === 'c1' ? [{ id: 'v1', size: 'x'.repeat(1000) }] : []),
    }))
    mockImportedPdfs.where.mockReturnThis()
    mockImportedPdfs.equals.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
    mockNotes.where.mockReturnThis()
    mockNotes.equals.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
    mockScreenshots.where.mockReturnThis()
    mockScreenshots.equals.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
    mockCourseThumbnails.get.mockResolvedValue(undefined)

    const result = await getPerCourseUsage()

    expect(result).toHaveLength(2)
    // c1 should be first (larger)
    expect(result[0].courseId).toBe('c1')
    expect(result[1].courseId).toBe('c2')
    // Sizes should be non-negative
    expect(result[0].totalBytes).toBeGreaterThanOrEqual(0)
  })

  it('uses course.id as name fallback when name is undefined', async () => {
    mockImportedCourses.toArray.mockResolvedValue([{ id: 'c-no-name' }])
    mockImportedVideos.where.mockReturnThis()
    mockImportedVideos.equals.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
    mockImportedPdfs.where.mockReturnThis()
    mockImportedPdfs.equals.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
    mockNotes.where.mockReturnThis()
    mockNotes.equals.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
    mockScreenshots.where.mockReturnThis()
    mockScreenshots.equals.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
    mockCourseThumbnails.get.mockResolvedValue(undefined)

    const result = await getPerCourseUsage()
    expect(result[0].courseName).toBe('c-no-name')
  })

  it('returns empty array when db throws', async () => {
    mockImportedCourses.toArray.mockRejectedValue(new Error('DB error'))
    const result = await getPerCourseUsage()
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// clearCourseThumbnail
// ---------------------------------------------------------------------------

describe('clearCourseThumbnail', () => {
  it('returns 0 when no thumbnail exists', async () => {
    mockCourseThumbnails.get.mockResolvedValue(undefined)
    const freed = await clearCourseThumbnail('course-1')
    expect(freed).toBe(0)
  })

  it('returns estimated bytes and deletes the thumbnail', async () => {
    const blob = new Blob(['x'.repeat(500)])
    mockCourseThumbnails.get.mockResolvedValue({ id: 'course-1', image: blob })
    mockCourseThumbnails.delete = vi.fn().mockResolvedValue(undefined)

    const freed = await clearCourseThumbnail('course-1')

    expect(freed).toBeGreaterThan(0)
    expect(mockCourseThumbnails.delete).toHaveBeenCalledWith('course-1')
  })

  it('counts blob sizes toward freed bytes', async () => {
    const blob = new Blob(['x'.repeat(1000)])
    mockCourseThumbnails.get.mockResolvedValue({ id: 'c1', image: blob })
    mockCourseThumbnails.delete = vi.fn().mockResolvedValue(undefined)

    const freed = await clearCourseThumbnail('c1')
    // Should include at least blob.size
    expect(freed).toBeGreaterThanOrEqual(blob.size)
  })
})

// ---------------------------------------------------------------------------
// deleteCourseData
// ---------------------------------------------------------------------------

describe('deleteCourseData', () => {
  it('returns 0 for empty courseIds array', async () => {
    const freed = await deleteCourseData([])
    expect(freed).toBe(0)
  })

  it('runs transaction and deletes course-related data', async () => {
    // Set up notes mock to return a note so embeddings branch is exercised
    mockNotes.where.mockReturnThis()
    mockNotes.equals.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([{ id: 'n1', courseId: 'c1', content: 'hello' }]),
      delete: vi.fn().mockResolvedValue(undefined),
    })
    mockImportedVideos.where.mockReturnThis()
    mockImportedVideos.equals.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    })
    mockImportedPdfs.where.mockReturnThis()
    mockImportedPdfs.equals.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    })
    mockBookmarks.where.mockReturnThis()
    mockBookmarks.equals.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    })
    mockStudySessions.where.mockReturnThis()
    mockStudySessions.equals.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    })
    mockFlashcards.where.mockReturnThis()
    mockFlashcards.equals.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    })
    mockScreenshots.where.mockReturnThis()
    mockScreenshots.equals.mockReturnValue({ delete: vi.fn().mockResolvedValue(undefined) })
    mockEmbeddings.where.mockReturnThis()
    mockEmbeddings.equals.mockReturnValue({ delete: vi.fn().mockResolvedValue(undefined) })
    mockVideoCaptions.where.mockReturnThis()
    mockVideoCaptions.equals.mockReturnValue({ delete: vi.fn().mockResolvedValue(undefined) })
    mockYoutubeTranscripts.where.mockReturnThis()
    mockYoutubeTranscripts.equals.mockReturnValue({ delete: vi.fn().mockResolvedValue(undefined) })
    mockContentProgress.where.mockReturnThis()
    mockContentProgress.equals.mockReturnValue({ delete: vi.fn().mockResolvedValue(undefined) })
    mockQuizzes.where.mockReturnThis()
    mockQuizzes.above.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
    mockCourseThumbnails.delete = vi.fn().mockResolvedValue(undefined)
    mockImportedCourses.delete = vi.fn().mockResolvedValue(undefined)

    const freed = await deleteCourseData(['c1'])
    expect(freed).toBeGreaterThanOrEqual(0)
    // Transaction should have been called
    const { db } = await import('@/db')
    expect(db.transaction).toHaveBeenCalled()
  })
})
