import { describe, it, expect, vi } from 'vitest'

// Mock db before importing module
const mockClear = vi.fn().mockResolvedValue(undefined)
const mockBulkPut = vi.fn().mockResolvedValue(undefined)
const mockTable = vi.fn().mockReturnValue({ clear: mockClear, bulkPut: mockBulkPut })

vi.mock('@/db/schema', () => ({
  db: {
    transaction: vi
      .fn()
      .mockImplementation(async (_mode: string, _tables: unknown[], fn: () => Promise<void>) => {
        await fn()
      }),
    table: mockTable,
    importedCourses: { clear: mockClear },
    importedVideos: { clear: mockClear },
    importedPdfs: { clear: mockClear },
    progress: { clear: mockClear },
    bookmarks: { clear: mockClear },
    notes: { clear: mockClear },
    studySessions: { clear: mockClear },
    contentProgress: { clear: mockClear },
    challenges: { clear: mockClear },
    reviewRecords: { clear: mockClear },
    learningPath: { clear: mockClear },
    aiUsageEvents: { clear: mockClear },
  },
}))

const { importFullData } = await import('../importService')

describe('importService', () => {
  it('rejects invalid JSON', async () => {
    const result = await importFullData('not json at all')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid JSON')
  })

  it('rejects JSON without schemaVersion', async () => {
    const result = await importFullData(JSON.stringify({ data: {} }))
    expect(result.success).toBe(false)
    expect(result.error).toContain('schemaVersion')
  })

  it('rejects JSON without data field', async () => {
    const result = await importFullData(
      JSON.stringify({ schemaVersion: 14, exportedAt: '2026-01-01' })
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('data')
  })

  it('accepts valid export and returns record count', async () => {
    const validExport = {
      schemaVersion: 14,
      exportedAt: '2026-01-15T12:00:00Z',
      data: {
        settings: { 'app-settings': { displayName: 'Test' } },
        importedCourses: [],
        importedVideos: [],
        importedPdfs: [],
        progress: [],
        bookmarks: [],
        notes: [{ id: 'n1' }, { id: 'n2' }],
        studySessions: [{ id: 's1' }],
        contentProgress: [],
        challenges: [],
        reviewRecords: [],
        learningPath: [],
        aiUsageEvents: [],
      },
    }

    const result = await importFullData(JSON.stringify(validExport))

    expect(result.success).toBe(true)
    expect(result.recordCount).toBe(3) // 2 notes + 1 session
  })

  it('skips empty tables', async () => {
    mockBulkPut.mockClear()

    const validExport = {
      schemaVersion: 14,
      exportedAt: '2026-01-15T12:00:00Z',
      data: {
        settings: {},
        importedCourses: [],
        importedVideos: [],
        importedPdfs: [],
        progress: [],
        bookmarks: [],
        notes: [],
        studySessions: [],
        contentProgress: [],
        challenges: [],
        reviewRecords: [],
        learningPath: [],
        aiUsageEvents: [],
      },
    }

    const result = await importFullData(JSON.stringify(validExport))

    expect(result.success).toBe(true)
    expect(result.recordCount).toBe(0)
    // bulkPut should not be called for empty tables
    expect(mockBulkPut).not.toHaveBeenCalled()
  })
})
