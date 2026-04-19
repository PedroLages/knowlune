/**
 * p1-audio-bookmarks-clips-sync.test.ts — E93-S07 integration test.
 *
 * Verifies the end-to-end wiring inside the app:
 *   Store mutation / syncableWrite call → Dexie write + syncQueue entry
 *
 * Covers:
 *   - audioBookmarks: syncableWrite add (INSERT path)
 *   - audioBookmarks: stripFields — updated_at absent from queue payload
 *   - audioClips: addClip, updateClipTitle, deleteClip (via useAudioClipStore)
 *   - Unauthenticated: Dexie write present, zero queue entries
 *
 * @module p1-audio-bookmarks-clips-sync
 * @since E93-S07
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { vi } from 'vitest'
import type { AudioBookmark, AudioClip } from '@/data/types'

let useAudioClipStore: (typeof import('@/stores/useAudioClipStore'))['useAudioClipStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let syncableWrite: (typeof import('@/lib/sync/syncableWrite'))['syncableWrite']
let db: (typeof import('@/db'))['db']

// Used for the `as unknown as SyncableRecord` cast pattern (see useHighlightStore)
type SyncableRecord = import('@/lib/sync/syncableWrite').SyncableRecord

const TEST_USER_ID = 'user-e93-s07'
const TEST_BOOK_ID = 'book-e93-s07'

function makeAudioBookmark(overrides?: Partial<AudioBookmark>): AudioBookmark {
  return {
    id: crypto.randomUUID(),
    bookId: TEST_BOOK_ID,
    chapterIndex: 0,
    timestamp: 42,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeAudioClip(overrides?: Partial<AudioClip>): Omit<AudioClip, 'id' | 'sortOrder' | 'createdAt'> {
  return {
    bookId: TEST_BOOK_ID,
    chapterId: 'chapter-1',
    chapterIndex: 0,
    startTime: 10,
    endTime: 30,
    title: 'Test Clip',
    ...overrides,
  }
}

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  // Seed a signed-in user so syncableWrite enqueues upload entries.
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 'e93-s07-test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const clipMod = await import('@/stores/useAudioClipStore')
  useAudioClipStore = clipMod.useAudioClipStore

  const syncMod = await import('@/lib/sync/syncableWrite')
  syncableWrite = syncMod.syncableWrite

  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// audioBookmarks sync wiring
// ---------------------------------------------------------------------------

describe('E93-S07 sync wiring — audioBookmarks', () => {
  it('syncableWrite add authenticated → Dexie record present; syncQueue has add entry with status pending', async () => {
    const bookmark = makeAudioBookmark()

    await syncableWrite('audioBookmarks', 'add', bookmark as unknown as SyncableRecord)

    const stored = await db.audioBookmarks.get(bookmark.id)
    expect(stored).toBeDefined()

    const entries = await getQueueEntries('audioBookmarks')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const addEntry = entries.find(e => e.operation === 'add')
    expect(addEntry).toBeDefined()
    expect(addEntry!.status).toBe('pending')
  })

  it('syncQueue payload for audioBookmarks add does NOT contain updated_at key (stripFields)', async () => {
    const bookmark = makeAudioBookmark()

    await syncableWrite('audioBookmarks', 'add', bookmark as unknown as SyncableRecord)

    const entries = await getQueueEntries('audioBookmarks')
    const addEntry = entries.find(e => e.operation === 'add')
    expect(addEntry).toBeDefined()

    const payload = addEntry!.payload as Record<string, unknown>
    // stripFields: ['updatedAt'] must strip the spurious stamp from the payload
    expect(payload).not.toHaveProperty('updated_at')
    // created_at must still be present (it's the cursor column)
    expect(payload).toHaveProperty('created_at')
  })

  it('unauthenticated syncableWrite add → Dexie record present, zero audioBookmarks queue entries', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    const bookmark = makeAudioBookmark()
    await syncableWrite('audioBookmarks', 'add', bookmark as unknown as SyncableRecord)

    const stored = await db.audioBookmarks.get(bookmark.id)
    expect(stored).toBeDefined()

    const entries = await getQueueEntries('audioBookmarks')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// audioClips sync wiring
// ---------------------------------------------------------------------------

describe('E93-S07 sync wiring — audioClips', () => {
  it('addClip authenticated → syncQueue has put entry with status pending', async () => {
    await useAudioClipStore.getState().addClip(makeAudioClip())

    const entries = await getQueueEntries('audioClips')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
  })

  it('updateClipTitle authenticated → syncQueue has put entry; payload contains updated title', async () => {
    // Seed a clip
    const clipId = await useAudioClipStore.getState().addClip(makeAudioClip({ title: 'Original Title' }))

    // Clear queue to isolate updateClipTitle entry
    await db.syncQueue.clear()

    await useAudioClipStore.getState().updateClipTitle(clipId, 'Updated Title')

    const entries = await getQueueEntries('audioClips')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
    const payload = putEntry!.payload as Record<string, unknown>
    expect(payload.title).toBe('Updated Title')
  })

  it('deleteClip authenticated → Dexie record absent; syncQueue has delete entry with { id }', async () => {
    const clipId = await useAudioClipStore.getState().addClip(makeAudioClip())

    // Clear queue to isolate deleteClip entry
    await db.syncQueue.clear()

    await useAudioClipStore.getState().deleteClip(clipId)

    const stored = await db.audioClips.get(clipId)
    expect(stored).toBeUndefined()

    const entries = await getQueueEntries('audioClips')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: clipId })
  })

  it('updateClipTitle on non-existent clipId → no queue entry, no error thrown', async () => {
    await db.syncQueue.clear()

    await expect(
      useAudioClipStore.getState().updateClipTitle('nonexistent-clip-id', 'Should not queue')
    ).resolves.toBeUndefined()

    const entries = await getQueueEntries('audioClips')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Unauthenticated writes
// ---------------------------------------------------------------------------

describe('E93-S07 sync wiring — unauthenticated writes', () => {
  it('unauthenticated addClip → Dexie record present, zero audioClips queue entries', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    const clipId = await useAudioClipStore.getState().addClip(makeAudioClip())

    const stored = await db.audioClips.get(clipId)
    expect(stored).toBeDefined()

    const entries = await getQueueEntries('audioClips')
    expect(entries).toHaveLength(0)
  })
})
