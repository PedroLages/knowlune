import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dexie from 'dexie'

const FIXED_DATE = '2026-08-08T00:00:00.000Z'

const mocks = vi.hoisted(() => ({
  fullSync: vi.fn(),
  retryFailed: vi.fn().mockResolvedValue(0),
  setUser: vi.fn(),
  stop: vi.fn(),
  setStatus: vi.fn(),
  setFailures: vi.fn(),
  markSyncComplete: vi.fn(),
  refreshPendingCount: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: {
    fullSync: mocks.fullSync,
    retryFailed: mocks.retryFailed,
    setUser: mocks.setUser,
    stop: mocks.stop,
  },
}))

vi.mock('@/app/stores/useSyncStatusStore', () => ({
  useSyncStatusStore: {
    getState: () => ({
      setStatus: mocks.setStatus,
      setFailures: mocks.setFailures,
      markSyncComplete: mocks.markSyncComplete,
      refreshPendingCount: mocks.refreshPendingCount,
    }),
  },
}))

import { db } from '@/db'
import { __resetSyncCoordinatorForTests, syncCoordinator } from '../syncCoordinator'

function completeResult() {
  return {
    failedTables: [],
    deadLetterCount: 0,
    pendingCount: 0,
    tableFailures: [],
    assetFailures: [],
    completedAt: FIXED_DATE,
    outcome: 'complete' as const,
  }
}

async function addPending(prefix: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await db.syncQueue.add({
      tableName: 'importedVideos',
      recordId: `${prefix}-${index}`,
      operation: 'put',
      payload: { id: `${prefix}-${index}` },
      attempts: 0,
      status: 'pending',
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    })
  }
}

beforeEach(async () => {
  await db.open()
  __resetSyncCoordinatorForTests()
  vi.clearAllMocks()
  mocks.fullSync.mockResolvedValue(completeResult())
})

afterEach(async () => {
  __resetSyncCoordinatorForTests()
  db.close()
  await Dexie.delete('ElearningDB')
})

describe('syncCoordinator initial upload', () => {
  it('keeps the original 63-item batch monotonic and uses a separate additional phase', async () => {
    await addPending('original', 63)
    const observations: Array<{ phase: string; processed: number; total: number }> = []
    const unsubscribe = syncCoordinator.subscribeInitialUpload(() => {
      const progress = syncCoordinator.getInitialUploadProgress()
      observations.push({
        phase: progress.phase,
        processed: progress.processed,
        total: progress.total,
      })
    })

    mocks.fullSync
      .mockImplementationOnce(async () => {
        const originals = (await db.syncQueue.where('status').equals('pending').toArray()).filter(
          row => row.recordId.startsWith('original-')
        )
        await db.syncQueue.bulkDelete(originals.slice(0, 32).map(row => row.id!))
        await addPending('additional', 31)
        return completeResult()
      })
      .mockImplementationOnce(async () => {
        const originals = (await db.syncQueue.where('status').equals('pending').toArray()).filter(
          row => row.recordId.startsWith('original-')
        )
        await db.syncQueue.bulkDelete(originals.map(row => row.id!))
        return completeResult()
      })
      .mockImplementationOnce(async () => {
        const additional = (await db.syncQueue.where('status').equals('pending').toArray()).filter(
          row => row.recordId.startsWith('additional-')
        )
        await db.syncQueue.bulkDelete(additional.map(row => row.id!))
        return completeResult()
      })

    const result = await syncCoordinator.request({
      reason: 'initial-upload',
      initialUpload: true,
      userId: 'user-1',
    })
    unsubscribe()

    const originalProgress = observations
      .filter(item => item.phase === 'original')
      .map(item => item.processed)
    expect(originalProgress).toContain(32)
    expect(
      originalProgress.every((value, index) => index === 0 || value >= originalProgress[index - 1])
    ).toBe(true)
    expect(observations).toContainEqual({ phase: 'additional', processed: 0, total: 31 })
    expect(syncCoordinator.getInitialUploadProgress()).toMatchObject({
      phase: 'complete',
      done: true,
    })
    expect(result.outcome).toBe('complete')
    expect(await db.syncQueue.where('status').equals('pending').count()).toBe(0)
  })

  it('surfaces a dead-letter record as an actionable initial-upload failure', async () => {
    await addPending('broken', 1)
    mocks.fullSync.mockImplementationOnce(async () => {
      const row = (await db.syncQueue.where('status').equals('pending').first())!
      await db.syncQueue.update(row.id!, {
        status: 'dead-letter',
        lastError: 'title is required',
        failure: {
          table: 'importedVideos',
          recordId: row.recordId,
          message: 'title is required',
          failedAt: FIXED_DATE,
          retryable: false,
        },
      })
      return { ...completeResult(), deadLetterCount: 1, outcome: 'partial' as const }
    })

    await syncCoordinator.startInitialUpload({ userId: 'user-1' })

    expect(syncCoordinator.getInitialUploadProgress()).toMatchObject({
      phase: 'error',
      failures: [
        expect.objectContaining({ table: 'importedVideos', message: 'title is required' }),
      ],
    })
    expect(mocks.setStatus).toHaveBeenCalledWith('error', 'title is required')
  })

  it('surfaces supported asset failures with their actionable record detail', async () => {
    await addPending('asset-parent', 1)
    mocks.fullSync.mockResolvedValueOnce({
      ...completeResult(),
      assetFailures: [
        {
          table: 'courseAssets',
          recordId: 'thumbnail-1',
          message: 'Thumbnail upload was rejected',
          retryable: false,
        },
      ],
      outcome: 'partial' as const,
    })

    await syncCoordinator.startInitialUpload({ userId: 'user-1' })

    expect(syncCoordinator.getInitialUploadProgress()).toMatchObject({
      phase: 'error',
      failures: [
        expect.objectContaining({
          table: 'courseAssets',
          recordId: 'thumbnail-1',
          message: 'Thumbnail upload was rejected',
        }),
      ],
    })
  })

  it('coalesces manual, periodic, focus, and online requests into one engine run', async () => {
    let resolveRun: ((value: ReturnType<typeof completeResult>) => void) | undefined
    mocks.fullSync.mockImplementationOnce(
      () =>
        new Promise<ReturnType<typeof completeResult>>(resolve => {
          resolveRun = resolve
        })
    )

    const first = syncCoordinator.request({ reason: 'manual' })
    const periodic = syncCoordinator.request({ reason: 'periodic' })
    const focus = syncCoordinator.request({ reason: 'focus' })
    const online = syncCoordinator.request({ reason: 'online' })
    expect(periodic).toBe(first)
    expect(focus).toBe(first)
    expect(online).toBe(first)
    await Promise.resolve()
    expect(mocks.fullSync).toHaveBeenCalledTimes(1)

    resolveRun?.(completeResult())
    await first
    expect(mocks.markSyncComplete).toHaveBeenCalledTimes(1)
  })

  it('rebuilds dead-letter payloads before a coordinated retry', async () => {
    await syncCoordinator.retryFailed()

    expect(mocks.retryFailed).toHaveBeenCalledWith({ rebuildPayloads: true })
    expect(mocks.fullSync).toHaveBeenCalledTimes(1)
  })
})
