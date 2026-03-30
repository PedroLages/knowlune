import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (before imports) ---

const mockTable = vi.fn()

vi.mock('@/db', () => ({
  db: {
    table: (...args: unknown[]) => mockTable(...args),
  },
}))

const mockGetStorageEstimate = vi.fn()

vi.mock('@/lib/storageQuotaMonitor', () => ({
  getStorageEstimate: (...args: unknown[]) => mockGetStorageEstimate(...args),
}))

// --- Imports (after mocks) ---

import { estimateTableSize, getStorageOverview, STORAGE_CATEGORIES } from '@/lib/storageEstimate'

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
