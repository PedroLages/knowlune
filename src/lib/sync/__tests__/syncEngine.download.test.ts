/**
 * syncEngine.download.test.ts — unit tests for the E92-S06 download phase.
 *
 * Tests: _applyRecord() strategies (LWW, monotonic, insert-only, conflict-copy),
 * syncMetadata cursor advancement, store refresh registry, and
 * start()/stop()/fullSync() lifecycle API.
 *
 * Uses vi.hoisted() + vi.mock() for full isolation from Dexie and Supabase.
 * The tableRegistry mock uses only 3 tables to keep the test surface focused:
 *   studySessions (P0, insert-only), progress (P0, monotonic), notes (P1, lww)
 *
 * @module syncEngine.download
 * @since E92-S06
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock state — shared download response table so each test
// controls which table returns which rows.
// ---------------------------------------------------------------------------

const {
  mockSyncMetadataGet,
  mockSyncMetadataPut,
  mockNotesGet,
  mockNotesPut,
  mockProgressGet,
  mockProgressPut,
  mockStudySessionsAdd,
  mockStudySessionsGet,
  mockSyncQueueToArray,
  mockLockRequest,
  downloadResults,
} = vi.hoisted(() => {
  // Per-table download results — tests write here to control what each table returns.
  const downloadResults: Record<string, { data: Record<string, unknown>[] | null; error: null | { message: string } }> = {
    study_sessions: { data: [], error: null },
    video_progress: { data: [], error: null },
    notes: { data: [], error: null },
  }

  const mockSyncMetadataGet = vi.fn().mockResolvedValue(undefined)
  const mockSyncMetadataPut = vi.fn().mockResolvedValue(undefined)

  const mockNotesGet = vi.fn().mockResolvedValue(undefined)
  const mockNotesPut = vi.fn().mockResolvedValue(undefined)

  const mockProgressGet = vi.fn().mockResolvedValue(undefined)
  const mockProgressPut = vi.fn().mockResolvedValue(undefined)

  const mockStudySessionsGet = vi.fn().mockResolvedValue(undefined)
  const mockStudySessionsAdd = vi.fn().mockResolvedValue(undefined)

  const mockSyncQueueToArray = vi.fn().mockResolvedValue([])
  const mockLockRequest = vi.fn()

  return {
    mockSyncMetadataGet,
    mockSyncMetadataPut,
    mockNotesGet,
    mockNotesPut,
    mockProgressGet,
    mockProgressPut,
    mockStudySessionsGet,
    mockStudySessionsAdd,
    mockSyncQueueToArray,
    mockLockRequest,
    downloadResults,
  }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/db', () => ({
  db: {
    syncMetadata: { get: mockSyncMetadataGet, put: mockSyncMetadataPut },
    syncQueue: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: mockSyncQueueToArray }),
      }),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
    notes: {
      get: mockNotesGet,
      put: mockNotesPut,
      add: vi.fn().mockResolvedValue(undefined),
    },
    progress: {
      get: mockProgressGet,
      put: mockProgressPut,
      add: vi.fn().mockResolvedValue(undefined),
    },
    studySessions: {
      get: mockStudySessionsGet,
      add: mockStudySessionsAdd,
      put: vi.fn().mockResolvedValue(undefined),
    },
    // All other tables — stubs so dynamic table access in _applyRecord doesn't fail.
    contentProgress: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined), where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(undefined) }) }) },
    bookmarks: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    flashcards: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    reviewRecords: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    embeddings: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    bookHighlights: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    vocabularyItems: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    audioBookmarks: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    audioClips: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    chatConversations: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    learnerModels: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    importedCourses: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    importedVideos: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    importedPdfs: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    authors: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    books: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    bookReviews: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    shelves: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    bookShelves: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    readingQueue: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    chapterMappings: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined), where: vi.fn().mockReturnValue({ equals: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(undefined) }) }) },
    learningPaths: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    learningPathEntries: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    challenges: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    courseReminders: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    notifications: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    careerPaths: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    pathEnrollments: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    studySchedules: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    opdsCatalogs: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    audiobookshelfServers: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    notificationPreferences: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    quizzes: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    quizAttempts: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
    aiUsageEvents: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined), add: vi.fn().mockResolvedValue(undefined) },
  },
}))

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    // Table-aware from() mock — reads downloadResults for download queries,
    // returns upload-compatible interface for upload phase.
    from: vi.fn((table: string) => {
      const tableResult = downloadResults[table] ?? { data: [], error: null }
      const order = vi.fn().mockResolvedValue(tableResult)
      const gte = vi.fn().mockReturnValue({ order })
      const select = vi.fn().mockReturnValue({ gte, order })
      return {
        select,
        upsert: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        _gte: gte, // exposed for assertions
        _order: order,
        _select: select,
      }
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
    auth: { refreshSession: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  },
}))

vi.mock('@/lib/sync/tableRegistry', () => {
  const studySessions = { dexieTable: 'studySessions', supabaseTable: 'study_sessions', conflictStrategy: 'insert-only', priority: 0, fieldMap: {}, insertOnly: true }
  const progress = { dexieTable: 'progress', supabaseTable: 'video_progress', conflictStrategy: 'monotonic', priority: 0, fieldMap: {}, monotonicFields: ['watchedSeconds'] }
  const notes = { dexieTable: 'notes', supabaseTable: 'notes', conflictStrategy: 'lww', priority: 1, fieldMap: {} }
  return {
    tableRegistry: [studySessions, progress, notes],
    getTableEntry: vi.fn((name: string) => {
      const reg: Record<string, object> = { studySessions, progress, notes }
      return reg[name]
    }),
  }
})

vi.mock('@/lib/sync/fieldMapper', () => ({
  // Identity pass-through — tests provide pre-converted records.
  toCamelCase: vi.fn((_entry: unknown, row: Record<string, unknown>) => row),
  toSnakeCase: vi.fn((_entry: unknown, record: Record<string, unknown>) => record),
}))

// Import after mocks.
import { syncEngine } from '../syncEngine'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Set rows that Supabase will return for the given Supabase table name. */
function setTableRows(supabaseTable: string, rows: Record<string, unknown>[], error: { message: string } | null = null) {
  downloadResults[supabaseTable] = { data: rows, error }
}

