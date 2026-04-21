/**
 * e96-s03-ai-usage-events-sync.test.ts — E96-S03 integration test for the
 * aiUsageEvents table.
 *
 * Locks the contract that:
 *   - `trackAIUsage` on success enqueues exactly one `syncQueue` row with
 *     `op: 'add'` and the event payload in `record`.
 *   - `trackAIUsage` on failure (`status: 'error'`) enqueues exactly one row
 *     carrying the error metadata.
 *   - When analytics consent is disabled the call is a no-op — zero Dexie
 *     writes, zero queue rows.
 *   - A simulated internal syncableWrite failure does NOT throw out of the
 *     call site — `trackAIUsage` remains fire-and-forget (R6).
 *
 * Pattern reference: `p4-insert-only-sync.test.ts`.
 *
 * @module e96-s03-ai-usage-events-sync
 * @since E96-S03
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { AIUsageEvent } from '@/data/types'

let useAuthStore: (typeof import('@/stores/useAuthStore'))['useAuthStore']
let trackAIUsage: (typeof import('@/lib/aiEventTracking'))['trackAIUsage']
let db: (typeof import('@/db'))['db']

const TEST_USER_ID = 'user-e96-s03-ai'

async function getQueueEntries(table: string) {
  const queue = await db.syncQueue.toArray()
  return queue.filter(q => q.tableName === table)
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  localStorage.clear()

  const authMod = await import('@/stores/useAuthStore')
  useAuthStore = authMod.useAuthStore
  useAuthStore.setState({
    user: { id: TEST_USER_ID, email: 's03-ai@example.com' },
  } as Partial<ReturnType<typeof useAuthStore.getState>>)

  const trackMod = await import('@/lib/aiEventTracking')
  trackAIUsage = trackMod.trackAIUsage

  const dbMod = await import('@/db')
  db = dbMod.db
})

describe('E96-S03 — aiUsageEvents sync contract', () => {
  it('success path: trackAIUsage enqueues one add row with the event payload', async () => {
    await trackAIUsage('summary', {
      courseId: 'course-s03',
      durationMs: 250,
      status: 'success',
      metadata: { tokens: 42 },
    })

    const events = (await db.aiUsageEvents.toArray()) as unknown as AIUsageEvent[]
    expect(events).toHaveLength(1)
    expect(events[0].featureType).toBe('summary')
    expect(events[0].status).toBe('success')

    const entries = await getQueueEntries('aiUsageEvents')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('add')
    expect(entries[0].recordId).toBe(events[0].id)
    const payload = entries[0].payload as unknown as Record<string, unknown>
    expect(payload.feature_type ?? payload.featureType).toBe('summary')
  })

  it('error path: trackAIUsage with status error enqueues one add row with error metadata', async () => {
    await trackAIUsage('qa', {
      status: 'error',
      durationMs: 10,
      metadata: { errorCode: 'timeout' },
    })

    const events = (await db.aiUsageEvents.toArray()) as unknown as AIUsageEvent[]
    expect(events).toHaveLength(1)
    expect(events[0].status).toBe('error')
    expect(events[0].metadata?.errorCode).toBe('timeout')

    const entries = await getQueueEntries('aiUsageEvents')
    expect(entries).toHaveLength(1)
    expect(entries[0].operation).toBe('add')
  })

  it('analytics disabled: trackAIUsage is a no-op (zero Dexie rows, zero queue rows)', async () => {
    // isFeatureEnabled('analytics') defaults to enabled; explicitly disable.
    localStorage.setItem(
      'ai-configuration',
      JSON.stringify({ consentSettings: { analytics: false } })
    )
    vi.resetModules()
    const trackMod2 = await import('@/lib/aiEventTracking')

    await trackMod2.trackAIUsage('summary', { durationMs: 10 })

    const events = await db.aiUsageEvents.toArray()
    expect(events).toHaveLength(0)

    const entries = await getQueueEntries('aiUsageEvents')
    expect(entries).toHaveLength(0)
  })

  it('fire-and-forget contract: a syncableWrite failure does not throw out of trackAIUsage', async () => {
    vi.resetModules()
    vi.doMock('@/lib/sync/syncableWrite', () => ({
      syncableWrite: vi.fn().mockRejectedValue(new Error('sim boom')),
    }))
    const trackMod2 = await import('@/lib/aiEventTracking')

    await expect(trackMod2.trackAIUsage('summary', { durationMs: 1 })).resolves.toBeUndefined()

    vi.doUnmock('@/lib/sync/syncableWrite')
  })
})
