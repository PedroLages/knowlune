/**
 * End-to-end defense-in-depth: confirm `syncableWrite` drops vault fields
 * from the enqueued payload even when a caller casts around the type system.
 *
 * These mirror the `tableRegistry-e95-s05.test.ts` cases but exercise the
 * real queue insert path rather than the `toSnakeCase` helper in isolation.
 *
 * @since E95-S05
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: { nudge: vi.fn(), start: vi.fn(), stop: vi.fn() },
}))

let syncableWrite: typeof import('@/lib/sync/syncableWrite')['syncableWrite']
let useAuthStore: typeof import('@/stores/useAuthStore')['useAuthStore']
let db: typeof import('@/db')['db']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  useAuthStore.setState({
    user: { id: 'user-vault-defense' } as unknown as (typeof useAuthStore)['getState'] extends () => infer S
      ? S extends { user: infer U }
        ? U
        : never
      : never,
  })
  db = (await import('@/db')).db
  syncableWrite = (await import('@/lib/sync/syncableWrite')).syncableWrite
})

describe('syncableWrite — vault defense', () => {
  it('audiobookshelfServers: queue entry never carries apiKey at any depth', async () => {
    const leaky = {
      id: 'srv-leak',
      name: 'Home',
      url: 'http://abs.test',
      libraryIds: ['lib-1'],
      status: 'connected',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      apiKey: 'LEAK-ABS',
    } as unknown as Record<string, unknown>

    await syncableWrite('audiobookshelfServers', 'add', leaky)

    const entries = await db.syncQueue.toArray()
    const entry = entries.find(e => e.tableName === 'audiobookshelfServers')
    expect(entry).toBeDefined()
    expect(JSON.stringify(entry!.payload)).not.toMatch(/LEAK-ABS/)
    expect(JSON.stringify(entry!.payload)).not.toMatch(/api[_-]?key/i)
  })

  it('opdsCatalogs: queue entry never carries password at any depth', async () => {
    const leaky = {
      id: 'cat-leak',
      name: 'Library',
      url: 'https://calibre.local/opds',
      createdAt: '2026-01-01T00:00:00.000Z',
      password: 'LEAK-OPDS',
      authUsername: 'u',
    } as unknown as Record<string, unknown>

    await syncableWrite('opdsCatalogs', 'add', leaky)

    const entries = await db.syncQueue.toArray()
    const entry = entries.find(e => e.tableName === 'opdsCatalogs')
    expect(entry).toBeDefined()
    expect(JSON.stringify(entry!.payload)).not.toMatch(/LEAK-OPDS/)
    expect(entry!.payload).not.toHaveProperty('password')
    // Confirms the flat field survives when properly supplied.
    expect(entry!.payload['auth_username']).toBe('u')
  })
})