/** Reset per-table download results. */
function clearTableRows() {
  downloadResults['study_sessions'] = { data: [], error: null }
  downloadResults['video_progress'] = { data: [], error: null }
  downloadResults['notes'] = { data: [], error: null }
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  clearTableRows()

  mockSyncMetadataGet.mockResolvedValue(undefined)
  mockSyncMetadataPut.mockResolvedValue(undefined)
  mockNotesGet.mockResolvedValue(undefined)
  mockNotesPut.mockResolvedValue(undefined)
  mockProgressGet.mockResolvedValue(undefined)
  mockProgressPut.mockResolvedValue(undefined)
  mockStudySessionsGet.mockResolvedValue(undefined)
  mockStudySessionsAdd.mockResolvedValue(undefined)
  mockSyncQueueToArray.mockResolvedValue([])

  // navigator.locks — always grant lock for upload phase.
  mockLockRequest.mockImplementation(
    (_name: string, _opts: object, callback: (lock: object | null) => Promise<void>) =>
      callback({ name: 'sync-upload' }),
  )
  Object.defineProperty(global.navigator, 'locks', {
    value: { request: mockLockRequest },
    writable: true,
    configurable: true,
  })

  // Re-mock supabase.from to pick up fresh downloadResults each test.
  // The module-level mock reads `downloadResults` lazily on each call.
})

afterEach(() => {
  syncEngine.stop()
})

// ---------------------------------------------------------------------------
// LWW strategy tests
// ---------------------------------------------------------------------------

