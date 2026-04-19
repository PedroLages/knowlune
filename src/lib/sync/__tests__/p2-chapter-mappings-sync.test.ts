/**
 * p2-chapter-mappings-sync.test.ts — E94-S06 integration tests for chapter
 * mappings sync wiring through syncableWrite.
 *
 * Verifies:
 *   - saveMapping routes through syncableWrite → Dexie + syncQueue.
 *   - deleteMapping is a soft-delete (syncQueue put with deleted: true).
 *   - loadMappings filters out soft-deleted records.
 *   - Unauthenticated writes skip the queue.
 *   - recordId uses unit-separator compound key.
 *   - fieldMap translates epubBookId/audioBookId to snake_case in queue payload.
 *
 * @module p2-chapter-mappings-sync
 * @since E94-S06
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { vi } from 'vitest'

let useChapterMappingStore: (typeof import('@/stores/useChapterMappingStore'))['useChapterMappingStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e94-s06'
const EPUB_BOOK_ID = 'epub-test-1'
const AUDIO_BOOK_ID = 'audio-test-1'
const UNIT_SEP = '\u001f'

const BASE_RECORD = {
  mappings: [{ epubChapterHref: 'c01.xhtml', audioChapterIndex: 0, confidence: 1.0 }],
  computedAt: '2026-04-20T00:00:00.000Z',
  updatedAt: '',
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
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 'p2-s06-test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const storeMod = await import('@/stores/useChapterMappingStore')
  useChapterMappingStore = storeMod.useChapterMappingStore

  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// saveMapping sync wiring
// ---------------------------------------------------------------------------

describe('E94-S06 chapterMappings sync wiring — saveMapping', () => {
  it('produces a syncQueue put entry with snake_case payload', async () => {
    await useChapterMappingStore.getState().saveMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID, BASE_RECORD)

    const stored = await db.chapterMappings.toArray()
    expect(stored).toHaveLength(1)
    expect((stored[0] as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('chapterMappings')
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.operation).toBe('put')
    expect(entry.status).toBe('pending')
    // recordId uses compound key with unit separator
    expect(entry.recordId).toBe(`${EPUB_BOOK_ID}${UNIT_SEP}${AUDIO_BOOK_ID}`)
    // payload uses snake_case field names from fieldMap
    expect(entry.payload.epub_book_id).toBe(EPUB_BOOK_ID)
    expect(entry.payload.audio_book_id).toBe(AUDIO_BOOK_ID)
    expect(entry.payload.computed_at).toBe(BASE_RECORD.computedAt)
  })

  it('updates existing mapping (idempotent put)', async () => {
    await useChapterMappingStore.getState().saveMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID, BASE_RECORD)
    await db.syncQueue.clear()

    const updatedRecord = { ...BASE_RECORD, mappings: [] }
    await useChapterMappingStore.getState().saveMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID, updatedRecord)

    const stored = await db.chapterMappings.toArray()
    expect(stored).toHaveLength(1) // still one record
    expect(stored[0].mappings).toEqual([])

    const entries = await getQueueEntries('chapterMappings')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('put')
  })

  it('unauthenticated save: Dexie write succeeds, syncQueue is empty', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    await useChapterMappingStore.getState().saveMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID, BASE_RECORD)

    const stored = await db.chapterMappings.toArray()
    expect(stored).toHaveLength(1) // Dexie write still happens

    const entries = await getQueueEntries('chapterMappings')
    expect(entries).toHaveLength(0) // no queue entry when unauthenticated
  })
})

// ---------------------------------------------------------------------------
// deleteMapping soft-delete sync wiring
// ---------------------------------------------------------------------------

describe('E94-S06 chapterMappings sync wiring — deleteMapping (soft-delete)', () => {
  it('produces a syncQueue put entry with deleted: true', async () => {
    // First save the mapping so it exists in-memory state.
    await useChapterMappingStore.getState().saveMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID, BASE_RECORD)
    await db.syncQueue.clear()

    await useChapterMappingStore.getState().deleteMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID)

    const entries = await getQueueEntries('chapterMappings')
    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.operation).toBe('put')
    expect(entry.payload.deleted).toBe(true)
    expect(entry.payload.epub_book_id).toBe(EPUB_BOOK_ID)
    expect(entry.payload.audio_book_id).toBe(AUDIO_BOOK_ID)
  })

  it('leaves a soft-deleted Dexie record (not a hard delete)', async () => {
    await useChapterMappingStore.getState().saveMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID, BASE_RECORD)

    await useChapterMappingStore.getState().deleteMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID)

    // Dexie still has the record — it's marked deleted, not removed.
    const stored = await db.chapterMappings.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0].deleted).toBe(true)
  })

  it('in-memory state removes the mapping immediately (optimistic UI)', async () => {
    await useChapterMappingStore.getState().saveMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID, BASE_RECORD)
    // Reset isLoaded so store reflects saved state.
    useChapterMappingStore.setState({ isLoaded: false })
    await useChapterMappingStore.getState().loadMappings()

    expect(useChapterMappingStore.getState().mappings).toHaveLength(1)

    await useChapterMappingStore.getState().deleteMapping(EPUB_BOOK_ID, AUDIO_BOOK_ID)

    expect(useChapterMappingStore.getState().mappings).toHaveLength(0)
  })

  it('deleteMapping on non-existent mapping is a no-op (no queue entry)', async () => {
    // No mappings in state — deleteMapping should do nothing.
    await useChapterMappingStore.getState().deleteMapping('nonexistent-epub', 'nonexistent-audio')

    const entries = await getQueueEntries('chapterMappings')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// loadMappings soft-delete filtering
// ---------------------------------------------------------------------------

describe('E94-S06 chapterMappings sync wiring — loadMappings filtering', () => {
  it('filters out soft-deleted records from in-memory state', async () => {
    // Directly write two records to Dexie: one live, one soft-deleted.
    await db.chapterMappings.put({
      epubBookId: 'epub-live',
      audioBookId: 'audio-live',
      mappings: [],
      computedAt: '2026-04-20T00:00:00Z',
      updatedAt: '2026-04-20T00:00:00Z',
      deleted: false,
    })
    await db.chapterMappings.put({
      epubBookId: 'epub-deleted',
      audioBookId: 'audio-deleted',
      mappings: [],
      computedAt: '2026-04-20T00:00:00Z',
      updatedAt: '2026-04-20T00:00:00Z',
      deleted: true,
    })

    await useChapterMappingStore.getState().loadMappings()

    const mappings = useChapterMappingStore.getState().mappings
    expect(mappings).toHaveLength(1)
    expect(mappings[0].epubBookId).toBe('epub-live')
  })

  it('returns all non-deleted records when none are soft-deleted', async () => {
    await db.chapterMappings.put({
      epubBookId: 'epub-a',
      audioBookId: 'audio-a',
      mappings: [],
      computedAt: '2026-04-20T00:00:00Z',
      updatedAt: '2026-04-20T00:00:00Z',
    })
    await db.chapterMappings.put({
      epubBookId: 'epub-b',
      audioBookId: 'audio-b',
      mappings: [],
      computedAt: '2026-04-20T00:00:00Z',
      updatedAt: '2026-04-20T00:00:00Z',
    })

    await useChapterMappingStore.getState().loadMappings()

    expect(useChapterMappingStore.getState().mappings).toHaveLength(2)
  })
})
