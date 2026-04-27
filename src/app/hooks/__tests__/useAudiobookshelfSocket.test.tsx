/**
 * Inbound socket path uses useBookStore only (no raw Dexie); single position write.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAudiobookshelfSocket } from '@/app/hooks/useAudiobookshelfSocket'
import { useBookStore } from '@/stores/useBookStore'
import * as AudiobookshelfService from '@/services/AudiobookshelfService'
import type { AudiobookshelfServer, Book } from '@/data/types'

vi.mock('@/lib/credentials/absApiKeyResolver', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/credentials/absApiKeyResolver')>()
  return {
    ...actual,
    useAbsApiKey: () => ({ value: 'socket-test-key', loading: false, authFailed: false }),
  }
})

const SERVER: AudiobookshelfServer = {
  id: 'sock-srv',
  name: 'Socket ABS',
  url: 'https://abs.sock.test',
  libraryIds: ['lib-1'],
  status: 'connected',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const ITEM_ID = 'abs-item-socket'

const REMOTE_BOOK: Book = {
  id: 'book-socket-1',
  title: 'Socket Book',
  author: 'A',
  format: 'audiobook',
  status: 'reading',
  coverUrl: '',
  tags: [],
  chapters: [],
  source: { type: 'remote', url: SERVER.url },
  totalDuration: 3600,
  progress: 5,
  currentPosition: { type: 'time', seconds: 100 },
  lastOpenedAt: '2026-01-10T10:00:00.000Z',
  createdAt: '2020-01-01T00:00:00.000Z',
  absServerId: SERVER.id,
  absItemId: ITEM_ID,
}

describe('useAudiobookshelfSocket — inbound progress', () => {
  let progressHandler: ((e: AudiobookshelfService.AbsProgressEvent) => void) | null = null

  beforeEach(() => {
    progressHandler = null
    useBookStore.setState({ books: [REMOTE_BOOK], isLoaded: true })

    vi.spyOn(AudiobookshelfService, 'connectSocket').mockImplementation((_url, _key, cbs) => {
      const fakeConn = {
        ws: null,
        isConnected: true,
        disconnect: vi.fn(),
      }
      // Defer like a real WS handshake so the effect assigns `connection` before onReady runs.
      queueMicrotask(() => {
        cbs?.onReady?.()
      })
      return fakeConn
    })
    vi.spyOn(AudiobookshelfService, 'onProgressUpdate').mockImplementation((_conn, handler) => {
      progressHandler = handler
      return () => {
        progressHandler = null
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useBookStore.setState({ books: [], isLoaded: false })
  })

  it('updates via useBookStore only when ABS is ahead (no raw Dexie, no lastOpened write)', async () => {
    const dbUpdateSpy = vi.spyOn((await import('@/db/schema')).db.books, 'update')
    const posSpy = vi.spyOn(useBookStore.getState(), 'updateBookPosition').mockResolvedValue()
    const openedSpy = vi.spyOn(useBookStore.getState(), 'updateBookLastOpenedAt').mockResolvedValue()

    renderHook(() =>
      useAudiobookshelfSocket({
        server: SERVER,
        activeItemId: ITEM_ID,
        book: REMOTE_BOOK,
        currentTime: 100,
        isPlaying: false,
      })
    )

    await waitFor(() => {
      expect(progressHandler).not.toBeNull()
    })

    progressHandler!({
      libraryItemId: ITEM_ID,
      currentTime: 500,
      duration: 3600,
      progress: 0.14,
      isFinished: false,
    })

    await waitFor(() => {
      expect(posSpy).toHaveBeenCalled()
    })

    expect(posSpy).toHaveBeenCalledWith(
      REMOTE_BOOK.id,
      { type: 'time', seconds: 500 },
      expect.any(Number),
      { suppressErrorToast: true }
    )
    expect(openedSpy).not.toHaveBeenCalled()
    expect(dbUpdateSpy).not.toHaveBeenCalled()
  })
})
