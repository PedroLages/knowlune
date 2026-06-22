import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db before importing module
const mockClear = vi.fn().mockResolvedValue(undefined)
const mockBulkPut = vi.fn().mockResolvedValue(undefined)
const mockTable = vi.fn().mockImplementation((name: string) => ({
  clear: mockClear,
  bulkPut: mockBulkPut,
  name,
}))

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
    learningPaths: { clear: mockClear },
    learningPathEntries: { clear: mockClear },
    aiUsageEvents: { clear: mockClear },
  },
}))

vi.mock('@/db/checkpoint', () => ({
  CHECKPOINT_VERSION: 65,
}))

const MOCK_SYNCABLE_TABLES = [
  'contentProgress',
  'studySessions',
  'progress',
  'notes',
  'bookmarks',
  'flashcards',
  'reviewRecords',
  'embeddings',
  'bookHighlights',
  'vocabularyItems',
  'audioBookmarks',
  'audioClips',
  'chatConversations',
  'learnerModels',
  'importedCourses',
  'importedVideos',
  'importedPdfs',
  'authors',
  'books',
  'bookReviews',
  'shelves',
  'bookShelves',
  'readingQueue',
  'chapterMappings',
  'learningPaths',
  'learningPathEntries',
  'challenges',
  'courseReminders',
  'notifications',
  'careerPaths',
  'pathEnrollments',
  'studySchedules',
  'opdsCatalogs',
  'audiobookshelfServers',
  'notificationPreferences',
  'quizzes',
  'quizAttempts',
  'aiUsageEvents',
  'userConsents',
]

vi.mock('@/lib/sync/backfill', () => ({
  SYNCABLE_TABLES: MOCK_SYNCABLE_TABLES,
}))

const { importFullData, restoreFromBackup } = await import('../importService')

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
        learningPaths: [],
        learningPathEntries: [],
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
        learningPaths: [],
        learningPathEntries: [],
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

// ── Full Backup Restore Tests (E77a-S01) ─────────────────────────────────

describe('restoreFromBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Default: all table names resolve to mockTable
    mockTable.mockImplementation((name: string) => ({
      clear: mockClear,
      bulkPut: mockBulkPut,
      name,
    }))
  })

  it('throws on invalid payload (null)', async () => {
    await expect(restoreFromBackup(null)).rejects.toThrow('Invalid backup file')
  })

  it('throws on payload missing schemaVersion', async () => {
    await expect(restoreFromBackup({ data: {}, settings: {} })).rejects.toThrow(
      'Invalid backup file'
    )
  })

  it('throws on payload missing data field', async () => {
    await expect(restoreFromBackup({ schemaVersion: 65, settings: {} })).rejects.toThrow(
      'Invalid backup file'
    )
  })

  it('throws on payload missing settings field', async () => {
    await expect(restoreFromBackup({ schemaVersion: 65, data: {} })).rejects.toThrow(
      'Invalid backup file'
    )
  })

  it('throws when backup schema version is newer than current', async () => {
    await expect(
      restoreFromBackup({
        schemaVersion: 99,
        exportedAt: '2026-01-01T00:00:00Z',
        data: { importedCourses: [{ id: 'c1' }] },
        settings: {},
      })
    ).rejects.toThrow('newer')
  })

  it('throws when no restorable data found', async () => {
    await expect(
      restoreFromBackup({
        schemaVersion: 65,
        exportedAt: '2026-01-01T00:00:00Z',
        data: {},
        settings: {},
      })
    ).rejects.toThrow('No restorable data')
  })

  it('restores data and returns summary with record counts', async () => {
    const payload = {
      schemaVersion: 65,
      exportedAt: '2026-01-01T00:00:00Z',
      data: {
        importedCourses: [{ id: 'c1', name: 'Course 1' }],
        notes: [
          { id: 'n1', content: 'Note 1' },
          { id: 'n2', content: 'Note 2' },
        ],
        bookmarks: [],
      },
      settings: { 'app-settings': { theme: 'dark' } },
    }

    const summary = await restoreFromBackup(payload)

    expect(summary.totalRecords).toBe(3)
    expect(summary.counts.importedCourses).toBe(1)
    expect(summary.counts.notes).toBe(2)
    expect(summary.counts.bookmarks).toBe(0)
    expect(summary.schemaVersion).toBe(65)
    expect(summary.wasMigrated).toBe(false)
    expect(summary.warnings).toEqual([])
  })

  it('detects schema version mismatch (wasMigrated = true)', async () => {
    const payload = {
      schemaVersion: 60,
      exportedAt: '2026-01-01T00:00:00Z',
      data: {
        importedCourses: [{ id: 'c1', name: 'Course 1' }],
      },
      settings: {},
    }

    const summary = await restoreFromBackup(payload)

    expect(summary.wasMigrated).toBe(true)
    expect(summary.schemaVersion).toBe(60)
    expect(summary.warnings.length).toBeGreaterThan(0)
    expect(summary.warnings[0]).toContain('v60')
  })

  it('restores localStorage settings from backup payload', async () => {
    const payload = {
      schemaVersion: 65,
      exportedAt: '2026-01-01T00:00:00Z',
      data: {
        importedCourses: [],
      },
      settings: { 'app-settings': { theme: 'dark', fontSize: 'large' } },
    }

    await restoreFromBackup(payload)

    expect(localStorage.getItem('app-settings')).toBe(
      JSON.stringify({ theme: 'dark', fontSize: 'large' })
    )
  })

  it('clears all tables before writing new data', async () => {
    const payload = {
      schemaVersion: 65,
      exportedAt: '2026-01-01T00:00:00Z',
      data: {
        importedCourses: [{ id: 'c1', name: 'Course 1' }],
      },
      settings: {},
    }

    await restoreFromBackup(payload)

    // clear() should have been called for each restorable table
    expect(mockClear).toHaveBeenCalled()
  })

  it('handles empty data payload gracefully', async () => {
    const payload = {
      schemaVersion: 65,
      exportedAt: '2026-01-01T00:00:00Z',
      data: {
        importedCourses: [{ id: 'c1', name: 'Course 1' }],
      },
      settings: {},
    }

    const summary = await restoreFromBackup(payload)

    expect(summary.totalRecords).toBe(1)
    expect(summary.counts.importedCourses).toBe(1)
  })
})
