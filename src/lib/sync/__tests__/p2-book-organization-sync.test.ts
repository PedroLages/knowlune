/**
 * p2-book-organization-sync.test.ts — E94-S03 integration tests for P2 book
 * organization sync wiring: bookReviews, shelves, bookShelves, readingQueue.
 *
 * Verifies:
 *   - Store mutations → syncableWrite → Dexie + syncQueue entries.
 *   - readingQueue.fieldMap translates sortOrder → position in queue payload.
 *   - Unauthenticated writes skip the queue (syncableWrite contract).
 *   - dedupDefaultShelves pure function partitioning + id map construction.
 *   - bookShelves shelfId remap via persisted shelfDedupMap metadata.
 *
 * @module p2-book-organization-sync
 * @since E94-S03
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { vi } from 'vitest'
import type { Shelf } from '@/data/types'
import { dedupDefaultShelves } from '../defaultShelfDedup'

let useBookReviewStore: (typeof import('@/stores/useBookReviewStore'))['useBookReviewStore']
let useShelfStore: (typeof import('@/stores/useShelfStore'))['useShelfStore']
let useReadingQueueStore: (typeof import('@/stores/useReadingQueueStore'))['useReadingQueueStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e94-s03'
const TEST_BOOK_ID = 'book-e94-s03'

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
    user: { id: TEST_USER_ID, email: 'p2-s03-test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const reviewMod = await import('@/stores/useBookReviewStore')
  useBookReviewStore = reviewMod.useBookReviewStore

  const shelfMod = await import('@/stores/useShelfStore')
  useShelfStore = shelfMod.useShelfStore

  const queueMod = await import('@/stores/useReadingQueueStore')
  useReadingQueueStore = queueMod.useReadingQueueStore

  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// bookReviews sync wiring
// ---------------------------------------------------------------------------

describe('E94-S03 P2 sync wiring — bookReviews', () => {
  it('setRating on a new book produces a syncQueue put entry', async () => {
    await useBookReviewStore.getState().setRating(TEST_BOOK_ID, 4)

    const stored = await db.bookReviews.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0].rating).toBe(4)
    expect((stored[0] as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('bookReviews')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
    expect(putEntry!.payload.book_id).toBe(TEST_BOOK_ID)
    expect(putEntry!.payload.rating).toBe(4)
  })

  it('setRating updating existing review produces a put entry', async () => {
    await useBookReviewStore.getState().setRating(TEST_BOOK_ID, 3)
    await db.syncQueue.clear()

    await useBookReviewStore.getState().setRating(TEST_BOOK_ID, 4.5)

    const entries = await getQueueEntries('bookReviews')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.payload.rating).toBe(4.5)
  })

  it('setReviewText after rating produces a put entry with review_text', async () => {
    await useBookReviewStore.getState().setRating(TEST_BOOK_ID, 5)
    await db.syncQueue.clear()

    await useBookReviewStore.getState().setReviewText(TEST_BOOK_ID, 'Great book')

    const entries = await getQueueEntries('bookReviews')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.payload.review_text).toBe('Great book')
  })

  it('deleteReview produces a syncQueue delete entry', async () => {
    await useBookReviewStore.getState().setRating(TEST_BOOK_ID, 4)
    const reviews = await db.bookReviews.toArray()
    const reviewId = reviews[0].id
    await db.syncQueue.clear()

    await useBookReviewStore.getState().deleteReview(TEST_BOOK_ID)

    const stored = await db.bookReviews.get(reviewId)
    expect(stored).toBeUndefined()

    const entries = await getQueueEntries('bookReviews')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: reviewId })
  })
})

// ---------------------------------------------------------------------------
// shelves + bookShelves sync wiring
// ---------------------------------------------------------------------------

describe('E94-S03 P2 sync wiring — shelves', () => {
  it('createShelf produces a syncQueue put entry with full shelf payload', async () => {
    const shelf = await useShelfStore.getState().createShelf('My Custom Shelf')
    expect(shelf).toBeTruthy()

    const entries = await getQueueEntries('shelves')
    const putEntry = entries.find(e => e.operation === 'put' && e.recordId === shelf!.id)
    expect(putEntry).toBeDefined()
    expect(putEntry!.payload.name).toBe('My Custom Shelf')
    expect(putEntry!.payload.is_default).toBe(false)
    expect(putEntry!.payload.sort_order).toBeTypeOf('number')
  })

  it('renameShelf (fetch-then-put) produces a put entry with full record fields', async () => {
    const shelf = await useShelfStore.getState().createShelf('Original Name')
    expect(shelf).toBeTruthy()
    await db.syncQueue.clear()

    await useShelfStore.getState().renameShelf(shelf!.id, 'Renamed Shelf')

    const entries = await getQueueEntries('shelves')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    // Full record, not a partial patch
    expect(putEntry!.payload).toMatchObject({
      id: shelf!.id,
      name: 'Renamed Shelf',
      is_default: false,
    })
    expect(putEntry!.payload.created_at).toBeDefined()
  })

  it('renameShelf on non-existent id: no queue entry created', async () => {
    await useShelfStore.getState().renameShelf('nonexistent-shelf-id', 'New Name')

    const entries = await getQueueEntries('shelves')
    expect(entries).toHaveLength(0)
  })

  it('deleteShelf produces a shelves delete entry', async () => {
    const shelf = await useShelfStore.getState().createShelf('Delete Me')
    expect(shelf).toBeTruthy()
    await db.syncQueue.clear()

    await useShelfStore.getState().deleteShelf(shelf!.id)

    const entries = await getQueueEntries('shelves')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: shelf!.id })
  })

  it('addBookToShelf produces a bookShelves put entry', async () => {
    const shelf = await useShelfStore.getState().createShelf('Target Shelf')
    expect(shelf).toBeTruthy()
    await db.syncQueue.clear()

    await useShelfStore.getState().addBookToShelf(TEST_BOOK_ID, shelf!.id)

    const entries = await getQueueEntries('bookShelves')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.payload.book_id).toBe(TEST_BOOK_ID)
    expect(putEntry!.payload.shelf_id).toBe(shelf!.id)
  })

  it('removeBookFromShelf produces a bookShelves delete entry', async () => {
    const shelf = await useShelfStore.getState().createShelf('Source Shelf')
    expect(shelf).toBeTruthy()
    await useShelfStore.getState().addBookToShelf(TEST_BOOK_ID, shelf!.id)
    const bs = await db.bookShelves.toArray()
    const entryId = bs[0].id
    await db.syncQueue.clear()

    await useShelfStore.getState().removeBookFromShelf(TEST_BOOK_ID, shelf!.id)

    const entries = await getQueueEntries('bookShelves')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: entryId })
  })
})

// ---------------------------------------------------------------------------
// readingQueue sync wiring + fieldMap translation
// ---------------------------------------------------------------------------

describe('E94-S03 P2 sync wiring — readingQueue', () => {
  it('addToQueue payload translates sortOrder → position via fieldMap', async () => {
    await useReadingQueueStore.getState().addToQueue(TEST_BOOK_ID)

    const entries = await getQueueEntries('readingQueue')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    // fieldMap: { sortOrder: 'position' } — payload must have `position`, NOT `sort_order`.
    expect(putEntry!.payload.position).toBeDefined()
    expect('sort_order' in putEntry!.payload).toBe(false)
    expect(putEntry!.payload.book_id).toBe(TEST_BOOK_ID)
  })

  it('reorderQueue produces one put entry per entry with correct position in payload', async () => {
    // Seed 3 entries, each through the real store path so sortOrder is assigned.
    await useReadingQueueStore.getState().addToQueue('book-A')
    await useReadingQueueStore.getState().addToQueue('book-B')
    await useReadingQueueStore.getState().addToQueue('book-C')

    // Pre-reorder queue: [A(0), B(1), C(2)].
    await db.syncQueue.clear()

    // Move C (index 2) to index 0 → [C(0), A(1), B(2)].
    await useReadingQueueStore.getState().reorderQueue(2, 0)

    const entries = await getQueueEntries('readingQueue')
    const puts = entries.filter(e => e.operation === 'put')
    expect(puts).toHaveLength(3)

    // Each payload carries its own position (0/1/2) translated from sortOrder.
    const byBook = new Map<string, number>()
    for (const p of puts) {
      const bookId = p.payload.book_id as string
      const pos = p.payload.position as number
      byBook.set(bookId, pos)
    }
    expect(byBook.get('book-C')).toBe(0)
    expect(byBook.get('book-A')).toBe(1)
    expect(byBook.get('book-B')).toBe(2)
  })

  it('removeFromQueue produces a delete entry', async () => {
    await useReadingQueueStore.getState().addToQueue(TEST_BOOK_ID)
    const queue = await db.readingQueue.toArray()
    const entryId = queue[0].id
    await db.syncQueue.clear()

    await useReadingQueueStore.getState().removeFromQueue(TEST_BOOK_ID)

    const entries = await getQueueEntries('readingQueue')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: entryId })
  })
})

// ---------------------------------------------------------------------------
// Unauthenticated writes — no queue entries
// ---------------------------------------------------------------------------

describe('E94-S03 P2 sync wiring — unauthenticated writes', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)
  })

  it('unauthenticated setRating: Dexie written, zero syncQueue entries', async () => {
    await useBookReviewStore.getState().setRating(TEST_BOOK_ID, 3)

    const stored = await db.bookReviews.toArray()
    expect(stored).toHaveLength(1)

    const entries = await getQueueEntries('bookReviews')
    expect(entries).toHaveLength(0)
  })

  it('unauthenticated createShelf: Dexie written, zero syncQueue entries', async () => {
    const shelf = await useShelfStore.getState().createShelf('Offline Shelf')
    expect(shelf).toBeTruthy()

    const entries = await getQueueEntries('shelves')
    expect(entries).toHaveLength(0)
  })

  it('unauthenticated addBookToShelf: Dexie written, zero bookShelves queue entries', async () => {
    const shelf = await useShelfStore.getState().createShelf('Offline Shelf 2')
    expect(shelf).toBeTruthy()
    await useShelfStore.getState().addBookToShelf(TEST_BOOK_ID, shelf!.id)

    const bs = await db.bookShelves.toArray()
    expect(bs).toHaveLength(1)

    const entries = await getQueueEntries('bookShelves')
    expect(entries).toHaveLength(0)
  })

  it('unauthenticated addToQueue: Dexie written, zero readingQueue entries', async () => {
    await useReadingQueueStore.getState().addToQueue(TEST_BOOK_ID)

    const stored = await db.readingQueue.toArray()
    expect(stored).toHaveLength(1)

    const entries = await getQueueEntries('readingQueue')
    expect(entries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// dedupDefaultShelves pure function
// ---------------------------------------------------------------------------

function makeShelf(overrides: Partial<Shelf> & Pick<Shelf, 'id' | 'name'>): Shelf {
  return {
    isDefault: overrides.isDefault ?? false,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  }
}

describe('E94-S03 dedupDefaultShelves pure helper', () => {
  it('maps an incoming default to a local default with matching name', () => {
    const local = [makeShelf({ id: 'local-fav', name: 'Favorites', isDefault: true })]
    const incoming = [makeShelf({ id: 'remote-fav', name: 'Favorites', isDefault: true })]

    const { toInsert, toSkip, mergedIdMap } = dedupDefaultShelves(incoming, local)

    expect(toInsert).toHaveLength(0)
    expect(toSkip).toHaveLength(1)
    expect(toSkip[0].id).toBe('remote-fav')
    expect(mergedIdMap).toEqual({ 'remote-fav': 'local-fav' })
  })

  it('is case-insensitive and whitespace-insensitive', () => {
    const local = [makeShelf({ id: 'local-fav', name: 'favorites', isDefault: true })]
    const incoming = [makeShelf({ id: 'remote-fav', name: ' Favorites ', isDefault: true })]

    const { toSkip, mergedIdMap } = dedupDefaultShelves(incoming, local)

    expect(toSkip).toHaveLength(1)
    expect(mergedIdMap['remote-fav']).toBe('local-fav')
  })

  it('incoming default without local match goes to toInsert', () => {
    const local: Shelf[] = []
    const incoming = [makeShelf({ id: 'remote-fav', name: 'Favorites', isDefault: true })]

    const { toInsert, toSkip, mergedIdMap } = dedupDefaultShelves(incoming, local)

    expect(toInsert).toHaveLength(1)
    expect(toSkip).toHaveLength(0)
    expect(mergedIdMap).toEqual({})
  })

  it('custom (non-default) incoming is always inserted, even when name matches a local default', () => {
    const local = [makeShelf({ id: 'local-fav', name: 'Favorites', isDefault: true })]
    const incoming = [makeShelf({ id: 'remote-custom', name: 'Favorites', isDefault: false })]

    const { toInsert, toSkip, mergedIdMap } = dedupDefaultShelves(incoming, local)

    expect(toInsert).toHaveLength(1)
    expect(toSkip).toHaveLength(0)
    expect(mergedIdMap).toEqual({})
  })

  it('local non-default with same name does NOT dedupe an incoming default', () => {
    const local = [makeShelf({ id: 'local-fav-custom', name: 'Favorites', isDefault: false })]
    const incoming = [makeShelf({ id: 'remote-fav', name: 'Favorites', isDefault: true })]

    const { toInsert, toSkip } = dedupDefaultShelves(incoming, local)

    expect(toInsert).toHaveLength(1)
    expect(toSkip).toHaveLength(0)
  })

  it('empty inputs yield empty outputs', () => {
    const { toInsert, toSkip, mergedIdMap } = dedupDefaultShelves([], [])
    expect(toInsert).toHaveLength(0)
    expect(toSkip).toHaveLength(0)
    expect(mergedIdMap).toEqual({})
  })

  it('same id on both sides: not mapped, passed to toInsert (same canonical row)', () => {
    const local = [makeShelf({ id: 'shelf-favorites', name: 'Favorites', isDefault: true })]
    const incoming = [makeShelf({ id: 'shelf-favorites', name: 'Favorites', isDefault: true })]

    const { toInsert, toSkip, mergedIdMap } = dedupDefaultShelves(incoming, local)

    expect(toInsert).toHaveLength(1)
    expect(toSkip).toHaveLength(0)
    expect(mergedIdMap).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// tableRegistry ordering invariant: shelves before bookShelves
// ---------------------------------------------------------------------------

describe('E94-S03 tableRegistry ordering invariant', () => {
  it('shelves index < bookShelves index (dedup hook depends on this)', async () => {
    const { tableRegistry } = await import('../tableRegistry')
    const shelvesIdx = tableRegistry.findIndex(e => e.dexieTable === 'shelves')
    const bookShelvesIdx = tableRegistry.findIndex(e => e.dexieTable === 'bookShelves')
    expect(shelvesIdx).toBeGreaterThanOrEqual(0)
    expect(bookShelvesIdx).toBeGreaterThanOrEqual(0)
    expect(shelvesIdx).toBeLessThan(bookShelvesIdx)
  })

  it('readingQueue.fieldMap translates sortOrder → position', async () => {
    const { tableRegistry } = await import('../tableRegistry')
    const rq = tableRegistry.find(e => e.dexieTable === 'readingQueue')
    expect(rq).toBeDefined()
    expect(rq!.fieldMap.sortOrder).toBe('position')
  })
})
