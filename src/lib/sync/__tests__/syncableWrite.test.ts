/**
 * syncableWrite.test.ts — unit tests for the syncable write wrapper.
 *
 * Tests use vi.mock() to isolate the wrapper from real Dexie, real auth state,
 * and the syncEngine stub. This makes each test fast and deterministic.
 *
 * Note on vi.mock hoisting: vi.mock() factories are hoisted to the top of the
 * file. To share mock functions across the factory and test bodies, we use
 * vi.hoisted() which runs before the factory is called.
 *
 * @module syncableWrite
 * @since E92-S04
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock functions — must be declared with vi.hoisted() so they are
// available inside vi.mock() factories (which are hoisted to the top of file).
// ---------------------------------------------------------------------------
const { mockPut, mockAdd, mockDelete, mockSyncQueueAdd, mockGetState, mockNudge } = vi.hoisted(
  () => ({
    mockPut: vi.fn().mockResolvedValue(undefined),
    mockAdd: vi.fn().mockResolvedValue(undefined),
    mockDelete: vi.fn().mockResolvedValue(undefined),
    mockSyncQueueAdd: vi.fn().mockResolvedValue(1),
    mockGetState: vi.fn().mockReturnValue({ user: { id: 'user-123' } }),
    mockNudge: vi.fn(),
  })
)

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/db', () => ({
  db: {
    table: vi.fn().mockReturnValue({
      put: mockPut,
      add: mockAdd,
      delete: mockDelete,
    }),
    syncQueue: {
      add: mockSyncQueueAdd,
    },
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: { getState: mockGetState },
}))

vi.mock('../syncEngine', () => ({
  syncEngine: { nudge: mockNudge },
}))

// Import the module under test AFTER mocks are set up.
import { syncableWrite } from '../syncableWrite'
import { db } from '@/db'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setAuth(userId: string | null) {
  mockGetState.mockReturnValue({ user: userId ? { id: userId } : null })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncableWrite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default mock implementations after clearAllMocks resets return values.
    mockPut.mockResolvedValue(undefined)
    mockAdd.mockResolvedValue(undefined)
    mockDelete.mockResolvedValue(undefined)
    mockSyncQueueAdd.mockResolvedValue(1)
    setAuth('user-123')
    // Restore the db.table mock to return the standard spy object.
    vi.mocked(db.table).mockReturnValue({
      put: mockPut,
      add: mockAdd,
      delete: mockDelete,
    } as unknown as ReturnType<typeof db.table>)
  })

  // -------------------------------------------------------------------------
  // Happy path — put
  // -------------------------------------------------------------------------

  describe('authenticated put', () => {
    it('calls db.table().put() with the stamped record', async () => {
      const record = { id: 'rec-1', someField: 'value' }
      await syncableWrite('notes', 'put', record)

      expect(db.table).toHaveBeenCalledWith('notes')
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'rec-1',
          someField: 'value',
          userId: 'user-123',
          updatedAt: expect.any(String),
        })
      )
    })

    it('creates a syncQueue entry with correct fields', async () => {
      const record = { id: 'rec-1', someField: 'value' }
      await syncableWrite('notes', 'put', record)

      expect(mockSyncQueueAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'notes',
          recordId: 'rec-1',
          operation: 'put',
          attempts: 0,
          status: 'pending',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })
      )
    })

    it('calls syncEngine.nudge() after enqueueing', async () => {
      await syncableWrite('notes', 'put', { id: 'rec-1' })
      expect(mockNudge).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // Happy path — add
  // -------------------------------------------------------------------------

  describe('authenticated add', () => {
    it('calls db.table().add() with the stamped record', async () => {
      const record = { id: 'rec-2', field: 'x' }
      await syncableWrite('studySessions', 'add', record)

      expect(db.table).toHaveBeenCalledWith('studySessions')
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'rec-2',
          userId: 'user-123',
        })
      )
    })

    it('creates a syncQueue entry with operation: add', async () => {
      await syncableWrite('studySessions', 'add', { id: 'rec-2' })

      expect(mockSyncQueueAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'add',
          recordId: 'rec-2',
        })
      )
    })
  })

  // -------------------------------------------------------------------------
  // Happy path — delete
  // -------------------------------------------------------------------------

  describe('authenticated delete', () => {
    it('calls db.table().delete() with the string id', async () => {
      await syncableWrite('notes', 'delete', 'note-abc')

      expect(db.table).toHaveBeenCalledWith('notes')
      expect(mockDelete).toHaveBeenCalledWith('note-abc')
    })

    it('creates a syncQueue entry with payload { id } and operation: delete', async () => {
      await syncableWrite('notes', 'delete', 'note-abc')

      expect(mockSyncQueueAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'delete',
          recordId: 'note-abc',
          payload: { id: 'note-abc' },
        })
      )
    })

    it('calls syncEngine.nudge() after delete enqueue', async () => {
      await syncableWrite('notes', 'delete', 'note-abc')
      expect(mockNudge).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // Edge case — unauthenticated
  // -------------------------------------------------------------------------

  describe('unauthenticated write', () => {
    beforeEach(() => setAuth(null))

    it('still calls db.table().put() (Dexie write succeeds)', async () => {
      await syncableWrite('notes', 'put', { id: 'rec-3' })
      expect(mockPut).toHaveBeenCalledTimes(1)
    })

    it('does NOT create a syncQueue entry', async () => {
      await syncableWrite('notes', 'put', { id: 'rec-3' })
      expect(mockSyncQueueAdd).not.toHaveBeenCalled()
    })

    it('does NOT call syncEngine.nudge()', async () => {
      await syncableWrite('notes', 'put', { id: 'rec-3' })
      expect(mockNudge).not.toHaveBeenCalled()
    })

    it('does not throw', async () => {
      await expect(syncableWrite('notes', 'put', { id: 'rec-3' })).resolves.toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Edge case — skipQueue
  // -------------------------------------------------------------------------

  describe('skipQueue: true', () => {
    it('calls db.table().put() (Dexie write still happens)', async () => {
      await syncableWrite('notes', 'put', { id: 'rec-4' }, { skipQueue: true })
      expect(mockPut).toHaveBeenCalledTimes(1)
    })

    it('does NOT create a syncQueue entry', async () => {
      await syncableWrite('notes', 'put', { id: 'rec-4' }, { skipQueue: true })
      expect(mockSyncQueueAdd).not.toHaveBeenCalled()
    })

    it('does NOT call syncEngine.nudge()', async () => {
      await syncableWrite('notes', 'put', { id: 'rec-4' }, { skipQueue: true })
      expect(mockNudge).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Edge case — stripFields
  // -------------------------------------------------------------------------

  describe('stripFields applied to queue payload', () => {
    it('removes directoryHandle from importedCourses queue payload', async () => {
      const record = {
        id: 'course-1',
        name: 'My Course',
        directoryHandle: { kind: 'directory' } as unknown,
        coverImageHandle: {} as unknown,
      }
      await syncableWrite('importedCourses', 'put', record)

      const queueEntry = mockSyncQueueAdd.mock.calls[0][0] as { payload: Record<string, unknown> }
      expect(queueEntry.payload).not.toHaveProperty('directoryHandle')
      expect(queueEntry.payload).not.toHaveProperty('coverImageHandle')
      expect(queueEntry.payload).toHaveProperty('name')
    })

    it('removes fileHandle from importedVideos queue payload', async () => {
      const record = {
        id: 'vid-1',
        filename: 'video.mp4',
        fileHandle: {} as unknown,
      }
      await syncableWrite('importedVideos', 'put', record)

      const queueEntry = mockSyncQueueAdd.mock.calls[0][0] as { payload: Record<string, unknown> }
      expect(queueEntry.payload).not.toHaveProperty('fileHandle')
      expect(queueEntry.payload).toHaveProperty('filename')
    })
  })

  // -------------------------------------------------------------------------
  // Edge case — vaultFields
  // -------------------------------------------------------------------------

  describe('vaultFields excluded from queue payload', () => {
    it('removes password from opdsCatalogs queue payload', async () => {
      const record = {
        id: 'opds-1',
        url: 'https://example.com/opds',
        password: 's3cr3t',
      }
      await syncableWrite('opdsCatalogs', 'put', record)

      const queueEntry = mockSyncQueueAdd.mock.calls[0][0] as { payload: Record<string, unknown> }
      expect(queueEntry.payload).not.toHaveProperty('password')
      expect(queueEntry.payload).toHaveProperty('url')
    })

    it('removes apiKey from audiobookshelfServers queue payload', async () => {
      const record = {
        id: 'abs-1',
        url: 'https://abs.example.com',
        apiKey: 'secret-api-key',
      }
      await syncableWrite('audiobookshelfServers', 'put', record)

      const queueEntry = mockSyncQueueAdd.mock.calls[0][0] as { payload: Record<string, unknown> }
      expect(queueEntry.payload).not.toHaveProperty('apiKey')
      expect(queueEntry.payload).toHaveProperty('url')
    })
  })

  // -------------------------------------------------------------------------
  // Edge case — unknown table
  // -------------------------------------------------------------------------

  describe('unknown table', () => {
    it('throws a developer-friendly error for unregistered table names', async () => {
      await expect(syncableWrite('nonExistentTable', 'put', { id: 'x' })).rejects.toThrow(
        '[syncableWrite] Unknown table: "nonExistentTable"'
      )
    })

    it('does not call db.table() when the registry lookup fails', async () => {
      await expect(syncableWrite('nonExistentTable', 'put', { id: 'x' })).rejects.toThrow()
      expect(db.table).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Error path — empty / missing recordId (guard — E92-S05 follow-up)
  // -------------------------------------------------------------------------

  describe('empty recordId guard', () => {
    it('throws when put record has id: ""', async () => {
      await expect(syncableWrite('notes', 'put', { id: '' })).rejects.toThrow(
        '[syncableWrite] Empty recordId for table "notes" (operation "put")'
      )
    })

    it('throws when put record has id: "   " (whitespace)', async () => {
      await expect(syncableWrite('notes', 'put', { id: '   ' })).rejects.toThrow(
        '[syncableWrite] Empty recordId for table "notes" (operation "put")'
      )
    })

    it('throws when put record id is only a tab character', async () => {
      await expect(syncableWrite('notes', 'put', { id: '\t' })).rejects.toThrow(
        '[syncableWrite] Empty recordId for table "notes" (operation "put")'
      )
    })

    it('throws when put record id is only a non-breaking space (\\u00A0)', async () => {
      await expect(syncableWrite('notes', 'put', { id: '\u00a0' })).rejects.toThrow(
        '[syncableWrite] Empty recordId for table "notes" (operation "put")'
      )
    })

    it('throws when add record is missing id', async () => {
      await expect(syncableWrite('studySessions', 'add', { field: 'x' })).rejects.toThrow(
        '[syncableWrite] Empty recordId for table "studySessions" (operation "add")'
      )
    })

    it('throws when delete record is the empty string', async () => {
      await expect(syncableWrite('notes', 'delete', '')).rejects.toThrow(
        '[syncableWrite] Empty recordId for table "notes" (operation "delete")'
      )
    })

    it('does NOT touch Dexie or syncQueue when guard throws on put', async () => {
      await expect(syncableWrite('notes', 'put', { id: '' })).rejects.toThrow()
      expect(mockPut).not.toHaveBeenCalled()
      expect(mockSyncQueueAdd).not.toHaveBeenCalled()
    })

    it('does NOT touch Dexie or syncQueue when guard throws on delete', async () => {
      await expect(syncableWrite('notes', 'delete', '   ')).rejects.toThrow()
      expect(mockDelete).not.toHaveBeenCalled()
      expect(mockSyncQueueAdd).not.toHaveBeenCalled()
    })

    it('unauthenticated write with valid id still performs the Dexie write (guard does not block auth-skip path)', async () => {
      setAuth(null)
      await syncableWrite('notes', 'put', { id: 'ok' })
      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockSyncQueueAdd).not.toHaveBeenCalled()
    })

    // Compound-PK tables (e.g. contentProgress, audioCueAlignments) — guard
    // should derive recordId from the compound fields and accept the write.
    it('accepts compound-PK puts when all compound fields are present', async () => {
      await syncableWrite('contentProgress', 'put', {
        courseId: 'course-1',
        itemId: 'item-1',
        status: 'completed',
      })
      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockSyncQueueAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'contentProgress',
          recordId: 'course-1\u001fitem-1',
        })
      )
    })

    it('throws when a compound-PK field is missing', async () => {
      await expect(
        syncableWrite('contentProgress', 'put', {
          courseId: 'course-1',
          // itemId missing
          status: 'completed',
        })
      ).rejects.toThrow(
        '[syncableWrite] Empty recordId for table "contentProgress" (operation "put")'
      )
      expect(mockPut).not.toHaveBeenCalled()
    })

    it('throws when a compound-PK field is the empty string', async () => {
      await expect(
        syncableWrite('contentProgress', 'put', {
          courseId: '',
          itemId: 'item-1',
          status: 'completed',
        })
      ).rejects.toThrow(
        '[syncableWrite] Empty recordId for table "contentProgress" (operation "put")'
      )
    })

    // Compound-PK collision resistance: with the prior ':' delimiter, two
    // semantically distinct rows could synthesize the same recordId if any
    // field contained a ':'. The unit-separator delimiter (\u001f) cannot
    // appear in user-supplied IDs (URIs, slugs, UUIDs). (ADV-04 from R1.)
    it('does not collide on compound PK fields containing ":"', async () => {
      const writeA = syncableWrite('chapterMappings', 'put', {
        epubBookId: 'urn:isbn:123',
        audioBookId: 'abs-1',
      })
      const writeB = syncableWrite('chapterMappings', 'put', {
        epubBookId: 'urn',
        audioBookId: 'isbn:123:abs-1',
      })
      await Promise.all([writeA, writeB])
      const calls = mockSyncQueueAdd.mock.calls.map(c => (c[0] as { recordId: string }).recordId)
      expect(new Set(calls).size).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // Error path — Dexie write failure (fatal)
  // -------------------------------------------------------------------------

  describe('Dexie write failure', () => {
    it('propagates the error when db.table().put() throws', async () => {
      const dexieError = new Error('IndexedDB write failed')
      mockPut.mockRejectedValueOnce(dexieError)

      await expect(syncableWrite('notes', 'put', { id: 'rec-5' })).rejects.toThrow(
        'IndexedDB write failed'
      )
    })

    it('does NOT create a queue entry when Dexie write throws', async () => {
      mockPut.mockRejectedValueOnce(new Error('Dexie error'))

      await expect(syncableWrite('notes', 'put', { id: 'rec-5' })).rejects.toThrow()
      expect(mockSyncQueueAdd).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Error path — queue insert failure (non-fatal)
  // -------------------------------------------------------------------------

  describe('queue insert failure', () => {
    it('does NOT propagate the error when syncQueue.add() throws', async () => {
      mockSyncQueueAdd.mockRejectedValueOnce(new Error('Queue full'))

      await expect(syncableWrite('notes', 'put', { id: 'rec-6' })).resolves.toBeUndefined()
    })

    it('still completes the Dexie write before the queue failure', async () => {
      mockSyncQueueAdd.mockRejectedValueOnce(new Error('Queue full'))
      await syncableWrite('notes', 'put', { id: 'rec-6' })

      expect(mockPut).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // nudge() integration
  // -------------------------------------------------------------------------

  describe('nudge() integration', () => {
    it('calls nudge exactly once per authenticated write', async () => {
      await syncableWrite('notes', 'put', { id: 'a' })
      await syncableWrite('notes', 'put', { id: 'b' })
      expect(mockNudge).toHaveBeenCalledTimes(2)
    })

    it('does NOT call nudge when queue insert fails', async () => {
      // nudge is called from within the try block after syncQueue.add —
      // if add throws, the catch swallows and nudge is not reached.
      mockSyncQueueAdd.mockRejectedValueOnce(new Error('Queue full'))
      await syncableWrite('notes', 'put', { id: 'c' })
      expect(mockNudge).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Compound-PK table (chapterMappings) — E94-S06
  // -------------------------------------------------------------------------

  describe('compound-PK: chapterMappings', () => {
    it('synthesizes recordId from compound PK fields using unit separator', async () => {
      await syncableWrite('chapterMappings', 'put', {
        epubBookId: 'epub-1',
        audioBookId: 'audio-1',
        mappings: [],
        computedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '',
      })

      expect(mockSyncQueueAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'chapterMappings',
          recordId: 'epub-1\u001faudio-1',
          operation: 'put',
        })
      )
    })

    it('stamps userId on the Dexie write', async () => {
      await syncableWrite('chapterMappings', 'put', {
        epubBookId: 'epub-1',
        audioBookId: 'audio-1',
        mappings: [],
        computedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '',
      })

      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          epubBookId: 'epub-1',
          audioBookId: 'audio-1',
        })
      )
    })

    it('soft-delete path: put with deleted: true produces a put queue entry with payload.deleted === true', async () => {
      await syncableWrite('chapterMappings', 'put', {
        epubBookId: 'epub-1',
        audioBookId: 'audio-1',
        mappings: [],
        computedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '',
        deleted: true,
      })

      const call = mockSyncQueueAdd.mock.calls[0][0] as {
        operation: string
        payload: Record<string, unknown>
      }
      expect(call.operation).toBe('put')
      expect(call.payload.deleted).toBe(true)
      // db.table().put is called (not delete) — Dexie still persists the record
      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('unauthenticated: Dexie write succeeds, no queue entry', async () => {
      setAuth(null)

      await syncableWrite('chapterMappings', 'put', {
        epubBookId: 'epub-2',
        audioBookId: 'audio-2',
        mappings: [],
        computedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '',
      })

      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockSyncQueueAdd).not.toHaveBeenCalled()
    })
  })
})
