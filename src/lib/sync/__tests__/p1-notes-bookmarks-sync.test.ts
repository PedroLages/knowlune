/**
 * p1-notes-bookmarks-sync.test.ts — E93-S02 integration test for P1 sync tables.
 *
 * Verifies the end-to-end wiring inside the app:
 *   Store mutation → syncableWrite → Dexie write + syncQueue entry
 *
 * Covers all 7 mutation operations:
 *   - notes: saveNote, addNote, deleteNote, softDelete, restoreNote
 *   - bookmarks: addBookmark, updateBookmarkLabel, deleteBookmark
 *
 * Also covers the unauthenticated no-queue scenario (R7).
 *
 * Critical regression check: softDelete fieldMap rename — the queue entry
 * payload must have `soft_deleted` (not `deleted`) because tableRegistry
 * has `fieldMap: { deleted: 'soft_deleted' }` for the `notes` table.
 *
 * @module p1-notes-bookmarks-sync
 * @since E93-S02
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { vi } from 'vitest'

let useNoteStore: (typeof import('@/stores/useNoteStore'))['useNoteStore']
let useBookmarkStore: (typeof import('@/stores/useBookmarkStore'))['useBookmarkStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e93-s02'
const TEST_COURSE_ID = 'course-p1'
const TEST_LESSON_ID = 'lesson-p1'

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  // Seed a signed-in user so syncableWrite enqueues upload entries.
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 'p1-test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const noteMod = await import('@/stores/useNoteStore')
  useNoteStore = noteMod.useNoteStore

  const bookmarkMod = await import('@/stores/useBookmarkStore')
  useBookmarkStore = bookmarkMod.useBookmarkStore

  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// Notes sync wiring
// ---------------------------------------------------------------------------

describe('E93-S02 P1 sync wiring — notes', () => {
  it('saveNote produces a syncQueue put entry for tableName: notes', async () => {
    const note = {
      id: crypto.randomUUID(),
      courseId: TEST_COURSE_ID,
      videoId: TEST_LESSON_ID,
      content: 'Integration test note',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    }

    await useNoteStore.getState().saveNote(note)

    const stored = await db.notes.get(note.id)
    expect(stored).toBeDefined()
    expect((stored as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const queue = await db.syncQueue.toArray()
    const entries = queue.filter(q => q.tableName === 'notes')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
  })

  it('addNote produces a syncQueue add entry for tableName: notes', async () => {
    const note = {
      id: crypto.randomUUID(),
      courseId: TEST_COURSE_ID,
      videoId: TEST_LESSON_ID,
      content: 'New note via addNote',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    }

    await useNoteStore.getState().addNote(note)

    const stored = await db.notes.get(note.id)
    expect(stored).toBeDefined()

    const queue = await db.syncQueue.toArray()
    const entries = queue.filter(q => q.tableName === 'notes')
    const addEntry = entries.find(e => e.operation === 'add')
    expect(addEntry).toBeDefined()
    expect(addEntry!.status).toBe('pending')
  })

  it('deleteNote produces a syncQueue delete entry with payload: { id: noteId }', async () => {
    const note = {
      id: crypto.randomUUID(),
      courseId: TEST_COURSE_ID,
      videoId: TEST_LESSON_ID,
      content: 'Note to delete',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    }

    await useNoteStore.getState().addNote(note)
    await useNoteStore.getState().deleteNote(note.id)

    const stored = await db.notes.get(note.id)
    expect(stored).toBeUndefined()

    const queue = await db.syncQueue.toArray()
    const deleteEntry = queue.find(q => q.tableName === 'notes' && q.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: note.id })
  })

  it('softDelete fieldMap rename: queue payload has soft_deleted (not deleted)', async () => {
    const noteId = crypto.randomUUID()
    const note = {
      id: noteId,
      courseId: TEST_COURSE_ID,
      videoId: TEST_LESSON_ID,
      content: 'Soft delete test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    }

    await useNoteStore.getState().addNote(note)

    // Clear queue from addNote so we can isolate softDelete entry
    await db.syncQueue.clear()

    await useNoteStore.getState().softDelete(noteId)

    // Dexie record has deleted: true
    const stored = await db.notes.get(noteId)
    expect(stored?.deleted).toBe(true)
    expect(stored?.deletedAt).toBeDefined()

    // Queue entry payload must use fieldMap rename: soft_deleted (not deleted)
    const queue = await db.syncQueue.toArray()
    const softDeleteEntry = queue.find(q => q.tableName === 'notes' && q.operation === 'put')
    expect(softDeleteEntry).toBeDefined()
    expect(softDeleteEntry!.payload.soft_deleted).toBe(true)
    expect('deleted' in softDeleteEntry!.payload).toBe(false) // fieldMap rename verified
  })

  it('restoreNote after softDelete: queue payload has soft_deleted: false', async () => {
    const noteId = crypto.randomUUID()
    const note = {
      id: noteId,
      courseId: TEST_COURSE_ID,
      videoId: TEST_LESSON_ID,
      content: 'Restore test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    }

    await useNoteStore.getState().addNote(note)
    await useNoteStore.getState().softDelete(noteId)

    // Clear queue to isolate restoreNote entry
    await db.syncQueue.clear()

    await useNoteStore.getState().restoreNote(noteId)

    // Dexie record has deleted: false
    const stored = await db.notes.get(noteId)
    expect(stored?.deleted).toBe(false)

    // Queue entry payload has soft_deleted: false
    const queue = await db.syncQueue.toArray()
    const restoreEntry = queue.find(q => q.tableName === 'notes' && q.operation === 'put')
    expect(restoreEntry).toBeDefined()
    expect(restoreEntry!.payload.soft_deleted).toBe(false)
  })

  it('softDelete on non-existent noteId: no queue entry created, no error thrown', async () => {
    await expect(useNoteStore.getState().softDelete('nonexistent-id')).resolves.toBeUndefined()

    const queue = await db.syncQueue.toArray()
    const notesEntries = queue.filter(q => q.tableName === 'notes')
    expect(notesEntries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Bookmarks sync wiring
// ---------------------------------------------------------------------------

describe('E93-S02 P1 sync wiring — bookmarks', () => {
  it('addBookmark produces a syncQueue add entry for tableName: bookmarks', async () => {
    await useBookmarkStore.getState().addBookmark(TEST_COURSE_ID, TEST_LESSON_ID, 42)

    const bookmarks = await db.bookmarks.toArray()
    expect(bookmarks).toHaveLength(1)
    expect((bookmarks[0] as Record<string, unknown>).userId).toBe(TEST_USER_ID)
    expect(bookmarks[0].updatedAt).toBeDefined()

    const queue = await db.syncQueue.toArray()
    const addEntry = queue.find(q => q.tableName === 'bookmarks' && q.operation === 'add')
    expect(addEntry).toBeDefined()
    expect(addEntry!.status).toBe('pending')
  })

  it('updateBookmarkLabel: queue put entry contains full bookmark record fields plus new label', async () => {
    await useBookmarkStore.getState().addBookmark(TEST_COURSE_ID, TEST_LESSON_ID, 60, 'Original label')
    const bookmarks = await db.bookmarks.toArray()
    const bookmarkId = bookmarks[0].id

    // Clear queue to isolate updateBookmarkLabel entry
    await db.syncQueue.clear()

    await useBookmarkStore.getState().updateBookmarkLabel(bookmarkId, 'Updated label')

    const queue = await db.syncQueue.toArray()
    const putEntry = queue.find(q => q.tableName === 'bookmarks' && q.operation === 'put')
    expect(putEntry).toBeDefined()
    // Verify it's a full record (fetch-then-put), not just { label }
    expect(putEntry!.payload).toMatchObject({
      id: bookmarkId,
      course_id: TEST_COURSE_ID,
      lesson_id: TEST_LESSON_ID,
      label: 'Updated label',
    })
  })

  it('deleteBookmark produces a syncQueue delete entry; bookmark absent from Dexie', async () => {
    await useBookmarkStore.getState().addBookmark(TEST_COURSE_ID, TEST_LESSON_ID, 90)
    const bookmarks = await db.bookmarks.toArray()
    const bookmarkId = bookmarks[0].id

    await useBookmarkStore.getState().deleteBookmark(bookmarkId)

    const stored = await db.bookmarks.get(bookmarkId)
    expect(stored).toBeUndefined()

    const queue = await db.syncQueue.toArray()
    const deleteEntry = queue.find(q => q.tableName === 'bookmarks' && q.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: bookmarkId })
  })

  it('updateBookmarkLabel on non-existent bookmarkId: no queue entry created', async () => {
    await useBookmarkStore.getState().updateBookmarkLabel('nonexistent-id', 'New label')

    const queue = await db.syncQueue.toArray()
    const bookmarkEntries = queue.filter(q => q.tableName === 'bookmarks')
    expect(bookmarkEntries).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Unauthenticated writes
// ---------------------------------------------------------------------------

describe('E93-S02 P1 sync wiring — unauthenticated writes', () => {
  it('unauthenticated note save: Dexie record created, zero syncQueue entries for notes', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    const note = {
      id: crypto.randomUUID(),
      courseId: TEST_COURSE_ID,
      videoId: TEST_LESSON_ID,
      content: 'Offline note',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
    }

    await useNoteStore.getState().addNote(note)

    const stored = await db.notes.get(note.id)
    expect(stored).toBeDefined()

    const queue = await db.syncQueue.toArray()
    const notesEntries = queue.filter(q => q.tableName === 'notes')
    expect(notesEntries).toHaveLength(0)
  })

  it('unauthenticated bookmark add: Dexie record created, zero syncQueue entries for bookmarks', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    await useBookmarkStore.getState().addBookmark(TEST_COURSE_ID, TEST_LESSON_ID, 30)

    const bookmarks = await db.bookmarks.toArray()
    expect(bookmarks).toHaveLength(1)

    const queue = await db.syncQueue.toArray()
    const bookmarkEntries = queue.filter(q => q.tableName === 'bookmarks')
    expect(bookmarkEntries).toHaveLength(0)
  })
})
