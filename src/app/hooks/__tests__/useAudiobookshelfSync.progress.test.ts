/**
 * Unit tests for ABS bulk progress overlay (`applyAbsProgressToBooks`).
 *
 * @see useAudiobookshelfSync.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AudiobookshelfServer, Book } from '@/data/types'
import { applyAbsProgressToBooks } from '@/app/hooks/useAudiobookshelfSync'
import * as AudiobookshelfService from '@/services/AudiobookshelfService'
import { useBookStore } from '@/stores/useBookStore'

const SERVER: AudiobookshelfServer = {
  id: 'srv-1',
  name: 'Test ABS',
  url: 'https://abs.test',
  libraryIds: ['lib-1'],
  status: 'connected',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function makeAbsBook(overrides: Partial<Book> = {}): Book {
  const id = 'book-local-1'
  return {
    id,
    title: 'Test Audiobook',
    author: 'Author',
    format: 'audiobook',
    status: 'reading',
    coverUrl: '',
    tags: [],
    chapters: [],
    source: { type: 'remote', url: 'https://abs.test' },
    totalDuration: 3600,
    progress: 5,
    currentPosition: { type: 'time', seconds: 180 },
    lastOpenedAt: '2020-06-01T12:00:00.000Z',
    createdAt: '2020-01-01T00:00:00.000Z',
    absServerId: SERVER.id,
    absItemId: 'abs-item-1',
    ...overrides,
  }
}

describe('applyAbsProgressToBooks', () => {
  beforeEach(() => {
    vi.spyOn(AudiobookshelfService, 'fetchAllProgress').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'mp-1',
          libraryItemId: 'abs-item-1',
          currentTime: 900,
          duration: 3600,
          progress: 0.25,
          isFinished: false,
          lastUpdate: new Date('2026-04-27T12:00:00.000Z').getTime(),
        },
      ],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useBookStore.setState({ books: [], isLoaded: false })
  })

  it('calls updateBookPosition and updateBookLastOpenedAt when ABS wins LWW', async () => {
    useBookStore.setState({ books: [makeAbsBook()], isLoaded: true })
    const posSpy = vi.spyOn(useBookStore.getState(), 'updateBookPosition').mockResolvedValue()
    const openedSpy = vi.spyOn(useBookStore.getState(), 'updateBookLastOpenedAt').mockResolvedValue()

    await applyAbsProgressToBooks(SERVER, 'api-key')

    expect(posSpy).toHaveBeenCalledTimes(1)
    expect(posSpy).toHaveBeenCalledWith(
      'book-local-1',
      { type: 'time', seconds: 900 },
      25,
      { suppressErrorToast: true }
    )
    expect(openedSpy).toHaveBeenCalledWith('book-local-1', '2026-04-27T12:00:00.000Z')
  })

  it('skips store updates when local lastOpenedAt is newer than ABS', async () => {
    useBookStore.setState({
      books: [
        makeAbsBook({
          lastOpenedAt: '2030-01-01T00:00:00.000Z',
          currentPosition: { type: 'time', seconds: 500 },
        }),
      ],
      isLoaded: true,
    })
    const posSpy = vi.spyOn(useBookStore.getState(), 'updateBookPosition').mockResolvedValue()
    const openedSpy = vi.spyOn(useBookStore.getState(), 'updateBookLastOpenedAt').mockResolvedValue()

    await applyAbsProgressToBooks(SERVER, 'api-key')

    expect(posSpy).not.toHaveBeenCalled()
    expect(openedSpy).not.toHaveBeenCalled()
  })

  it('does nothing when fetchAllProgress returns empty list', async () => {
    vi.mocked(AudiobookshelfService.fetchAllProgress).mockResolvedValue({ ok: true, data: [] })
    useBookStore.setState({ books: [makeAbsBook()], isLoaded: true })
    const posSpy = vi.spyOn(useBookStore.getState(), 'updateBookPosition').mockResolvedValue()

    await applyAbsProgressToBooks(SERVER, 'api-key')

    expect(posSpy).not.toHaveBeenCalled()
  })

  it('does nothing when fetchAllProgress fails', async () => {
    vi.mocked(AudiobookshelfService.fetchAllProgress).mockResolvedValue({
      ok: false,
      error: 'nope',
      status: 500,
    })
    useBookStore.setState({ books: [makeAbsBook()], isLoaded: true })
    const posSpy = vi.spyOn(useBookStore.getState(), 'updateBookPosition').mockResolvedValue()

    await applyAbsProgressToBooks(SERVER, 'api-key')

    expect(posSpy).not.toHaveBeenCalled()
  })

  it('skips books when progress map has no entry for absItemId', async () => {
    useBookStore.setState({
      books: [makeAbsBook({ absItemId: 'abs-item-not-in-api' })],
      isLoaded: true,
    })
    const posSpy = vi.spyOn(useBookStore.getState(), 'updateBookPosition').mockResolvedValue()

    await applyAbsProgressToBooks(SERVER, 'api-key')

    expect(posSpy).not.toHaveBeenCalled()
  })
})
