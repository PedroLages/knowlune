/**
 * Unit tests for E102-S01: Sync queue in useAudiobookshelfStore.
 *
 * Tests enqueueSyncItem, flushSyncQueue, and dedup behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'

// Mock AudiobookshelfService to avoid real fetch calls
vi.mock('@/services/AudiobookshelfService', () => ({
  updateProgress: vi.fn(),
}))

// Mock db to avoid Dexie in unit tests
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

const PAYLOAD = { currentTime: 2700, duration: 36000, progress: 0.075, isFinished: false }

beforeEach(() => {
  // Reset store state
  useAudiobookshelfStore.setState({
    servers: [
      {
        id: 'srv-1',
        name: 'Test',
        url: 'http://abs.test',
        apiKey: 'key',
        libraryIds: ['lib-1'],
        status: 'connected',
        lastSyncedAt: '2025-01-01T00:00:00.000Z',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ],
    isLoaded: true,
    pendingSyncQueue: [],
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('enqueueSyncItem', () => {
  it('adds item to the pending sync queue', () => {
    useAudiobookshelfStore.getState().enqueueSyncItem({
      serverId: 'srv-1',
      itemId: 'item-1',
      payload: PAYLOAD,
    })

    const queue = useAudiobookshelfStore.getState().pendingSyncQueue
    expect(queue).toHaveLength(1)
    expect(queue[0].itemId).toBe('item-1')
    expect(queue[0].payload).toEqual(PAYLOAD)
    expect(queue[0].enqueuedAt).toBeTruthy()
  })

  it('replaces existing entry for the same itemId (dedup)', () => {
    const store = useAudiobookshelfStore.getState()

    store.enqueueSyncItem({ serverId: 'srv-1', itemId: 'item-1', payload: PAYLOAD })
    store.enqueueSyncItem({
      serverId: 'srv-1',
      itemId: 'item-1',
      payload: { ...PAYLOAD, currentTime: 5000 },
    })

    const queue = useAudiobookshelfStore.getState().pendingSyncQueue
    expect(queue).toHaveLength(1)
    expect(queue[0].payload.currentTime).toBe(5000)
  })

  it('keeps separate entries for different itemIds', () => {
    const store = useAudiobookshelfStore.getState()

    store.enqueueSyncItem({ serverId: 'srv-1', itemId: 'item-1', payload: PAYLOAD })
    store.enqueueSyncItem({ serverId: 'srv-1', itemId: 'item-2', payload: PAYLOAD })

    expect(useAudiobookshelfStore.getState().pendingSyncQueue).toHaveLength(2)
  })
})

describe('flushSyncQueue', () => {
  it('drains queue on successful push', async () => {
    vi.mocked(AudiobookshelfService.updateProgress).mockResolvedValue({ ok: true, data: undefined })

    useAudiobookshelfStore.getState().enqueueSyncItem({
      serverId: 'srv-1',
      itemId: 'item-1',
      payload: PAYLOAD,
    })

    await useAudiobookshelfStore.getState().flushSyncQueue()

    expect(useAudiobookshelfStore.getState().pendingSyncQueue).toHaveLength(0)
    expect(AudiobookshelfService.updateProgress).toHaveBeenCalledWith(
      'http://abs.test',
      'key',
      'item-1',
      PAYLOAD
    )
  })

  it('keeps items in queue on failed push', async () => {
    vi.mocked(AudiobookshelfService.updateProgress).mockResolvedValue({
      ok: false,
      error: 'Server offline',
    })

    useAudiobookshelfStore.getState().enqueueSyncItem({
      serverId: 'srv-1',
      itemId: 'item-1',
      payload: PAYLOAD,
    })

    await useAudiobookshelfStore.getState().flushSyncQueue()

    expect(useAudiobookshelfStore.getState().pendingSyncQueue).toHaveLength(1)
  })

  it('discards items for removed servers', async () => {
    useAudiobookshelfStore.getState().enqueueSyncItem({
      serverId: 'srv-deleted',
      itemId: 'item-1',
      payload: PAYLOAD,
    })

    await useAudiobookshelfStore.getState().flushSyncQueue()

    expect(useAudiobookshelfStore.getState().pendingSyncQueue).toHaveLength(0)
    expect(AudiobookshelfService.updateProgress).not.toHaveBeenCalled()
  })

  it('does nothing when queue is empty', async () => {
    await useAudiobookshelfStore.getState().flushSyncQueue()

    expect(AudiobookshelfService.updateProgress).not.toHaveBeenCalled()
  })
})
