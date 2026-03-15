import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ImportedVideo, ImportedPdf } from '@/data/types'

vi.mock('sonner', () => ({
  toast: { warning: vi.fn() },
}))

vi.mock('@/lib/toastConfig', () => ({
  TOAST_DURATION: { LONG: 5000 },
}))

vi.mock('@/lib/fileVerification', () => ({
  verifyFileHandle: vi.fn().mockResolvedValue('missing'),
}))

import { useFileStatusVerification } from '../useFileStatusVerification'

function makeVideo(id: string, filename: string): ImportedVideo {
  return {
    id,
    courseId: 'c1',
    filename,
    path: `/${filename}`,
    duration: 300,
    format: 'mp4',
    order: 0,
    fileHandle: null as unknown as FileSystemFileHandle,
  }
}

function makePdf(id: string, filename: string): ImportedPdf {
  return {
    id,
    courseId: 'c1',
    filename,
    path: `/${filename}`,
    pageCount: 10,
    fileHandle: null as unknown as FileSystemFileHandle,
  }
}

// Stable array references to prevent infinite re-render loops in renderHook
const VIDEOS_1 = [makeVideo('v1', 'lesson-1.mp4')]
const VIDEOS_2 = [makeVideo('v1', 'lesson-1.mp4'), makeVideo('v2', 'lesson-2.mp4')]
const PDFS_1 = [makePdf('p1', 'notes.pdf')]
const EMPTY_VIDEOS: ImportedVideo[] = []
const EMPTY_PDFS: ImportedPdf[] = []

describe('useFileStatusVerification', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { verifyFileHandle } = await import('@/lib/fileVerification')
    vi.mocked(verifyFileHandle).mockResolvedValue('missing')
  })

  it('returns file statuses for all items', async () => {
    const { result } = renderHook(() => useFileStatusVerification(VIDEOS_1, PDFS_1))

    await waitFor(() => {
      expect(result.current.get('v1')).toBe('missing')
      expect(result.current.get('p1')).toBe('missing')
    })
  })

  it('fires toast with correct count and filenames', async () => {
    renderHook(() => useFileStatusVerification(VIDEOS_2, PDFS_1))

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledTimes(1)
      expect(toast.warning).toHaveBeenCalledWith('3 files unavailable', {
        description: 'lesson-1.mp4, lesson-2.mp4, notes.pdf',
        duration: 5000,
      })
    })
  })

  it('does not fire toast when all files are available', async () => {
    const { verifyFileHandle } = await import('@/lib/fileVerification')
    vi.mocked(verifyFileHandle).mockResolvedValue('available')

    const { result } = renderHook(() => useFileStatusVerification(VIDEOS_1, EMPTY_PDFS))

    await waitFor(() => {
      expect(result.current.get('v1')).toBe('available')
    })

    const { toast } = await import('sonner')
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('maps rejected settlements to "missing"', async () => {
    const { verifyFileHandle } = await import('@/lib/fileVerification')
    vi.mocked(verifyFileHandle).mockRejectedValue(new Error('fail'))

    const { result } = renderHook(() => useFileStatusVerification(VIDEOS_1, EMPTY_PDFS))

    await waitFor(() => {
      expect(result.current.get('v1')).toBe('missing')
    })
  })

  it('returns empty map for empty inputs', () => {
    const { result } = renderHook(() => useFileStatusVerification(EMPTY_VIDEOS, EMPTY_PDFS))
    expect(result.current.size).toBe(0)
  })
})
