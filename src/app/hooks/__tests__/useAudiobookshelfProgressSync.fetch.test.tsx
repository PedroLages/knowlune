/**
 * Fetch-on-open path: ABS-ahead uses useBookStore (plan U3) — no Dexie-only writes.
 *
 * @see useAudiobookshelfProgressSync.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAudiobookshelfProgressSync } from '@/app/hooks/useAudiobookshelfProgressSync'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { useBookStore } from '@/stores/useBookStore'
import * as AudiobookshelfService from '@/services/AudiobookshelfService'
import { getAbsApiKey } from '@/lib/credentials/absApiKeyResolver'
import type { AudiobookshelfServer, Book } from '@/data/types'

vi.mock('@/lib/credentials/absApiKeyResolver', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/credentials/absApiKeyResolver')>()
  return {
    ...actual,
    getAbsApiKey: vi.fn(),
  }
})

const SERVER: AudiobookshelfServer = {
  id: 'prog-srv',
  name: 'P ABS',
  url: 'https://abs.prog.test',
  libraryIds: ['lib-1'],
  status: 'connected',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const REMOTE_BOOK: Book = {
  id: 'book-abs-fetch',
  title: 'Remote AB',
  author: 'A',
  format: 'audiobook',
  status: 'reading',
  coverUrl: '',
  tags: [],
  chapters: [],
  source: { type: 'remote', url: SERVER.url },
  totalDuration: 3600,
  progress: 10,
  currentPosition: { type: 'time', seconds: 360 },
  lastOpenedAt: '2020-01-15T10:00:00.000Z',
  createdAt: '2020-01-01T00:00:00.000Z',
  absServerId: SERVER.id,
  absItemId: 'abs-item-99',
}

describe('useAudiobookshelfProgressSync — fetch-on-open', () => {
  beforeEach(() => {
    useAudiobookshelfStore.setState({ servers: [SERVER], isLoaded: true })
    vi.mocked(getAbsApiKey).mockResolvedValue('key')
    vi.spyOn(AudiobookshelfService, 'fetchProgress').mockResolvedValue({
      ok: true,
      data: {
        id: 'mp-1',
        libraryItemId: 'abs-item-99',
        currentTime: 1800,
        duration: 3600,
        progress: 0.5,
        isFinished: false,
        lastUpdate: new Date('2030-01-01T00:00:00.000Z').getTime(),
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useAudiobookshelfStore.setState({ servers: [], isLoaded: false })
    useBookStore.setState({ books: [], isLoaded: false })
  })

  it('when ABS is ahead, updates via useBookStore (not raw Dexie)', async () => {
    const dbUpdateSpy = vi.spyOn((await import('@/db/schema')).db.books, 'update')
    const posSpy = vi.spyOn(useBookStore.getState(), 'updateBookPosition').mockResolvedValue()
    const openedSpy = vi.spyOn(useBookStore.getState(), 'updateBookLastOpenedAt').mockResolvedValue()
    const seekTo = vi.fn()

    renderHook(() =>
      useAudiobookshelfProgressSync({
        book: REMOTE_BOOK,
        isPlaying: false,
        currentTime: 0,
        seekTo,
      })
    )

    await waitFor(() => {
      expect(posSpy).toHaveBeenCalled()
    })
    expect(openedSpy).toHaveBeenCalled()
    expect(seekTo).toHaveBeenCalledWith(1800)
    expect(dbUpdateSpy).not.toHaveBeenCalled()
  })

  it('retries fetch when ABS server hydrates after mount', async () => {
    useAudiobookshelfStore.setState({ servers: [], isLoaded: false })
    const fetchSpy = vi.spyOn(AudiobookshelfService, 'fetchProgress')
    const seekTo = vi.fn()

    renderHook(() =>
      useAudiobookshelfProgressSync({
        book: REMOTE_BOOK,
        isPlaying: false,
        currentTime: 0,
        seekTo,
      })
    )

    expect(fetchSpy).not.toHaveBeenCalled()

    await act(async () => {
      useAudiobookshelfStore.setState({ servers: [SERVER], isLoaded: true })
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })
})
