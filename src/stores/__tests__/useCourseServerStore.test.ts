/**
 * Unit tests for useCourseServerStore — status sanitization on load (KI-bugfix).
 *
 * Verifies that loadServers() normalizes records with unrecognized status
 * values to 'unknown' so the StatusIndicator in CourseServerSettings never
 * receives an unexpected status value and crashes with "Cannot read properties
 * of undefined (reading 'Icon')".
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Dexie from 'dexie'
import type { CourseServer } from '@/data/types'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { storeCredentialMock, deleteCredentialMock, readCredentialMock, refreshMock } = vi.hoisted(
  () => ({
    storeCredentialMock: vi.fn().mockResolvedValue(undefined),
    deleteCredentialMock: vi.fn().mockResolvedValue(undefined),
    readCredentialMock: vi.fn().mockResolvedValue(null),
    refreshMock: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  })
)

vi.mock('@/lib/vaultCredentials', () => ({
  storeCredential: storeCredentialMock,
  storeCredentialWithStatus: vi.fn().mockResolvedValue({ ok: true }),
  deleteCredential: deleteCredentialMock,
  readCredential: readCredentialMock,
}))

vi.mock('@/lib/auth/supabase', () => ({
  supabase: { auth: { refreshSession: refreshMock } },
}))

vi.mock('@/lib/courseServerService', () => ({
  verifyConnection: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/credentials/courseServerTokenResolver', () => ({
  getCourseServerToken: vi.fn().mockResolvedValue(null),
  invalidateCourseServerToken: vi.fn(),
}))

vi.mock('@/lib/credentials/telemetry', () => ({
  emitTelemetry: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

// Silence sync engine — it's not the subject under test.
vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: { nudge: vi.fn(), start: vi.fn(), stop: vi.fn() },
}))

let useCourseServerStore: (typeof import('@/stores/useCourseServerStore'))['useCourseServerStore']
let db: (typeof import('@/db/schema'))['db']

function makeServer(overrides: Partial<CourseServer> = {}): CourseServer {
  return {
    id: 'srv-1',
    name: 'Test Server',
    url: 'https://example.com',
    status: 'unknown',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  vi.clearAllMocks()

  const storeMod = await import('@/stores/useCourseServerStore')
  useCourseServerStore = storeMod.useCourseServerStore

  const dbMod = await import('@/db/schema')
  db = dbMod.db
})

// ---------------------------------------------------------------------------
// loadServers status sanitization tests
// ---------------------------------------------------------------------------

describe('useCourseServerStore.loadServers', () => {
  it('loads servers with valid statuses unchanged', async () => {
    const valid = makeServer({ id: 'srv-1', status: 'connected' })
    await db.courseServers.put(valid as any)

    await useCourseServerStore.getState().loadServers()

    const { servers } = useCourseServerStore.getState()
    expect(servers).toHaveLength(1)
    expect(servers[0].status).toBe('connected')
  })

  it('normalizes unrecognized status string to "unknown"', async () => {
    // Simulate corrupted Dexie data with a status not in the allowed union
    const broken = makeServer({
      id: 'srv-broken',
      status: 'not-a-real-status' as CourseServer['status'],
    })
    await db.courseServers.put(broken as any)

    await useCourseServerStore.getState().loadServers()

    const { servers } = useCourseServerStore.getState()
    expect(servers).toHaveLength(1)
    expect(servers[0].status).toBe('unknown')
  })

  it('normalizes empty string status to "unknown"', async () => {
    const broken = makeServer({
      id: 'srv-empty',
      status: '' as CourseServer['status'],
    })
    await db.courseServers.put(broken as any)

    await useCourseServerStore.getState().loadServers()

    const { servers } = useCourseServerStore.getState()
    expect(servers).toHaveLength(1)
    expect(servers[0].status).toBe('unknown')
  })

  it('normalizes missing/undefined status to "unknown"', async () => {
    // Put a raw object without the status field (simulates schema migration gap)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.courseServers.put({
      id: 'srv-no-status',
      name: 'Missing Status',
      url: 'https://example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as any)

    await useCourseServerStore.getState().loadServers()

    const { servers } = useCourseServerStore.getState()
    expect(servers).toHaveLength(1)
    expect(servers[0].status).toBe('unknown')
  })

  it('loads all four valid statuses unchanged', async () => {
    const validStatuses: CourseServer['status'][] = [
      'connected',
      'offline',
      'auth-failed',
      'unknown',
    ]
    for (const [i, status] of validStatuses.entries()) {
      await db.courseServers.put(makeServer({ id: `srv-${i}`, status }) as any)
    }

    await useCourseServerStore.getState().loadServers()

    const { servers } = useCourseServerStore.getState()
    expect(servers).toHaveLength(4)
    const statuses = servers.map(s => s.status)
    expect(statuses).toEqual(validStatuses)
  })

  it('only loads once (isLoaded guard)', async () => {
    const valid = makeServer({ id: 'srv-1', status: 'connected' })
    await db.courseServers.put(valid as any)

    await useCourseServerStore.getState().loadServers()
    // Add another server directly to Dexie — should not be picked up
    const second = makeServer({ id: 'srv-2', status: 'offline' })
    await db.courseServers.put(second as any)

    await useCourseServerStore.getState().loadServers()

    const { servers } = useCourseServerStore.getState()
    expect(servers).toHaveLength(1) // Still only the first load
  })
})
