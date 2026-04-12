/**
 * Unit tests for useAudiobookshelfStore — server CRUD, series/collections loading.
 *
 * Sync queue tests are in useAudiobookshelfStore-sync.test.ts.
 * This file covers loadServers, addServer, updateServer, removeServer,
 * getServerById, loadSeries, and loadCollections.
 *
 * @since E106-S01
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import type { AudiobookshelfServer } from '@/data/types'

// Mock AudiobookshelfService
vi.mock('@/services/AudiobookshelfService', () => ({
  updateProgress: vi.fn(),
  fetchSeriesForLibrary: vi.fn(),
  fetchCollections: vi.fn(),
}))

// Mock db — inline to avoid hoisting issues with vi.mock
vi.mock('@/db/schema', () => ({
  db: {
    audiobookshelfServers: {
      toArray: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

import * as AudiobookshelfService from '@/services/AudiobookshelfService'
import { db } from '@/db/schema'
import type { MockInstance } from 'vitest'

// Cast mocked db methods to MockInstance to access Vitest mock APIs.
// vi.mocked() doesn't help here because Dexie table types don't reflect mock methods.
const mockDb = db as unknown as {
  audiobookshelfServers: {
    toArray: MockInstance
    add: MockInstance
    update: MockInstance
    delete: MockInstance
  }
}

function makeServer(overrides: Partial<AudiobookshelfServer> = {}): AudiobookshelfServer {
  return {
    id: 'srv-1',
    name: 'Test Server',
    url: 'http://abs.test',
    apiKey: 'test-key',
    libraryIds: ['lib-1'],
    status: 'connected',
    lastSyncedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset mock defaults after clearAllMocks removes them
  mockDb.audiobookshelfServers.toArray.mockResolvedValue([])
  mockDb.audiobookshelfServers.add.mockResolvedValue(undefined)
  mockDb.audiobookshelfServers.update.mockResolvedValue(1)
  mockDb.audiobookshelfServers.delete.mockResolvedValue(undefined)
  useAudiobookshelfStore.setState({
    servers: [],
    isLoaded: false,
    pendingSyncQueue: [],
    series: [],
    isLoadingSeries: false,
    seriesLoadedAt: {},
    collections: [],
    isLoadingCollections: false,
    collectionsLoadedAt: {},
  })
})

describe('initial state', () => {
  it('starts with empty servers and isLoaded false', () => {
    const state = useAudiobookshelfStore.getState()
    expect(state.servers).toEqual([])
    expect(state.isLoaded).toBe(false)
    expect(state.series).toEqual([])
    expect(state.collections).toEqual([])
  })
})

describe('loadServers', () => {
  it('loads servers from Dexie', async () => {
    const server = makeServer()
    mockDb.audiobookshelfServers.toArray.mockResolvedValueOnce([server])

    await useAudiobookshelfStore.getState().loadServers()

    const state = useAudiobookshelfStore.getState()
    expect(state.servers).toHaveLength(1)
    expect(state.servers[0].name).toBe('Test Server')
    expect(state.isLoaded).toBe(true)
  })

  it('skips loading if already loaded', async () => {
    useAudiobookshelfStore.setState({ isLoaded: true })
    mockDb.audiobookshelfServers.toArray.mockResolvedValueOnce([makeServer()])

    await useAudiobookshelfStore.getState().loadServers()

    // toArray should not be called since isLoaded is true
    expect(mockDb.audiobookshelfServers.toArray).not.toHaveBeenCalled()
  })

  it('handles DB failure gracefully', async () => {
    mockDb.audiobookshelfServers.toArray.mockReset()
    mockDb.audiobookshelfServers.toArray.mockRejectedValueOnce(new Error('DB fail'))

    await useAudiobookshelfStore.getState().loadServers()

    // Store stays empty on failure
    expect(useAudiobookshelfStore.getState().servers).toEqual([])
  })
})

describe('addServer', () => {
  it('adds server to state and Dexie', async () => {
    const server = makeServer({ id: 'new-srv' })

    await useAudiobookshelfStore.getState().addServer(server)

    const state = useAudiobookshelfStore.getState()
    expect(state.servers).toHaveLength(1)
    expect(state.servers[0].id).toBe('new-srv')
    expect(mockDb.audiobookshelfServers.add).toHaveBeenCalledWith(server)
  })

  it('throws on DB failure', async () => {
    mockDb.audiobookshelfServers.add.mockRejectedValueOnce(new Error('Add fail'))

    await expect(useAudiobookshelfStore.getState().addServer(makeServer())).rejects.toThrow(
      'Add fail'
    )

    expect(useAudiobookshelfStore.getState().servers).toHaveLength(0)
  })
})

describe('updateServer', () => {
  it('updates server in state and Dexie', async () => {
    const server = makeServer({ id: 'upd-srv' })
    useAudiobookshelfStore.setState({ servers: [server] })

    await useAudiobookshelfStore.getState().updateServer('upd-srv', { name: 'Updated Server' })

    const updated = useAudiobookshelfStore.getState().servers[0]
    expect(updated.name).toBe('Updated Server')
    expect(mockDb.audiobookshelfServers.update).toHaveBeenCalledWith('upd-srv', {
      name: 'Updated Server',
    })
  })

  it('flushes sync queue when server becomes connected', async () => {
    const server = makeServer({ id: 'srv-1', status: 'offline' })
    useAudiobookshelfStore.setState({
      servers: [server],
      pendingSyncQueue: [
        {
          serverId: 'srv-1',
          itemId: 'item-1',
          payload: { currentTime: 100, duration: 1000, progress: 0.1, isFinished: false },
          enqueuedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    vi.mocked(AudiobookshelfService.updateProgress).mockResolvedValue({
      ok: true,
      data: undefined,
    })

    await useAudiobookshelfStore.getState().updateServer('srv-1', { status: 'connected' })

    // flushSyncQueue is fire-and-forget, so we need to wait a tick
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(AudiobookshelfService.updateProgress).toHaveBeenCalled()
  })

  it('throws on DB failure', async () => {
    const server = makeServer({ id: 'fail-srv' })
    useAudiobookshelfStore.setState({ servers: [server] })
    mockDb.audiobookshelfServers.update.mockRejectedValueOnce(new Error('Update fail'))

    await expect(
      useAudiobookshelfStore.getState().updateServer('fail-srv', { name: 'X' })
    ).rejects.toThrow('Update fail')
  })
})

describe('removeServer', () => {
  it('removes server from state and Dexie', async () => {
    const server = makeServer({ id: 'rm-srv' })
    useAudiobookshelfStore.setState({ servers: [server] })

    await useAudiobookshelfStore.getState().removeServer('rm-srv')

    expect(useAudiobookshelfStore.getState().servers).toHaveLength(0)
    expect(mockDb.audiobookshelfServers.delete).toHaveBeenCalledWith('rm-srv')
  })

  it('handles DB failure gracefully', async () => {
    const server = makeServer({ id: 'fail-rm' })
    useAudiobookshelfStore.setState({ servers: [server] })
    mockDb.audiobookshelfServers.delete.mockRejectedValueOnce(new Error('Delete fail'))

    await useAudiobookshelfStore.getState().removeServer('fail-rm')

    // Server is still in state after failure (toast shown, not thrown)
    // The store catches the error and shows toast
  })
})

describe('getServerById', () => {
  it('returns server when found', () => {
    const server = makeServer({ id: 'find-me' })
    useAudiobookshelfStore.setState({ servers: [server] })

    const result = useAudiobookshelfStore.getState().getServerById('find-me')
    expect(result).toBeDefined()
    expect(result!.id).toBe('find-me')
  })

  it('returns undefined when not found', () => {
    useAudiobookshelfStore.setState({ servers: [] })

    const result = useAudiobookshelfStore.getState().getServerById('nonexistent')
    expect(result).toBeUndefined()
  })
})

describe('loadSeries', () => {
  it('loads series from Audiobookshelf service', async () => {
    const server = makeServer({ id: 'srv-1' })
    useAudiobookshelfStore.setState({ servers: [server], isLoaded: true })

    vi.mocked(AudiobookshelfService.fetchSeriesForLibrary).mockResolvedValue({
      ok: true,
      data: {
        results: [
          {
            id: 'series-1',
            name: 'Test Series',
            nameIgnorePrefix: 'Test Series',
            type: 'series' as const,
            books: [],
            totalDuration: 0,
            addedAt: 0,
            updatedAt: 0,
          },
        ],
        total: 1,
      },
    })

    await useAudiobookshelfStore.getState().loadSeries('srv-1', 'lib-1')

    const state = useAudiobookshelfStore.getState()
    expect(state.series).toHaveLength(1)
    expect(state.series[0].name).toBe('Test Series')
    expect(state.seriesLoadedAt['srv-1']).toBeGreaterThan(0)
    expect(state.isLoadingSeries).toBe(false)
  })

  it('skips if series already loaded for server', async () => {
    useAudiobookshelfStore.setState({
      servers: [makeServer()],
      seriesLoadedAt: { 'srv-1': Date.now() },
    })

    await useAudiobookshelfStore.getState().loadSeries('srv-1', 'lib-1')

    expect(AudiobookshelfService.fetchSeriesForLibrary).not.toHaveBeenCalled()
  })

  it('skips if server not found', async () => {
    useAudiobookshelfStore.setState({ servers: [] })

    await useAudiobookshelfStore.getState().loadSeries('nonexistent', 'lib-1')

    expect(AudiobookshelfService.fetchSeriesForLibrary).not.toHaveBeenCalled()
  })

  it('handles fetch failure gracefully', async () => {
    useAudiobookshelfStore.setState({ servers: [makeServer()] })

    vi.mocked(AudiobookshelfService.fetchSeriesForLibrary).mockResolvedValue({
      ok: false,
      error: 'Network error',
    })

    await useAudiobookshelfStore.getState().loadSeries('srv-1', 'lib-1')

    expect(useAudiobookshelfStore.getState().series).toHaveLength(0)
    expect(useAudiobookshelfStore.getState().isLoadingSeries).toBe(false)
  })

  it('paginates through multiple pages', async () => {
    useAudiobookshelfStore.setState({ servers: [makeServer()] })

    vi.mocked(AudiobookshelfService.fetchSeriesForLibrary)
      .mockResolvedValueOnce({
        ok: true,
        data: {
          results: Array.from({ length: 50 }, (_, i) => ({
            id: `s-${i}`,
            name: `Series ${i}`,
            nameIgnorePrefix: `Series ${i}`,
            type: 'series' as const,
            books: [],
            totalDuration: 0,
            addedAt: 0,
            updatedAt: 0,
          })),
          total: 75,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          results: Array.from({ length: 25 }, (_, i) => ({
            id: `s-${50 + i}`,
            name: `Series ${50 + i}`,
            nameIgnorePrefix: `Series ${50 + i}`,
            type: 'series' as const,
            books: [],
            totalDuration: 0,
            addedAt: 0,
            updatedAt: 0,
          })),
          total: 75,
        },
      })

    await useAudiobookshelfStore.getState().loadSeries('srv-1', 'lib-1')

    expect(useAudiobookshelfStore.getState().series).toHaveLength(75)
    expect(AudiobookshelfService.fetchSeriesForLibrary).toHaveBeenCalledTimes(2)
  })
})

describe('loadCollections', () => {
  it('loads collections from Audiobookshelf service', async () => {
    useAudiobookshelfStore.setState({ servers: [makeServer()] })

    vi.mocked(AudiobookshelfService.fetchCollections).mockResolvedValue({
      ok: true,
      data: {
        results: [
          { id: 'col-1', name: 'Favorites', description: '', books: [], libraryId: 'lib-1' },
        ],
        total: 1,
      },
    })

    await useAudiobookshelfStore.getState().loadCollections('srv-1')

    const state = useAudiobookshelfStore.getState()
    expect(state.collections).toHaveLength(1)
    expect(state.collections[0].name).toBe('Favorites')
    expect(state.collectionsLoadedAt['srv-1']).toBeGreaterThan(0)
  })

  it('skips if collections already loaded', async () => {
    useAudiobookshelfStore.setState({
      servers: [makeServer()],
      collectionsLoadedAt: { 'srv-1': Date.now() },
    })

    await useAudiobookshelfStore.getState().loadCollections('srv-1')

    expect(AudiobookshelfService.fetchCollections).not.toHaveBeenCalled()
  })

  it('skips if server not found', async () => {
    useAudiobookshelfStore.setState({ servers: [] })

    await useAudiobookshelfStore.getState().loadCollections('nonexistent')

    expect(AudiobookshelfService.fetchCollections).not.toHaveBeenCalled()
  })

  it('handles fetch failure gracefully', async () => {
    useAudiobookshelfStore.setState({ servers: [makeServer()] })

    vi.mocked(AudiobookshelfService.fetchCollections).mockResolvedValue({
      ok: false,
      error: 'Server down',
    })

    await useAudiobookshelfStore.getState().loadCollections('srv-1')

    expect(useAudiobookshelfStore.getState().collections).toHaveLength(0)
    expect(useAudiobookshelfStore.getState().isLoadingCollections).toBe(false)
  })

  it('handles thrown exception gracefully', async () => {
    useAudiobookshelfStore.setState({ servers: [makeServer()] })

    vi.mocked(AudiobookshelfService.fetchCollections).mockRejectedValue(new Error('Network error'))

    await useAudiobookshelfStore.getState().loadCollections('srv-1')

    expect(useAudiobookshelfStore.getState().isLoadingCollections).toBe(false)
  })
})
