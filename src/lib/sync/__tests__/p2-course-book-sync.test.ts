/**
 * p2-course-book-sync.test.ts — E94-S02 integration test for P2 sync tables.
 *
 * Verifies the end-to-end wiring inside the app:
 *   Store mutation → syncableWrite → Dexie write + syncQueue entry
 *
 * Covers all key P2 mutation types:
 *   - useCourseImportStore: addImportedCourse (handles stripped)
 *   - useAuthorStore: addAuthor (photoHandle stripped), deleteAuthor (undo callback)
 *   - useBookStore: importBook (source decomposition), updateBookPosition (monotonic progress)
 *
 * Also covers the unauthenticated no-queue scenario (R9).
 *
 * @module p2-course-book-sync
 * @since E94-S02
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { vi } from 'vitest'
import type { ImportedCourse, Book } from '@/data/types'

let useCourseImportStore: (typeof import('@/stores/useCourseImportStore'))['useCourseImportStore']
let useAuthorStore: (typeof import('@/stores/useAuthorStore'))['useAuthorStore']
let useBookStore: (typeof import('@/stores/useBookStore'))['useBookStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e94-s02'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeCourse(overrides?: Partial<ImportedCourse>): ImportedCourse {
  return {
    id: crypto.randomUUID(),
    name: 'Test Course',
    importedAt: new Date().toISOString(),
    category: 'Engineering',
    tags: ['test'],
    status: 'not-started',
    videoCount: 0,
    pdfCount: 0,
    directoryHandle: undefined as unknown as FileSystemDirectoryHandle,
    ...overrides,
  }
}


function makeBook(overrides?: Partial<Book>): Book {
  return {
    id: crypto.randomUUID(),
    title: 'Test Book',
    format: 'audiobook',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/test/book.m4b' },
    progress: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 'p2-test@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const courseMod = await import('@/stores/useCourseImportStore')
  useCourseImportStore = courseMod.useCourseImportStore

  const authorMod = await import('@/stores/useAuthorStore')
  useAuthorStore = authorMod.useAuthorStore

  const bookMod = await import('@/stores/useBookStore')
  useBookStore = bookMod.useBookStore

  const dbMod = await import('@/db')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// Course sync wiring
// ---------------------------------------------------------------------------

describe('E94-S02 P2 sync wiring — courses', () => {
  it('addImportedCourse produces a syncQueue add entry for tableName: importedCourses', async () => {
    const course = makeCourse()

    await useCourseImportStore.getState().addImportedCourse(course)

    const stored = await db.importedCourses.get(course.id)
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).userId).toBe(TEST_USER_ID)

    const entries = await getQueueEntries('importedCourses')
    const addEntry = entries.find(e => e.operation === 'add')
    expect(addEntry).toBeDefined()
    expect(addEntry!.status).toBe('pending')
    expect(addEntry!.tableName).toBe('importedCourses')
  })

  it('addImportedCourse: directoryHandle and coverImageHandle absent from syncQueue payload', async () => {
    const course = makeCourse({
      directoryHandle: { name: 'TestDir' } as unknown as FileSystemDirectoryHandle,
      coverImageHandle: { name: 'cover.jpg' } as unknown as FileSystemFileHandle,
    })

    await useCourseImportStore.getState().addImportedCourse(course)

    const entries = await getQueueEntries('importedCourses')
    const addEntry = entries.find(e => e.operation === 'add')
    expect(addEntry).toBeDefined()
    expect('directory_handle' in addEntry!.payload).toBe(false)
    expect('cover_image_handle' in addEntry!.payload).toBe(false)
  })

  it('updateCourseTags produces a put entry for importedCourses with updated tags', async () => {
    const course = makeCourse()
    await useCourseImportStore.getState().addImportedCourse(course)
    await db.syncQueue.clear()

    await useCourseImportStore.getState().updateCourseTags(course.id, ['react', 'typescript'])

    const entries = await getQueueEntries('importedCourses')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.payload.tags).toEqual(['react', 'typescript'])
    expect('directory_handle' in putEntry!.payload).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Author sync wiring
// ---------------------------------------------------------------------------

describe('E94-S02 P2 sync wiring — authors', () => {
  it('addAuthor produces a syncQueue add entry for tableName: authors', async () => {
    const authorData = {
      name: 'Jane Doe',
      courseIds: [],
    }

    const created = await useAuthorStore.getState().addAuthor(authorData)

    const stored = await db.authors.get(created.id)
    expect(stored).toBeDefined()

    const entries = await getQueueEntries('authors')
    const addEntry = entries.find(e => e.operation === 'add')
    expect(addEntry).toBeDefined()
    expect(addEntry!.status).toBe('pending')
    expect(addEntry!.tableName).toBe('authors')
  })

  it('addAuthor: photoHandle absent from syncQueue payload', async () => {
    const authorData = {
      name: 'Photo Author',
      courseIds: [],
      photoHandle: { name: 'photo.jpg' } as unknown as FileSystemFileHandle,
    }

    const created = await useAuthorStore.getState().addAuthor(authorData)

    const entries = await getQueueEntries('authors')
    const addEntry = entries.find(e => e.recordId === created.id && e.operation === 'add')
    expect(addEntry).toBeDefined()
    expect('photo_handle' in addEntry!.payload).toBe(false)
  })

  it('deleteAuthor produces a syncQueue delete entry for authors', async () => {
    const authorData = { name: 'Delete Me', courseIds: [] }
    const created = await useAuthorStore.getState().addAuthor(authorData)
    await db.syncQueue.clear()

    await useAuthorStore.getState().deleteAuthor(created.id, { silent: true })

    const entries = await getQueueEntries('authors')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: created.id })
  })

  it('linkCourseToAuthor produces a put entry with updated courseIds', async () => {
    const authorData = { name: 'Link Author', courseIds: [] }
    const created = await useAuthorStore.getState().addAuthor(authorData)
    await db.syncQueue.clear()

    const courseId = crypto.randomUUID()
    await useAuthorStore.getState().linkCourseToAuthor(created.id, courseId)

    const entries = await getQueueEntries('authors')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.payload.course_ids).toContain(courseId)
  })
})

// ---------------------------------------------------------------------------
// Book sync wiring
// ---------------------------------------------------------------------------

describe('E94-S02 P2 sync wiring — books', () => {
  it('importBook with local source produces put entry; source_type: local, source absent', async () => {
    const book = makeBook({
      source: { type: 'local', opfsPath: '/opfs/book.m4b' },
    })

    await useBookStore.getState().importBook(book)

    const stored = await db.books.get(book.id)
    expect(stored).toBeDefined()

    const entries = await getQueueEntries('books')
    // importBook uses 'put' (upsert) to support re-import of same ID
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.status).toBe('pending')
    // source_type present, source absent
    expect(putEntry!.payload.source_type).toBe('local')
    expect(putEntry!.payload.source_url).toBeNull()
    expect('source' in putEntry!.payload).toBe(false)
  })

  it('importBook with remote source produces payload with source_type: remote and source_url', async () => {
    const book = makeBook({
      source: { type: 'remote', url: 'https://abs.example.com/book.m4b' },
    })

    await useBookStore.getState().importBook(book)

    const entries = await getQueueEntries('books')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.payload.source_type).toBe('remote')
    expect(putEntry!.payload.source_url).toBe('https://abs.example.com/book.m4b')
    expect('source' in putEntry!.payload).toBe(false)
  })

  it('updateBookPosition produces a put entry with progress in payload (monotonic)', async () => {
    const book = makeBook()
    await useBookStore.getState().importBook(book)
    await db.syncQueue.clear()

    await useBookStore.getState().updateBookPosition(
      book.id,
      { type: 'time', seconds: 120 },
      42
    )

    const entries = await getQueueEntries('books')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.payload.progress).toBe(42)
    expect(putEntry!.payload.current_position).toBeDefined()
  })

  it('deleteBook produces a delete entry; book absent from Dexie', async () => {
    const book = makeBook()
    await useBookStore.getState().importBook(book)
    await db.syncQueue.clear()

    await useBookStore.getState().deleteBook(book.id)

    const stored = await db.books.get(book.id)
    expect(stored).toBeUndefined()

    const entries = await getQueueEntries('books')
    const deleteEntry = entries.find(e => e.operation === 'delete')
    expect(deleteEntry).toBeDefined()
    expect(deleteEntry!.payload).toEqual({ id: book.id })
  })

  it('updateBookStatus to finished produces put entry with finished_at', async () => {
    const book = makeBook()
    await useBookStore.getState().importBook(book)
    await db.syncQueue.clear()

    await useBookStore.getState().updateBookStatus(book.id, 'finished')

    const entries = await getQueueEntries('books')
    const putEntry = entries.find(e => e.operation === 'put')
    expect(putEntry).toBeDefined()
    expect(putEntry!.payload.status).toBe('finished')
    expect(putEntry!.payload.finished_at).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Unauthenticated writes
// ---------------------------------------------------------------------------

describe('E94-S02 P2 sync wiring — unauthenticated writes', () => {
  it('unauthenticated addImportedCourse: Dexie written, zero syncQueue entries', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    const course = makeCourse()
    await useCourseImportStore.getState().addImportedCourse(course)

    const stored = await db.importedCourses.get(course.id)
    expect(stored).toBeDefined()

    const entries = await getQueueEntries('importedCourses')
    expect(entries).toHaveLength(0)
  })

  it('unauthenticated importBook: Dexie written with sourceType/sourceUrl, zero syncQueue entries', async () => {
    useAuthStore.setState({ user: null } as Partial<ReturnType<typeof useAuthStore.getState>>)

    const book = makeBook()
    await useBookStore.getState().importBook(book)

    const stored = await db.books.get(book.id)
    expect(stored).toBeDefined()
    expect((stored as unknown as Record<string, unknown>).sourceType).toBe('local')

    const entries = await getQueueEntries('books')
    expect(entries).toHaveLength(0)
  })
})
