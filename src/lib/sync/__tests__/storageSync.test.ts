/**
 * storageSync.test.ts — Unit tests for uploadStorageFilesForTable.
 *
 * All external I/O (Dexie, Supabase, OPFS, fetch) is mocked.
 * Tests verify routing, upload calls, URL writeback, and non-fatal
 * error handling.
 *
 * @module storageSync.test
 * @since E94-S04
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SyncQueueEntry } from '@/db/schema'

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const {
  mockCourseThumbnailsGet,
  mockAuthorsGet,
  mockImportedPdfsGet,
  mockBooksGet,
  mockBooksUpdate,
  mockDbFrom,
  mockDbUpdate,
  mockDbEq,
  mockUploadBlob,
  mockGetCoverUrl,
  mockReadBookFile,
} = vi.hoisted(() => {
  const mockDbEq = vi.fn().mockReturnThis()
  const mockDbUpdate = vi.fn().mockReturnValue({ eq: mockDbEq })
  const mockDbFrom = vi.fn().mockReturnValue({ update: mockDbUpdate })

  const mockCourseThumbnailsGet = vi.fn()
  const mockAuthorsGet = vi.fn()
  const mockImportedPdfsGet = vi.fn()
  const mockBooksGet = vi.fn()
  const mockBooksUpdate = vi.fn().mockResolvedValue(undefined)

  const mockUploadBlob = vi
    .fn()
    .mockResolvedValue({ url: 'https://cdn.example.com/path', path: 'path' })
  const mockGetCoverUrl = vi.fn()
  const mockReadBookFile = vi.fn()

  return {
    mockCourseThumbnailsGet,
    mockAuthorsGet,
    mockImportedPdfsGet,
    mockBooksGet,
    mockBooksUpdate,
    mockDbFrom,
    mockDbUpdate,
    mockDbEq,
    mockUploadBlob,
    mockGetCoverUrl,
    mockReadBookFile,
  }
})

vi.mock('@/db', () => ({
  db: {
    courseThumbnails: { get: mockCourseThumbnailsGet },
    authors: { get: mockAuthorsGet },
    importedPdfs: { get: mockImportedPdfsGet },
    books: { get: mockBooksGet, update: mockBooksUpdate },
  },
}))

vi.mock('@/lib/auth/supabase', () => ({
  supabase: { from: mockDbFrom },
}))

vi.mock('@/services/OpfsStorageService', () => ({
  opfsStorageService: { getCoverUrl: mockGetCoverUrl, readBookFile: mockReadBookFile },
}))

vi.mock('../storageUpload', () => ({
  uploadBlob: mockUploadBlob,
}))

// Global fetch mock
const mockFetch = vi.fn()
const mockRevokeObjectURL = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('URL', {
  ...URL,
  revokeObjectURL: mockRevokeObjectURL,
})

import { uploadStorageFilesForTable } from '../storageSync'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
  return {
    id: 1,
    tableName: 'importedCourses',
    recordId: 'record-1',
    operation: 'put',
    payload: { id: 'record-1' },
    attempts: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeBlob(size = 100, type = 'image/jpeg'): Blob {
  return new Blob([new Uint8Array(size)], { type })
}

// ---------------------------------------------------------------------------
// importedCourses
// ---------------------------------------------------------------------------

describe('uploadStorageFilesForTable — importedCourses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadBlob.mockResolvedValue({
      url: 'https://cdn.example.com/thumbnail',
      path: 'user1/course1/thumbnail.jpg',
    })
    mockDbUpdate.mockReturnValue({ eq: mockDbEq })
    mockDbFrom.mockReturnValue({ update: mockDbUpdate })
    mockDbEq.mockReturnThis()
  })

  it('happy path: thumbnail blob exists → uploadBlob called with correct bucket/path → Supabase update for thumbnail_url', async () => {
    const blob = makeBlob()
    mockCourseThumbnailsGet.mockResolvedValue({ courseId: 'course1', blob })

    const entry = makeEntry({ tableName: 'importedCourses', recordId: 'course1' })
    await uploadStorageFilesForTable('importedCourses', [entry], 'user1')

    expect(mockUploadBlob).toHaveBeenCalledWith(
      'course-thumbnails',
      'user1/course1/thumbnail.jpg',
      blob,
      { maxSizeBytes: 500_000 }
    )
    expect(mockDbFrom).toHaveBeenCalledWith('imported_courses')
    expect(mockDbUpdate).toHaveBeenCalledWith({
      thumbnail_url: 'https://cdn.example.com/thumbnail',
    })
  })

  it('edge case: db.courseThumbnails.get returns undefined → skips upload silently, no error thrown', async () => {
    mockCourseThumbnailsGet.mockResolvedValue(undefined)

    const entry = makeEntry({ tableName: 'importedCourses', recordId: 'course-missing' })
    await expect(
      uploadStorageFilesForTable('importedCourses', [entry], 'user1')
    ).resolves.toBeUndefined()
    expect(mockUploadBlob).not.toHaveBeenCalled()
  })

  it('edge case: thumbnailRecord.blob is falsy → skips upload silently', async () => {
    mockCourseThumbnailsGet.mockResolvedValue({ courseId: 'course1', blob: null })

    const entry = makeEntry({ tableName: 'importedCourses', recordId: 'course1' })
    await uploadStorageFilesForTable('importedCourses', [entry], 'user1')
    expect(mockUploadBlob).not.toHaveBeenCalled()
  })

  it('error path: uploadBlob throws size limit → console.warn emitted, no rethrow', async () => {
    const blob = makeBlob()
    mockCourseThumbnailsGet.mockResolvedValue({ courseId: 'course1', blob })
    mockUploadBlob.mockRejectedValue(new RangeError('blob exceeds limit'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const entry = makeEntry({ tableName: 'importedCourses', recordId: 'course1' })
    await expect(
      uploadStorageFilesForTable('importedCourses', [entry], 'user1')
    ).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[storageSync]'),
      expect.any(RangeError)
    )
    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// authors
// ---------------------------------------------------------------------------

describe('uploadStorageFilesForTable — authors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadBlob.mockResolvedValue({
      url: 'https://cdn.example.com/photo',
      path: 'user1/author1/photo.jpg',
    })
    mockDbUpdate.mockReturnValue({ eq: mockDbEq })
    mockDbFrom.mockReturnValue({ update: mockDbUpdate })
    mockDbEq.mockReturnThis()
  })

  it('happy path: readable photoHandle → blob obtained → upload to avatars → Supabase update for photo_url', async () => {
    const blob = makeBlob()
    const mockHandle = { getFile: vi.fn().mockResolvedValue(blob) }
    mockAuthorsGet.mockResolvedValue({ id: 'author1', name: 'Test', photoHandle: mockHandle })

    const entry = makeEntry({ tableName: 'authors', recordId: 'author1' })
    await uploadStorageFilesForTable('authors', [entry], 'user1')

    expect(mockUploadBlob).toHaveBeenCalledWith('avatars', 'user1/author1/photo.jpg', blob, {
      maxSizeBytes: 1_000_000,
    })
    expect(mockDbFrom).toHaveBeenCalledWith('authors')
    expect(mockDbUpdate).toHaveBeenCalledWith({ photo_url: 'https://cdn.example.com/photo' })
  })

  it('error path: photoHandle.getFile() throws DOMException → caught silently, no warn', async () => {
    const mockHandle = { getFile: vi.fn().mockRejectedValue(new DOMException('stale handle')) }
    mockAuthorsGet.mockResolvedValue({ id: 'author1', name: 'Test', photoHandle: mockHandle })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const entry = makeEntry({ tableName: 'authors', recordId: 'author1' })
    await uploadStorageFilesForTable('authors', [entry], 'user1')

    expect(mockUploadBlob).not.toHaveBeenCalled()
    // Stale handle is expected — warn should NOT be called for this case.
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('edge case: author has no photoHandle → skip silently', async () => {
    mockAuthorsGet.mockResolvedValue({ id: 'author1', name: 'Test', photoHandle: undefined })

    const entry = makeEntry({ tableName: 'authors', recordId: 'author1' })
    await uploadStorageFilesForTable('authors', [entry], 'user1')
    expect(mockUploadBlob).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// importedPdfs
// ---------------------------------------------------------------------------

describe('uploadStorageFilesForTable — importedPdfs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadBlob.mockResolvedValue({
      url: 'https://cdn.example.com/file.pdf',
      path: 'user1/pdf1/file.pdf',
    })
    mockDbUpdate.mockReturnValue({ eq: mockDbEq })
    mockDbFrom.mockReturnValue({ update: mockDbUpdate })
    mockDbEq.mockReturnThis()
  })

  it('happy path: readable fileHandle → upload to pdfs → Supabase update for file_url', async () => {
    const blob = makeBlob(1000, 'application/pdf')
    const mockHandle = { getFile: vi.fn().mockResolvedValue(blob) }
    mockImportedPdfsGet.mockResolvedValue({ id: 'pdf1', fileHandle: mockHandle })

    const entry = makeEntry({ tableName: 'importedPdfs', recordId: 'pdf1' })
    await uploadStorageFilesForTable('importedPdfs', [entry], 'user1')

    expect(mockUploadBlob).toHaveBeenCalledWith('pdfs', 'user1/pdf1/file.pdf', blob, {
      maxSizeBytes: 100_000_000,
    })
    expect(mockDbFrom).toHaveBeenCalledWith('imported_pdfs')
    expect(mockDbUpdate).toHaveBeenCalledWith({ file_url: 'https://cdn.example.com/file.pdf' })
  })

  it('error path: stale fileHandle → caught silently, skipped', async () => {
    const mockHandle = { getFile: vi.fn().mockRejectedValue(new DOMException('stale')) }
    mockImportedPdfsGet.mockResolvedValue({ id: 'pdf1', fileHandle: mockHandle })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const entry = makeEntry({ tableName: 'importedPdfs', recordId: 'pdf1' })
    await uploadStorageFilesForTable('importedPdfs', [entry], 'user1')

    expect(mockUploadBlob).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// books
// ---------------------------------------------------------------------------

describe('uploadStorageFilesForTable — books', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadBlob.mockResolvedValue({
      url: 'https://cdn.example.com/cover.jpg',
      path: 'user1/book1/cover.jpg',
    })
    mockDbUpdate.mockReturnValue({ eq: mockDbEq })
    mockDbFrom.mockReturnValue({ update: mockDbUpdate })
    mockDbEq.mockReturnThis()
  })

  it('happy path (opfs-cover): coverUrl starts with opfs-cover:// → getCoverUrl → fetch → revoke → upload → update cover_url', async () => {
    const blob = makeBlob(500, 'image/jpeg')
    mockBooksGet.mockResolvedValue({ id: 'book1', coverUrl: 'opfs-cover://book1' })
    mockGetCoverUrl.mockResolvedValue('blob:http://localhost/abc123')
    mockFetch.mockResolvedValue({ blob: vi.fn().mockResolvedValue(blob) })

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockGetCoverUrl).toHaveBeenCalledWith('book1')
    expect(mockFetch).toHaveBeenCalledWith('blob:http://localhost/abc123')
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/abc123')
    expect(mockUploadBlob).toHaveBeenCalledWith('book-covers', 'user1/book1/cover.jpg', blob, {
      maxSizeBytes: 2_000_000,
    })
    expect(mockDbFrom).toHaveBeenCalledWith('books')
    expect(mockDbUpdate).toHaveBeenCalledWith({ cover_url: 'https://cdn.example.com/cover.jpg' })
  })

  it('happy path (opfs): coverUrl starts with opfs:// → treated same as opfs-cover://', async () => {
    const blob = makeBlob(500)
    mockBooksGet.mockResolvedValue({ id: 'book1', coverUrl: 'opfs://covers/book1.jpg' })
    mockGetCoverUrl.mockResolvedValue('blob:http://localhost/xyz')
    mockFetch.mockResolvedValue({ blob: vi.fn().mockResolvedValue(blob) })

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockUploadBlob).toHaveBeenCalled()
  })

  it('edge case (already-https): coverUrl starts with https:// → skip upload entirely', async () => {
    mockBooksGet.mockResolvedValue({ id: 'book1', coverUrl: 'https://example.com/cover.jpg' })

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockGetCoverUrl).not.toHaveBeenCalled()
    expect(mockUploadBlob).not.toHaveBeenCalled()
  })

  it('error path (OPFS failure): getCoverUrl returns null → skip silently', async () => {
    mockBooksGet.mockResolvedValue({ id: 'book1', coverUrl: 'opfs-cover://book1' })
    mockGetCoverUrl.mockResolvedValue(null)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockUploadBlob).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('edge case: book has no coverUrl → skip silently', async () => {
    mockBooksGet.mockResolvedValue({ id: 'book1', coverUrl: undefined })

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')
    expect(mockUploadBlob).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// books — _uploadBookFile (E94-S07)
// ---------------------------------------------------------------------------

describe('uploadStorageFilesForTable — books file upload (E94-S07)', () => {
  const FILE_URL = 'https://cdn.example.com/book.epub'

  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadBlob.mockResolvedValue({ url: FILE_URL, path: 'user1/book1/book.epub' })
    mockDbUpdate.mockReturnValue({ eq: mockDbEq })
    mockDbFrom.mockReturnValue({ update: mockDbUpdate })
    mockDbEq.mockReturnThis()
    // Default: no cover URL so _uploadBookCover returns early without touching uploadBlob
    mockGetCoverUrl.mockResolvedValue(null)
  })

  it('happy path (local): source.type=local → readBookFile called, uploadBlob called with book-files bucket, db.books.update called with fileUrl, Supabase update called', async () => {
    const file = new File([new Uint8Array(100)], 'book.epub', { type: 'application/epub+zip' })
    mockReadBookFile.mockResolvedValue(file)
    mockBooksGet.mockResolvedValue({
      id: 'book1',
      source: { type: 'local', opfsPath: '/knowlune/books/book1' },
    })

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockReadBookFile).toHaveBeenCalledWith('/knowlune/books/book1', 'book1')
    expect(mockUploadBlob).toHaveBeenCalledWith('book-files', 'user1/book1/book.epub', file, {
      maxSizeBytes: 209_715_200,
    })
    expect(mockBooksUpdate).toHaveBeenCalledWith('book1', { fileUrl: FILE_URL })
    expect(mockDbFrom).toHaveBeenCalledWith('books')
    expect(mockDbUpdate).toHaveBeenCalledWith({ file_url: FILE_URL })
  })

  it('happy path (fileHandle): source.type=fileHandle → handle.getFile() called, blob uploaded, URL written back', async () => {
    const file = new File([new Uint8Array(200)], 'book.pdf', { type: 'application/pdf' })
    const mockHandle = { getFile: vi.fn().mockResolvedValue(file) }
    mockBooksGet.mockResolvedValue({
      id: 'book1',
      source: { type: 'fileHandle', handle: mockHandle },
    })

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockHandle.getFile).toHaveBeenCalledOnce()
    expect(mockUploadBlob).toHaveBeenCalledWith('book-files', 'user1/book1/book.pdf', file, {
      maxSizeBytes: 209_715_200,
    })
    expect(mockBooksUpdate).toHaveBeenCalledWith('book1', { fileUrl: FILE_URL })
  })

  it('edge case (already https): book.fileUrl starts with https:// → uploadBlob NOT called, no Dexie/Supabase update', async () => {
    mockBooksGet.mockResolvedValue({
      id: 'book1',
      fileUrl: 'https://cdn.supabase.com/existing/book.epub',
      source: { type: 'local', opfsPath: '/books/book1' },
    })

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockUploadBlob).not.toHaveBeenCalled()
    expect(mockBooksUpdate).not.toHaveBeenCalled()
  })

  it('edge case (indexeddb sentinel): book.fileUrl="indexeddb" → does NOT block upload (https guard does not match)', async () => {
    const file = new File([new Uint8Array(100)], 'book.epub', { type: 'application/epub+zip' })
    mockReadBookFile.mockResolvedValue(file)
    mockBooksGet.mockResolvedValue({
      id: 'book1',
      fileUrl: 'indexeddb',
      source: { type: 'local', opfsPath: '/knowlune/books/book1' },
    })

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockReadBookFile).toHaveBeenCalledOnce()
    expect(mockUploadBlob).toHaveBeenCalledOnce()
  })

  it('edge case (remote): source.type=remote → return early, no upload', async () => {
    mockBooksGet.mockResolvedValue({
      id: 'book1',
      source: { type: 'remote', url: 'https://example.com/book.epub' },
    })

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockUploadBlob).not.toHaveBeenCalled()
    expect(mockBooksUpdate).not.toHaveBeenCalled()
  })

  it('edge case (no Dexie record): db.books.get returns undefined → return early, no upload', async () => {
    mockBooksGet.mockResolvedValue(undefined)

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockUploadBlob).not.toHaveBeenCalled()
  })

  it('error path (stale fileHandle): handle.getFile() throws DOMException → skipped silently, no error thrown, no warn from inner catch', async () => {
    const mockHandle = { getFile: vi.fn().mockRejectedValue(new DOMException('stale')) }
    mockBooksGet.mockResolvedValue({
      id: 'book1',
      source: { type: 'fileHandle', handle: mockHandle },
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await uploadStorageFilesForTable('books', [entry], 'user1')

    expect(mockUploadBlob).not.toHaveBeenCalled()
    // Stale handle is a silent return, not a thrown error — inner file catch not reached.
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('error path (size limit): uploadBlob throws RangeError → caught by inner file catch, console.warn emitted, no rethrow', async () => {
    const file = new File([new Uint8Array(100)], 'huge.epub', { type: 'application/epub+zip' })
    mockReadBookFile.mockResolvedValue(file)
    mockBooksGet.mockResolvedValue({
      id: 'book1',
      source: { type: 'local', opfsPath: '/books/book1' },
    })
    mockUploadBlob.mockRejectedValue(new RangeError('blob exceeds 200 MB limit'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await expect(uploadStorageFilesForTable('books', [entry], 'user1')).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(
      '[storageSync] File upload failed',
      'book1',
      expect.any(RangeError)
    )
    expect(mockBooksUpdate).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('integration (independence): cover throws → file upload still runs; outer loop proceeds', async () => {
    const file = new File([new Uint8Array(100)], 'book.epub', { type: 'application/epub+zip' })
    mockReadBookFile.mockResolvedValue(file)
    // Book has an opfs cover (triggers _uploadBookCover) and a local source (triggers _uploadBookFile)
    mockBooksGet.mockResolvedValue({
      id: 'book1',
      coverUrl: 'opfs-cover://book1',
      source: { type: 'local', opfsPath: '/books/book1' },
    })
    // getCoverUrl succeeds but fetch (for cover blob) throws — simulates cover upload failure
    mockGetCoverUrl.mockResolvedValue('blob:http://localhost/abc')
    mockFetch.mockRejectedValue(new Error('network error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const entry = makeEntry({ tableName: 'books', recordId: 'book1' })
    await expect(uploadStorageFilesForTable('books', [entry], 'user1')).resolves.toBeUndefined()

    // File upload was attempted despite cover failure
    expect(mockReadBookFile).toHaveBeenCalledOnce()
    // uploadBlob called exactly once — for the file (cover threw before uploadBlob)
    expect(mockUploadBlob).toHaveBeenCalledOnce()
    expect(mockUploadBlob).toHaveBeenCalledWith(
      'book-files',
      expect.any(String),
      file,
      expect.any(Object)
    )

    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Non-target table
// ---------------------------------------------------------------------------

describe('uploadStorageFilesForTable — non-target table', () => {
  beforeEach(() => vi.clearAllMocks())

  it('integration: non-target table name → returns without dispatching any upload', async () => {
    const entry = makeEntry({ tableName: 'notes', recordId: 'note1' })
    await expect(uploadStorageFilesForTable('notes', [entry], 'user1')).resolves.toBeUndefined()
    expect(mockUploadBlob).not.toHaveBeenCalled()
    expect(mockDbFrom).not.toHaveBeenCalled()
  })
})
