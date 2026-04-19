/**
 * Unit tests for useAudiobookshelfStore — CRUD + vault routing (E95-S05).
 *
 * Uses fake-indexeddb + the real `syncableWrite` path so test coverage
 * captures the "credential never enters the queue payload" invariant.
 *
 * @since E106-S01
 * @modified E95-S05 — routed through syncableWrite, apiKey out-of-band param
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Dexie from 'dexie'
import type { AudiobookshelfServer } from '@/data/types'

const {
  storeMock,
  deleteMock,
  readMock,
  readStatusMock,
  refreshMock,
  fetchCollectionsMock,
  fetchSeriesMock,
  updateProgressMock,
} = vi.hoisted(() => ({
  storeMock: vi.fn(),
  deleteMock: vi.fn(),
  readMock: vi.fn().mockResolvedValue(null),
  readStatusMock: vi.fn().mockResolvedValue({ ok: true, value: null }),
  refreshMock: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  fetchCollectionsMock: vi.fn(),
  fetchSeriesMock: vi.fn(),
  updateProgressMock: vi.fn(),
}))

vi.mock('@/lib/vaultCredentials', () => ({
  storeCredential: storeMock,
  deleteCredential: deleteMock,
  readCredential: readMock,
  readCredentialWithStatus: readStatusMock,
}))

vi.mock('@/lib/auth/supabase', () => ({
  supabase: { auth: { refreshSession: refreshMock } },
}))

vi.mock('@/services/AudiobookshelfService', () => ({
  fetchCollections: fetchCollectionsMock,
  fetchSeriesForLibrary: fetchSeriesMock,
  updateProgress: updateProgressMock,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

// Silence sync engine — it's not the subject under test.
vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: { nudge: vi.fn(), start: vi.fn(), stop: vi.fn() },
}))

let useAudiobookshelfStore: (typeof import(
  '@/stores/useAudiobookshelfStore'
))['useAudiobookshelfStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER = 'user-e95-s05-abs'

function makeServer(overrides: Partial<AudiobookshelfServer> = {}): AudiobookshelfServer {
  return {
    id: 'srv-1',
    name: 'Test Server',
    url: 'http://abs.test',
    libraryIds: ['lib-1'],
    status: 'connected',
    lastSyncedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  storeMock.mockReset().mockResolvedValue(undefined)
  deleteMock.mockReset().mockResolvedValue(undefined)
  readMock.mockReset().mockResolvedValue(null)
  readStatusMock.mockReset().mockResolvedValue({ ok: true, value: null })
  fetchCollectionsMock.mockReset()
  fetchSeriesMock.mockReset()
  updateProgressMock.mockReset()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  useAuthStore.setState({
    user: { id: TEST_USER } as unknown as (typeof useAuthStore)['getState'] extends () => infer S
      ? S extends { user: infer U }
        ? U
        : never
      : never,
  })

  const schemaMod = await import('@/db')
  db = schemaMod.db

  const mod = await import('@/stores/useAudiobookshelfStore')
  useAudiobookshelfStore = mod.useAudiobookshelfStore
})

async function getQueuePayload(recordId: string) {
  const queue = await db.syncQueue.toArray()
  const entry = queue.find(
    q => q.tableName === 'audiobookshelfServers' && q.recordId === recordId,
  )
  return entry?.payload as Record<string, unknown> | undefined
}

describe('addServer', () => {
  it('awaits vault write first, then enqueues sync with no apiKey in payload', async () => {
    const server = makeServer({ id: 'new-srv' })
    await useAudiobookshelfStore.getState().addServer(server, 'K-NEW')

    expect(storeMock).toHaveBeenCalledWith('abs-server', 'new-srv', 'K-NEW')
    const payload = await getQueuePayload('new-srv')
    expect(payload).toBeDefined()
    // No apiKey / api_key at any casing level.
    expect(Object.keys(payload!).some(k => /api[_-]?key/i.test(k))).toBe(false)
    const state = useAudiobookshelfStore.getState()
    expect(state.servers).toHaveLength(1)
    // The row surfaced in state has no apiKey either — the type drops it.
    expect((state.servers[0] as unknown as { apiKey?: unknown }).apiKey).toBeUndefined()
  })

  it('surfaces error and does NOT enqueue when metadata write fails', async () => {
    const server = makeServer({ id: 'broken-srv' })
    // Seed a duplicate so syncableWrite('add') throws on Dexie add().
    await db.audiobookshelfServers.put({ ...server })

    await expect(
      useAudiobookshelfStore.getState().addServer(server, 'K'),
    ).rejects.toBeTruthy()

    // Vault was still called (write-first ordering).
    expect(storeMock).toHaveBeenCalledWith('abs-server', 'broken-srv', 'K')
    // No queue entry for the failed write.
    const payload = await getQueuePayload('broken-srv')
    expect(payload).toBeUndefined()
  })
})

describe('updateServer', () => {
  it('stores new apiKey in vault only when provided and omits it from the queue payload', async () => {
    const server = makeServer({ id: 'upd-srv' })
    await db.audiobookshelfServers.put(server)
    useAudiobookshelfStore.setState({ servers: [server], isLoaded: true })

    await useAudiobookshelfStore
      .getState()
      .updateServer('upd-srv', { name: 'Renamed' }, 'K-ROT')

    expect(storeMock).toHaveBeenCalledWith('abs-server', 'upd-srv', 'K-ROT')
    const payload = await getQueuePayload('upd-srv')
    expect(payload).toBeDefined()
    expect(Object.keys(payload!).some(k => /api[_-]?key/i.test(k))).toBe(false)
    expect(payload!['name']).toBe('Renamed')
  })

  it('does NOT call storeCredential when apiKey is omitted', async () => {
    const server = makeServer({ id: 'upd-srv' })
    await db.audiobookshelfServers.put(server)
    useAudiobookshelfStore.setState({ servers: [server], isLoaded: true })

    await useAudiobookshelfStore.getState().updateServer('upd-srv', { name: 'Rename only' })

    expect(storeMock).not.toHaveBeenCalled()
    const payload = await getQueuePayload('upd-srv')
    expect(payload!['name']).toBe('Rename only')
  })
})

describe('removeServer', () => {
  it('deletes via syncableWrite and fires vault deleteCredential', async () => {
    const server = makeServer({ id: 'rm-srv' })
    await db.audiobookshelfServers.put(server)
    useAudiobookshelfStore.setState({ servers: [server], isLoaded: true })

    await useAudiobookshelfStore.getState().removeServer('rm-srv')

    expect(useAudiobookshelfStore.getState().servers).toHaveLength(0)
    // Queue entry is the delete op; payload is `{ id }` only — no credential.
    const queue = await db.syncQueue.toArray()
    const entry = queue.find(q => q.tableName === 'audiobookshelfServers' && q.recordId === 'rm-srv')
    expect(entry?.operation).toBe('delete')
    expect(entry?.payload).toEqual({ id: 'rm-srv' })

    // Allow the fire-and-forget deleteCredential to run.
    await Promise.resolve()
    expect(deleteMock).toHaveBeenCalledWith('abs-server', 'rm-srv')
  })
})
