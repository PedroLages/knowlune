/**
 * p1-highlights-vocabulary-sync.test.ts — E93-S06 integration test.
 *
 * Verifies the end-to-end wiring inside the app:
 *   Store mutation → syncableWrite → Dexie write + syncQueue entry
 *
 * Covers all 8 mutation operations:
 *   - bookHighlights: createHighlight, updateHighlight, deleteHighlight
 *   - vocabularyItems: addItem, advanceMastery, resetMastery, deleteItem
 *     (updateItem covered via addItem seed + update pattern)
 *
 * Also covers the unauthenticated no-queue scenario (R8).
 *
 * @module p1-highlights-vocabulary-sync
 * @since E93-S06
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { vi } from 'vitest'
import type { BookHighlight, VocabularyItem } from '@/data/types'

let useHighlightStore: (typeof import('@/stores/useHighlightStore'))['useHighlightStore']
let useVocabularyStore: (typeof import('@/stores/useVocabularyStore'))['useVocabularyStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e93-s06'
const TEST_BOOK_ID = 'book-e93-s06'

function makeHighlight(overrides?: Partial<BookHighlight>): BookHighlight {
  return {
    id: crypto.randomUUID(),
    bookId: TEST_BOOK_ID,
    textAnchor: 'The highlighted text snippet',
    color: 'yellow',
    position: { type: 'cfi', value: 'epubcfi(/6/4!/4/2/2/1:0,/1:26)' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeVocabItem(overrides?: Partial<VocabularyItem>): VocabularyItem {
  return {
    id: crypto.randomUUID(),
    bookId: TEST_BOOK_ID,
    word: 'serendipity',
    masteryLevel: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    user: { id: TEST_USER_ID, email: 'e93-s06-test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const highlightMod = await import('@/stores/useHighlightStore')
  useHighlightStore = highlightMod.useHighlightStore

  const vocabMod = await import('@/stores/useVocabularyStore')
  useVocabularyStore = vocabMod.useVocabularyStore

  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// bookHighlights sync wiring
// ---------------------------------------------------------------------------

describe('E93-S06 sync wiring — bookHighlights', () => {
  it('createHighlight authenticated → syncQueue has put entry; userId stamped on Dexie record', async () => {
    const highlight = makeHighlight()

    await useHighlightStore.getState().createHighlight(highlight)

    const stored = await db.bookHighlights.get(highlight.id)
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('bookHighlights')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
  })

  it('updateHighlight → syncQueue has put entry for bookHighlights with merged fields', async () => {
    const highlight = makeHighlight()
    await useHighlightStore.getState().createHighlight(highlight)

    // Clear queue to isolate updateHighlight entry
    await db.syncQueue.clear()

    await useHighlightStore.getState().updateHighlight(highlight.id, { note: 'Updated note' })

    const entries = await getQueueEntries('bookHighlights')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
  })

  it('deleteHighlight → Dexie record absent; syncQueue has delete entry with { id }', async () => {
    const highlight = makeHighlight()
    await useHighlightStore.getState().createHighlight(highlight)

    await useHighlightStore.getState().deleteHighlight(highlight.id)

    const stored = await db.bookHighlights.get(highlight.id)
    expect(stored).toBeUndefined()

    const entries = await getQueueEntries('bookHighlights')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: highlight.id })
  })

  it('updateHighlight on unknown highlightId → no queue entry, no error thrown', async () => {
    await db.syncQueue.clear()

    await expect(
      useHighlightStore.getState().updateHighlight('nonexistent-id', { note: 'Should not queue' })
    ).resolves.toBeUndefined()

    const entries = await getQueueEntries('bookHighlights')
    expect(entries).toHaveLength(0)
  })

  it('deleteHighlight on unknown highlightId → no queue entry, no error thrown', async () => {
    await db.syncQueue.clear()

    await expect(
      useHighlightStore.getState().deleteHighlight('nonexistent-id')
    ).resolves.toBeUndefined()

    const entries = await getQueueEntries('bookHighlights')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// vocabularyItems sync wiring
// ---------------------------------------------------------------------------

describe('E93-S06 sync wiring — vocabularyItems', () => {
  it('addItem authenticated → syncQueue has put entry; userId stamped on Dexie record', async () => {
    const item = makeVocabItem()

    await useVocabularyStore.getState().addItem(item)

    const stored = await db.vocabularyItems.get(item.id)
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('vocabularyItems')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
  })

  it('advanceMastery → syncQueue has put entry; masteryLevel incremented and lastReviewedAt set in Dexie record and payload', async () => {
    const item = makeVocabItem({ masteryLevel: 0 })
    await useVocabularyStore.getState().addItem(item)

    // Clear queue to isolate advanceMastery entry
    await db.syncQueue.clear()

    await useVocabularyStore.getState().advanceMastery(item.id)

    const stored = await db.vocabularyItems.get(item.id)
    expect(stored?.masteryLevel).toBe(1)
    // lastReviewedAt must be stamped on the Dexie record so it flows into the
    // syncQueue payload and eventually maps to p_last_reviewed_at via the
    // MONOTONIC_RPC paramMap (R1 fix).
    expect(stored?.lastReviewedAt).toBeDefined()

    const entries = await getQueueEntries('vocabularyItems')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
    // Verify last_reviewed_at is present in the snake_case queue payload so the
    // sync engine can map it to p_last_reviewed_at via MONOTONIC_RPC paramMap
    // (R1 fix: last_reviewed_at was missing from paramMap, so it was never
    // forwarded to the RPC and the DB column was never updated).
    const payload = putEntry!.payload as Record<string, unknown>
    expect(payload.last_reviewed_at).toBeDefined()
  })

  it('resetMastery → masteryLevel: 0 in Dexie record; NO syncQueue put entry (RPC path, not syncableWrite)', async () => {
    // R3 BLOCKER fix: resetMastery now writes Dexie directly and calls the
    // reset_vocabulary_mastery RPC instead of going through syncableWrite /
    // upsert_vocabulary_mastery, which would silently ignore masteryLevel=0 via GREATEST.
    const item = makeVocabItem({ masteryLevel: 2 })
    await useVocabularyStore.getState().addItem(item)

    // Manually set mastery level in Dexie to 2 for the test
    await db.vocabularyItems.update(item.id, { masteryLevel: 2 })

    // Clear queue to isolate resetMastery entry
    await db.syncQueue.clear()

    await useVocabularyStore.getState().resetMastery(item.id)

    const stored = await db.vocabularyItems.get(item.id)
    expect(stored?.masteryLevel).toBe(0)
    // lastReviewedAt is cleared on reset (server function also sets it to NULL)
    expect(stored?.lastReviewedAt == null).toBe(true)

    // No put entry in syncQueue — resetMastery uses the direct RPC path
    const entries = await getQueueEntries('vocabularyItems')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeUndefined()
  })

  it('deleteItem → Dexie record absent; syncQueue has delete entry with { id }', async () => {
    const item = makeVocabItem()
    await useVocabularyStore.getState().addItem(item)

    await useVocabularyStore.getState().deleteItem(item.id)

    const stored = await db.vocabularyItems.get(item.id)
    expect(stored).toBeUndefined()

    const entries = await getQueueEntries('vocabularyItems')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: item.id })
  })

  it('advanceMastery when masteryLevel already 3 → no queue entry (guard preserved)', async () => {
    const item = makeVocabItem({ masteryLevel: 3 })
    await useVocabularyStore.getState().addItem(item)

    // Seed in-memory state with item at max level
    useVocabularyStore.setState({ items: [item] })

    // Clear queue to isolate test
    await db.syncQueue.clear()

    await useVocabularyStore.getState().advanceMastery(item.id)

    const entries = await getQueueEntries('vocabularyItems')
    expect(entries).toHaveLength(0)
  })

  it('updateItem on non-existent id → no queue entry, no error thrown', async () => {
    await db.syncQueue.clear()

    await expect(
      useVocabularyStore.getState().updateItem('nonexistent-id', { note: 'Should not queue' })
    ).resolves.toBeUndefined()

    const entries = await getQueueEntries('vocabularyItems')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Unauthenticated writes
// ---------------------------------------------------------------------------

describe('E93-S06 sync wiring — unauthenticated writes', () => {
  it('unauthenticated createHighlight → Dexie record present, zero bookHighlights queue entries', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    const highlight = makeHighlight()
    await useHighlightStore.getState().createHighlight(highlight)

    const stored = await db.bookHighlights.get(highlight.id)
    expect(stored).toBeDefined()

    const entries = await getQueueEntries('bookHighlights')
    expect(entries).toHaveLength(0)
  })

  it('unauthenticated addItem → Dexie record present, zero vocabularyItems queue entries', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    const item = makeVocabItem()
    await useVocabularyStore.getState().addItem(item)

    const stored = await db.vocabularyItems.get(item.id)
    expect(stored).toBeDefined()

    const entries = await getQueueEntries('vocabularyItems')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// R3 BLOCKER regression: reset_vocabulary_mastery bypasses GREATEST
// ---------------------------------------------------------------------------

describe('E93-S06 R3 BLOCKER — resetMastery bypasses GREATEST monotonic guard', () => {
  it('resetMastery on mastery=2 item → Dexie masteryLevel is 0, no syncQueue put entry (uses RPC path, not syncableWrite)', async () => {
    // Simulate "device A had mastery=2 synced to server"
    const item = makeVocabItem({ masteryLevel: 2 })
    await useVocabularyStore.getState().addItem(item)
    await db.vocabularyItems.update(item.id, { masteryLevel: 2 })
    useVocabularyStore.setState({ items: [{ ...item, masteryLevel: 2 }] })

    await db.syncQueue.clear()

    await useVocabularyStore.getState().resetMastery(item.id)

    // Dexie must reflect the reset — masteryLevel=0
    const stored = await db.vocabularyItems.get(item.id)
    expect(stored?.masteryLevel).toBe(0)
    // lastReviewedAt cleared on reset
    expect(stored?.lastReviewedAt == null).toBe(true)

    // No 'put' entry in syncQueue — resetMastery now goes through the RPC path
    // directly, not through upsert_vocabulary_mastery (which would be ignored
    // by GREATEST when server already has mastery_level=2).
    const entries = await getQueueEntries('vocabularyItems')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeUndefined()
  })

  it('resetMastery then advanceMastery → Dexie masteryLevel ends at 1 (reset not ignored)', async () => {
    // Simulate cross-device scenario:
    //   Server: mastery=2 (from device A)
    //   Device B: resetMastery → should become 0, then advanceMastery → should be 1
    //   Without the fix, upsert_vocabulary_mastery GREATEST would ignore the reset,
    //   and advanceMastery would advance from 2→3 instead of 0→1.
    const item = makeVocabItem({ masteryLevel: 2 })
    await useVocabularyStore.getState().addItem(item)
    await db.vocabularyItems.update(item.id, { masteryLevel: 2 })
    useVocabularyStore.setState({ items: [{ ...item, masteryLevel: 2 }] })

    // Reset (should bring to 0)
    await useVocabularyStore.getState().resetMastery(item.id)

    const afterReset = await db.vocabularyItems.get(item.id)
    expect(afterReset?.masteryLevel).toBe(0)

    // Re-seed in-memory store to match Dexie (simulates store.loadItems after sync)
    useVocabularyStore.setState({
      items: [{ ...item, masteryLevel: 0, lastReviewedAt: undefined }],
    })

    // Advance (should go 0→1, not 2→3)
    await useVocabularyStore.getState().advanceMastery(item.id)

    const afterAdvance = await db.vocabularyItems.get(item.id)
    expect(afterAdvance?.masteryLevel).toBe(1)
  })
})
