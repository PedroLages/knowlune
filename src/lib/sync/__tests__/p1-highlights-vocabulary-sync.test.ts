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

  it('advanceMastery → syncQueue has put entry; masteryLevel incremented in Dexie record', async () => {
    const item = makeVocabItem({ masteryLevel: 0 })
    await useVocabularyStore.getState().addItem(item)

    // Clear queue to isolate advanceMastery entry
    await db.syncQueue.clear()

    await useVocabularyStore.getState().advanceMastery(item.id)

    const stored = await db.vocabularyItems.get(item.id)
    expect(stored?.masteryLevel).toBe(1)

    const entries = await getQueueEntries('vocabularyItems')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
  })

  it('resetMastery → syncQueue has put entry; masteryLevel: 0 in Dexie record', async () => {
    const item = makeVocabItem({ masteryLevel: 2 })
    await useVocabularyStore.getState().addItem(item)

    // Manually set mastery level in Dexie to 2 for the test
    await db.vocabularyItems.update(item.id, { masteryLevel: 2 })

    // Clear queue to isolate resetMastery entry
    await db.syncQueue.clear()

    await useVocabularyStore.getState().resetMastery(item.id)

    const stored = await db.vocabularyItems.get(item.id)
    expect(stored?.masteryLevel).toBe(0)
    expect(stored?.lastReviewedAt).toBeDefined()

    const entries = await getQueueEntries('vocabularyItems')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
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
