/**
 * Unit tests for useOpdsCatalogStore — CRUD + vault routing + nested-auth
 * flatten (E95-S05).
 *
 * @since E88-S01
 * @modified E95-S05 — syncableWrite routing + password out-of-band param +
 *           `auth.username` → top-level `authUsername` sync payload projection
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { OpdsCatalog } from '@/data/types'

const { storeMock, deleteMock } = vi.hoisted(() => ({
  storeMock: vi.fn().mockResolvedValue(undefined),
  deleteMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/vaultCredentials', () => ({
  storeCredential: storeMock,
  deleteCredential: deleteMock,
  readCredential: vi.fn().mockResolvedValue(null),
  readCredentialWithStatus: vi.fn().mockResolvedValue({ ok: true, value: null }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: { nudge: vi.fn(), start: vi.fn(), stop: vi.fn() },
}))

let useOpdsCatalogStore: (typeof import('@/stores/useOpdsCatalogStore'))['useOpdsCatalogStore']
let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let db: (typeof import('@/db'))['db']

const TEST_USER = 'user-e95-s05-opds'

function makeCatalog(overrides: Partial<OpdsCatalog> = {}): OpdsCatalog {
  return {
    id: crypto.randomUUID(),
    name: 'Test Catalog',
    url: 'https://calibre.local/opds',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  storeMock.mockReset().mockResolvedValue(undefined)
  deleteMock.mockReset().mockResolvedValue(undefined)

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
  const mod = await import('@/stores/useOpdsCatalogStore')
  useOpdsCatalogStore = mod.useOpdsCatalogStore
})

async function getQueuePayload(catalogId: string) {
  const queue = await db.syncQueue.toArray()
  const entry = queue.find(q => q.tableName === 'opdsCatalogs' && q.recordId === catalogId)
  return { entry, payload: entry?.payload as Record<string, unknown> | undefined }
}

describe('initial state', () => {
  it('starts with empty catalogs array', () => {
    const state = useOpdsCatalogStore.getState()
    expect(state.catalogs).toEqual([])
    expect(state.isLoaded).toBe(false)
  })
})

describe('addCatalog', () => {
  it('awaits vault write then writes a flat authUsername payload with no password', async () => {
    const id = 'cat-1'
    const catalog = makeCatalog({ id, auth: { username: 'user' } })
    await act(async () => {
      await useOpdsCatalogStore.getState().addCatalog(catalog, 'SECRET')
    })

    expect(storeMock).toHaveBeenCalledWith('opds-catalog', id, 'SECRET')
    const { payload } = await getQueuePayload(id)
    expect(payload).toBeDefined()
    // Flat field present, nested auth absent.
    expect(payload!['auth_username']).toBe('user')
    expect(payload).not.toHaveProperty('auth')
    // No password survives at any nesting depth.
    expect(JSON.stringify(payload)).not.toMatch(/SECRET/)
  })

  it('persists the nested auth shape to Dexie even though the queue is flat', async () => {
    const id = 'cat-nested'
    const catalog = makeCatalog({ id, auth: { username: 'u' } })
    await act(async () => {
      await useOpdsCatalogStore.getState().addCatalog(catalog, 'pw')
    })
    const stored = (await db.opdsCatalogs.get(id)) as unknown as Record<string, unknown>
    expect(stored.auth).toEqual({ username: 'u' })
    // The flat authUsername field never leaks into the Dexie row.
    expect(stored.authUsername).toBeUndefined()
  })

  it('skips storeCredential for anonymous catalogs', async () => {
    const catalog = makeCatalog({ id: 'anon', auth: undefined })
    await act(async () => {
      await useOpdsCatalogStore.getState().addCatalog(catalog)
    })
    expect(storeMock).not.toHaveBeenCalled()
    const { payload } = await getQueuePayload('anon')
    expect(payload).toBeDefined()
  })
})

describe('updateCatalog', () => {
  it('rotates the vault credential only when password is supplied', async () => {
    const id = 'upd-cat'
    const catalog = makeCatalog({ id, auth: { username: 'u' } })
    await db.opdsCatalogs.put(catalog)
    useOpdsCatalogStore.setState({ catalogs: [catalog], isLoaded: true })

    await act(async () => {
      await useOpdsCatalogStore.getState().updateCatalog(id, { name: 'Renamed' })
    })
    expect(storeMock).not.toHaveBeenCalled()

    await act(async () => {
      await useOpdsCatalogStore
        .getState()
        .updateCatalog(id, { name: 'Renamed again' }, 'new-pw')
    })
    expect(storeMock).toHaveBeenCalledWith('opds-catalog', id, 'new-pw')
  })
})

describe('removeCatalog', () => {
  it('enqueues a delete via syncableWrite and fires vault deleteCredential', async () => {
    const id = 'rm-cat'
    const catalog = makeCatalog({ id })
    await db.opdsCatalogs.put(catalog)
    useOpdsCatalogStore.setState({ catalogs: [catalog], isLoaded: true })

    await act(async () => {
      await useOpdsCatalogStore.getState().removeCatalog(id)
    })

    expect(useOpdsCatalogStore.getState().catalogs).toHaveLength(0)
    const { entry } = await getQueuePayload(id)
    expect(entry?.operation).toBe('delete')
    expect(entry?.payload).toEqual({ id })
    await Promise.resolve()
    expect(deleteMock).toHaveBeenCalledWith('opds-catalog', id)
  })
})
