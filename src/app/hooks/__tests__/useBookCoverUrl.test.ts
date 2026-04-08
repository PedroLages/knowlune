/**
 * Unit tests for useBookCoverUrl hook
 *
 * @since E107-S01
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBookCoverUrl } from '../useBookCoverUrl'
import { opfsStorageService } from '@/services/OpfsStorageService'

// Mock OpfsStorageService
vi.mock('@/services/OpfsStorageService', () => ({
  opfsStorageService: {
    getCoverUrl: vi.fn(),
  },
}))

describe('useBookCoverUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('returns null when coverUrl is undefined', async () => {
    const { result } = renderHook(() => useBookCoverUrl({ bookId: 'book-1', coverUrl: undefined }))

    await waitFor(() => {
      expect(result.current).toBe(null)
    })

    expect(opfsStorageService.getCoverUrl).not.toHaveBeenCalled()
  })

  it('returns http/https URLs directly without resolution', async () => {
    const externalUrl = 'https://example.com/cover.jpg'

    const { result } = renderHook(() =>
      useBookCoverUrl({ bookId: 'book-1', coverUrl: externalUrl })
    )

    await waitFor(() => {
      expect(result.current).toBe(externalUrl)
    })

    expect(opfsStorageService.getCoverUrl).not.toHaveBeenCalled()
  })

  it('resolves opfs-cover:// URLs via OpfsStorageService', async () => {
    const mockBlobUrl = 'blob:https://example.com/cover-abc123'
    vi.mocked(opfsStorageService.getCoverUrl).mockResolvedValue(mockBlobUrl)

    const { result } = renderHook(() =>
      useBookCoverUrl({ bookId: 'book-1', coverUrl: 'opfs-cover://book-1' })
    )

    await waitFor(() => {
      expect(result.current).toBe(mockBlobUrl)
    })

    expect(opfsStorageService.getCoverUrl).toHaveBeenCalledWith('book-1')
  })

  it('resolves opfs:// URLs via OpfsStorageService', async () => {
    const mockBlobUrl = 'blob:https://example.com/cover-def456'
    vi.mocked(opfsStorageService.getCoverUrl).mockResolvedValue(mockBlobUrl)

    const { result } = renderHook(() =>
      useBookCoverUrl({
        bookId: 'book-2',
        coverUrl: 'opfs:///knowlune/books/book-2/cover.jpg',
      })
    )

    await waitFor(() => {
      expect(result.current).toBe(mockBlobUrl)
    })

    expect(opfsStorageService.getCoverUrl).toHaveBeenCalledWith('book-2')
  })

  it('returns null when OpfsStorageService fails to resolve', async () => {
    vi.mocked(opfsStorageService.getCoverUrl).mockResolvedValue(null)

    const { result } = renderHook(() =>
      useBookCoverUrl({ bookId: 'book-1', coverUrl: 'opfs-cover://book-1' })
    )

    await waitFor(() => {
      expect(result.current).toBe(null)
    })

    expect(opfsStorageService.getCoverUrl).toHaveBeenCalledWith('book-1')
  })

  it('re-creates blob URL when coverUrl changes', async () => {
    const mockBlobUrl1 = 'blob:https://example.com/cover-1'
    const mockBlobUrl2 = 'blob:https://example.com/cover-2'

    vi.mocked(opfsStorageService.getCoverUrl)
      .mockResolvedValueOnce(mockBlobUrl1)
      .mockResolvedValueOnce(mockBlobUrl2)

    const { result, rerender } = renderHook(
      ({ bookId, coverUrl }) => useBookCoverUrl({ bookId, coverUrl }),
      {
        initialProps: { bookId: 'book-1', coverUrl: 'opfs-cover://book-1' as string | undefined },
      }
    )

    await waitFor(() => {
      expect(result.current).toBe(mockBlobUrl1)
    })

    // Change to a different book
    rerender({ bookId: 'book-2', coverUrl: 'opfs-cover://book-2' })

    await waitFor(() => {
      expect(result.current).toBe(mockBlobUrl2)
    })

    expect(opfsStorageService.getCoverUrl).toHaveBeenCalledWith('book-1')
    expect(opfsStorageService.getCoverUrl).toHaveBeenCalledWith('book-2')
  })

  it('releases previous blob URL when coverUrl changes', async () => {
    const mockBlobUrl = 'blob:https://example.com/cover-123'
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    vi.mocked(opfsStorageService.getCoverUrl).mockResolvedValue(mockBlobUrl)

    const { result, rerender } = renderHook(
      ({ bookId, coverUrl }) => useBookCoverUrl({ bookId, coverUrl }),
      {
        initialProps: { bookId: 'book-1', coverUrl: 'opfs-cover://book-1' as string | undefined },
      }
    )

    await waitFor(() => {
      expect(result.current).toBe(mockBlobUrl)
    })

    // Change to undefined (no cover)
    rerender({ bookId: 'book-1', coverUrl: undefined })

    await waitFor(() => {
      expect(result.current).toBe(null)
    })

    // The previous blob URL should be revoked
    expect(revokeSpy).toHaveBeenCalledWith(mockBlobUrl)
  })

  it('handles rejection from OpfsStorageService gracefully', async () => {
    vi.mocked(opfsStorageService.getCoverUrl).mockRejectedValue(new Error('Storage error'))

    const { result } = renderHook(() =>
      useBookCoverUrl({ bookId: 'book-1', coverUrl: 'opfs-cover://book-1' })
    )

    await waitFor(() => {
      expect(result.current).toBe(null)
    })

    expect(opfsStorageService.getCoverUrl).toHaveBeenCalledWith('book-1')
  })

  it('returns null when coverUrl is empty string', async () => {
    const { result } = renderHook(() => useBookCoverUrl({ bookId: 'book-1', coverUrl: '' }))

    await waitFor(() => {
      expect(result.current).toBe(null)
    })

    expect(opfsStorageService.getCoverUrl).not.toHaveBeenCalled()
  })

  it('returns null for malformed protocol (ftp://)', async () => {
    const { result } = renderHook(() =>
      useBookCoverUrl({ bookId: 'book-1', coverUrl: 'ftp://example.com/cover.jpg' })
    )

    await waitFor(() => {
      expect(result.current).toBe(null)
    })

    expect(opfsStorageService.getCoverUrl).not.toHaveBeenCalled()
  })

  it('returns null for javascript: protocol', async () => {
    const { result } = renderHook(() =>
      useBookCoverUrl({ bookId: 'book-1', coverUrl: 'javascript:alert(1)' })
    )

    await waitFor(() => {
      expect(result.current).toBe(null)
    })

    expect(opfsStorageService.getCoverUrl).not.toHaveBeenCalled()
  })

  it('passes through data:image/ URIs directly', async () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgo='

    const { result } = renderHook(() =>
      useBookCoverUrl({ bookId: 'book-1', coverUrl: dataUri })
    )

    await waitFor(() => {
      expect(result.current).toBe(dataUri)
    })

    expect(opfsStorageService.getCoverUrl).not.toHaveBeenCalled()
  })

  it('does not revoke non-blob URLs on unmount', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const { result, unmount } = renderHook(() =>
      useBookCoverUrl({ bookId: 'book-1', coverUrl: 'https://example.com/cover.jpg' })
    )

    await waitFor(() => {
      expect(result.current).toBe('https://example.com/cover.jpg')
    })

    unmount()

    expect(revokeSpy).not.toHaveBeenCalled()
  })
})
