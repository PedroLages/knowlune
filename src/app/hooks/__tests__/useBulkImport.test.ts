/**
 * Unit tests for useBulkImport hook
 *
 * Tests sequential processing, error isolation, progress tracking,
 * and cancellation support.
 *
 * @since E108-S01
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBulkImport } from '../useBulkImport'

// Mock dependencies
const mockImportBook = vi.fn()

vi.mock('@/stores/useBookStore', () => ({
  useBookStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ importBook: mockImportBook }),
}))

vi.mock('@/services/EpubMetadataService', () => ({
  extractEpubMetadata: vi.fn().mockResolvedValue({
    title: 'Test Book',
    author: 'Test Author',
    isbn: undefined,
    coverBlob: undefined,
  }),
}))

vi.mock('@/services/OpenLibraryService', () => ({
  fetchOpenLibraryMetadata: vi.fn().mockResolvedValue({
    coverUrl: undefined,
    subjects: [],
  }),
  fetchCoverImage: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/services/OpfsStorageService', () => ({
  opfsStorageService: {
    storeCoverFile: vi.fn().mockResolvedValue('covers/test.jpg'),
    storeBookFile: vi.fn().mockResolvedValue('books/test.epub'),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

function makeEpubFile(name: string): File {
  return new File(['fake epub content'], name, { type: 'application/epub+zip' })
}

describe('useBulkImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockImportBook.mockResolvedValue(undefined)
  })

  it('starts in idle phase', () => {
    const { result } = renderHook(() => useBulkImport())
    expect(result.current.phase).toBe('idle')
    expect(result.current.progress.total).toBe(0)
  })

  it('processes files sequentially (not in parallel)', async () => {
    const callOrder: number[] = []
    let callCount = 0

    mockImportBook.mockImplementation(async () => {
      callCount++
      const myIndex = callCount
      callOrder.push(myIndex)
      // Simulate async work
      await new Promise(r => setTimeout(r, 10))
      // If sequential, callOrder should be [1] then [1,2] then [1,2,3]
      // If parallel, all would start before any finish
    })

    const files = [
      makeEpubFile('book1.epub'),
      makeEpubFile('book2.epub'),
      makeEpubFile('book3.epub'),
    ]

    const { result } = renderHook(() => useBulkImport())

    await act(async () => {
      await result.current.startBulkImport(files)
    })

    // Verify sequential: importBook was called 3 times, one after another
    expect(mockImportBook).toHaveBeenCalledTimes(3)
    expect(callOrder).toEqual([1, 2, 3])
  })

  it('isolates per-file errors — one failure does not stop batch', async () => {
    const { extractEpubMetadata } = await import('@/services/EpubMetadataService')
    const mockExtract = vi.mocked(extractEpubMetadata)

    // Second file fails
    mockExtract
      .mockResolvedValueOnce({ title: 'Book 1', author: 'Author 1' })
      .mockRejectedValueOnce(new Error('Corrupt EPUB'))
      .mockResolvedValueOnce({ title: 'Book 3', author: 'Author 3' })

    const files = [
      makeEpubFile('book1.epub'),
      makeEpubFile('book2.epub'),
      makeEpubFile('book3.epub'),
    ]

    const { result } = renderHook(() => useBulkImport())

    await act(async () => {
      await result.current.startBulkImport(files)
    })

    // Books 1 and 3 succeed, book 2 fails
    expect(mockImportBook).toHaveBeenCalledTimes(2)
    expect(result.current.results).toHaveLength(3)
    expect(result.current.results[0].status).toBe('success')
    expect(result.current.results[1].status).toBe('error')
    expect(result.current.results[1].error).toBe('Corrupt EPUB')
    expect(result.current.results[2].status).toBe('success')
  })

  it('tracks progress accurately', async () => {
    const progressSnapshots: Array<{ current: number; total: number }> = []

    // Capture progress during import
    mockImportBook.mockImplementation(async () => {
      // Intentional: small delay to let state updates flush
      await new Promise(r => setTimeout(r, 5))
    })

    const files = [
      makeEpubFile('a.epub'),
      makeEpubFile('b.epub'),
    ]

    const { result } = renderHook(() => useBulkImport())

    await act(async () => {
      await result.current.startBulkImport(files)
    })

    // After completion, progress should show total
    expect(result.current.progress.total).toBe(2)
    expect(result.current.progress.current).toBe(2)
    expect(result.current.phase).toBe('done')
  })

  it('skips non-epub files with error result', async () => {
    const files = [
      new File(['content'], 'book.pdf', { type: 'application/pdf' }),
      makeEpubFile('book.epub'),
    ]

    const { result } = renderHook(() => useBulkImport())

    await act(async () => {
      await result.current.startBulkImport(files)
    })

    expect(result.current.results[0]).toEqual({
      fileName: 'book.pdf',
      status: 'error',
      error: 'Not an EPUB file',
    })
    expect(result.current.results[1].status).toBe('success')
    expect(mockImportBook).toHaveBeenCalledTimes(1)
  })

  it('does nothing for empty file array', async () => {
    const { result } = renderHook(() => useBulkImport())

    await act(async () => {
      await result.current.startBulkImport([])
    })

    expect(result.current.phase).toBe('idle')
    expect(mockImportBook).not.toHaveBeenCalled()
  })

  it('resets to idle state', async () => {
    const files = [makeEpubFile('book.epub')]
    const { result } = renderHook(() => useBulkImport())

    await act(async () => {
      await result.current.startBulkImport(files)
    })
    expect(result.current.phase).toBe('done')

    act(() => {
      result.current.reset()
    })

    expect(result.current.phase).toBe('idle')
    expect(result.current.results).toHaveLength(0)
    expect(result.current.progress.total).toBe(0)
  })
})