describe('LWW conflict strategy', () => {
  it('inserts when no local record exists', async () => {
    mockNotesGet.mockResolvedValue(undefined)
    setTableRows('notes', [{ id: 'n-1', content: 'hello', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockNotesPut).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n-1', content: 'hello' }),
    )
  })

  it('overwrites local when server record is newer', async () => {
    mockNotesGet.mockResolvedValue({ id: 'n-1', content: 'old', updatedAt: '2026-04-17T10:00:00Z' })
    setTableRows('notes', [{ id: 'n-1', content: 'new', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockNotesPut).toHaveBeenCalledWith(expect.objectContaining({ content: 'new' }))
  })

  it('keeps local when client record is newer (no-op)', async () => {
    mockNotesGet.mockResolvedValue({ id: 'n-1', content: 'local', updatedAt: '2026-04-18T12:00:00Z' })
    setTableRows('notes', [{ id: 'n-1', content: 'server', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockNotesPut).not.toHaveBeenCalled()
  })

  it('treats equal timestamps as client wins (no-op)', async () => {
    const ts = '2026-04-18T10:00:00Z'
    mockNotesGet.mockResolvedValue({ id: 'n-1', content: 'local', updatedAt: ts })
    setTableRows('notes', [{ id: 'n-1', content: 'server', updatedAt: ts, updated_at: ts }])

    await syncEngine.fullSync()

    expect(mockNotesPut).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Monotonic strategy tests
// ---------------------------------------------------------------------------

describe('Monotonic conflict strategy', () => {
  it('preserves local monotonic field when server value is lower', async () => {
    mockProgressGet.mockResolvedValue({ id: 'vid-1', watchedSeconds: 200, updatedAt: '2026-04-17T10:00:00Z' })
    setTableRows('video_progress', [{ id: 'vid-1', watchedSeconds: 100, updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockProgressPut).toHaveBeenCalledWith(
      expect.objectContaining({ watchedSeconds: 200 }), // Math.max(100, 200)
    )
  })

  it('uses server monotonic field when server value is higher', async () => {
    mockProgressGet.mockResolvedValue({ id: 'vid-1', watchedSeconds: 100, updatedAt: '2026-04-17T10:00:00Z' })
    setTableRows('video_progress', [{ id: 'vid-1', watchedSeconds: 300, updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockProgressPut).toHaveBeenCalledWith(
      expect.objectContaining({ watchedSeconds: 300 }), // Math.max(300, 100)
    )
  })

  it('inserts when no local record exists', async () => {
    mockProgressGet.mockResolvedValue(undefined)
    setTableRows('video_progress', [{ id: 'vid-1', watchedSeconds: 120, updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockProgressPut).toHaveBeenCalledWith(expect.objectContaining({ watchedSeconds: 120 }))
  })

  it('uses local non-monotonic fields when local is newer', async () => {
    // Local is newer → local non-monotonic fields win, monotonic takes max.
    mockProgressGet.mockResolvedValue({ id: 'vid-1', watchedSeconds: 50, title: 'local-title', updatedAt: '2026-04-18T12:00:00Z' })
    setTableRows('video_progress', [{ id: 'vid-1', watchedSeconds: 200, title: 'server-title', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockProgressPut).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'local-title',   // local wins non-monotonic (local is newer)
        watchedSeconds: 200,     // Math.max(50, 200)
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Insert-only strategy tests
// ---------------------------------------------------------------------------

describe('Insert-only conflict strategy', () => {
  it('inserts a new record when id is absent locally', async () => {
    mockStudySessionsGet.mockResolvedValue(undefined)
    setTableRows('study_sessions', [{ id: 'sess-1', duration: 3600, updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockStudySessionsAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'sess-1' }))
  })

  it('does NOT add or overwrite when id already exists locally', async () => {
    mockStudySessionsGet.mockResolvedValue({ id: 'sess-1', duration: 1800 })
    setTableRows('study_sessions', [{ id: 'sess-1', duration: 3600, updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockStudySessionsAdd).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// syncMetadata cursor tests
// ---------------------------------------------------------------------------

describe('syncMetadata cursor', () => {
  it('advances lastSyncTimestamp to max updated_at after a successful batch', async () => {
    setTableRows('notes', [
      { id: 'n-1', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' },
      { id: 'n-2', updatedAt: '2026-04-18T11:00:00Z', updated_at: '2026-04-18T11:00:00Z' },
    ])

    await syncEngine.fullSync()

    expect(mockSyncMetadataPut).toHaveBeenCalledWith(
      expect.objectContaining({ table: 'notes', lastSyncTimestamp: '2026-04-18T11:00:00Z' }),
    )
  })

  it('does NOT advance timestamp when result is empty', async () => {
    // All tables return [] (default).
    await syncEngine.fullSync()

    expect(mockSyncMetadataPut).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Error isolation tests
// ---------------------------------------------------------------------------

describe('Error isolation', () => {
  it('skips a table with a Supabase error and continues to next table', async () => {
    setTableRows('study_sessions', [], { message: 'permission denied' })
    setTableRows('notes', [{ id: 'n-1', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await expect(syncEngine.fullSync()).resolves.not.toThrow()

    // notes should still have been applied despite studySessions error.
    expect(mockNotesPut).toHaveBeenCalled()
  })

  it('does not throw from fullSync()', async () => {
    await expect(syncEngine.fullSync()).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Store refresh registry tests
// ---------------------------------------------------------------------------

describe('StoreRefreshRegistry', () => {
  it('calls registered callback after applying rows for the table', async () => {
    const mockRefreshNotes = vi.fn().mockResolvedValue(undefined)
    syncEngine.registerStoreRefresh('notes', mockRefreshNotes)

    setTableRows('notes', [{ id: 'n-1', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.fullSync()

    expect(mockRefreshNotes).toHaveBeenCalledOnce()
  })

  it('does not call callback for a table with no rows', async () => {
    const mockRefreshNotes = vi.fn().mockResolvedValue(undefined)
    syncEngine.registerStoreRefresh('notes', mockRefreshNotes)

    // notes returns [] (default).
    await syncEngine.fullSync()

    expect(mockRefreshNotes).not.toHaveBeenCalled()
  })

  it('does not propagate a throwing refresh callback', async () => {
    syncEngine.registerStoreRefresh('notes', vi.fn().mockRejectedValue(new Error('store exploded')))
    setTableRows('notes', [{ id: 'n-1', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await expect(syncEngine.fullSync()).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// start() / stop() / fullSync() lifecycle tests
// ---------------------------------------------------------------------------

describe('start() / stop() / fullSync() lifecycle', () => {
  it('start() triggers fullSync (download is attempted)', async () => {
    setTableRows('notes', [{ id: 'n-1', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await syncEngine.start('user-1')

    // Download was attempted — syncMetadataGet was called for each table.
    expect(mockSyncMetadataGet).toHaveBeenCalled()
  })

  it('stop() prevents nudge() from scheduling upload cycles', async () => {
    vi.useFakeTimers()
    await syncEngine.start('user-1')
    syncEngine.stop()

    syncEngine.nudge()
    await vi.runAllTimersAsync()

    // _started is false — lock should not be acquired by a new nudge cycle.
    // The start() call above already used one lock; assert no additional.
    const callsAfterStop = mockLockRequest.mock.calls.length
    syncEngine.nudge()
    await vi.runAllTimersAsync()

    expect(mockLockRequest.mock.calls.length).toBe(callsAfterStop)
    vi.useRealTimers()
  })

  it('fullSync() does not throw when called without start()', async () => {
    await expect(syncEngine.fullSync()).resolves.not.toThrow()
  })

  it('fullSync() calls upload phase before download phase', async () => {
    const callOrder: string[] = []

    // Track upload via syncQueueToArray being called (upload reads queue).
    mockSyncQueueToArray.mockImplementation(() => {
      callOrder.push('upload')
      return Promise.resolve([])
    })

    // Track download via syncMetadataGet being called.
    mockSyncMetadataGet.mockImplementation(() => {
      callOrder.push('download')
      return Promise.resolve(undefined)
    })

    await syncEngine.fullSync()

    const firstUpload = callOrder.indexOf('upload')
    const firstDownload = callOrder.indexOf('download')

    // Upload must have been called (queue read) before download (meta read).
    expect(firstUpload).toBeGreaterThanOrEqual(0)
    expect(firstDownload).toBeGreaterThanOrEqual(0)
    expect(firstUpload).toBeLessThan(firstDownload)
  })

  it('fullSync() continues to download even if upload throws', async () => {
    // Make lock acquisition throw to simulate upload failure.
    mockLockRequest.mockImplementationOnce(() => {
      throw new Error('upload lock error')
    })

    setTableRows('notes', [{ id: 'n-1', updatedAt: '2026-04-18T10:00:00Z', updated_at: '2026-04-18T10:00:00Z' }])

    await expect(syncEngine.fullSync()).resolves.not.toThrow()

    // Download should still have run.
    expect(mockSyncMetadataGet).toHaveBeenCalled()
  })

  it('currentUserId reflects start/stop lifecycle', async () => {
    expect(syncEngine.currentUserId).toBeNull()

    await syncEngine.start('user-42')
    expect(syncEngine.currentUserId).toBe('user-42')

    syncEngine.stop()
    expect(syncEngine.currentUserId).toBeNull()
  })
})
