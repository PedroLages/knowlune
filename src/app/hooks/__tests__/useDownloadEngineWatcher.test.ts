/**
 * E97-S04 Unit 4a: Tests for useDownloadEngineWatcher.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import Dexie from 'dexie'
import { db } from '@/db'
import { useDownloadEngineWatcher } from '../useDownloadEngineWatcher'
import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'

beforeEach(async () => {
  await db.open()
  useSyncStatusStore.setState({
    status: 'synced',
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
  })
  useDownloadStatusStore.setState({
    status: 'downloading-p0p2',
    lastError: null,
    startedAt: Date.now(),
  })
})

afterEach(async () => {
  db.close()
  await Dexie.delete('ElearningDB')
  vi.clearAllMocks()
})

describe('useDownloadEngineWatcher', () => {
  it('transitions store to complete when sync goes syncing → synced with queue=0', async () => {
    renderHook(() => useDownloadEngineWatcher('user-1', true))

    act(() => {
      useSyncStatusStore.getState().setStatus('syncing')
    })
    act(() => {
      useSyncStatusStore.getState().markSyncComplete()
    })

    await waitFor(() => {
      expect(useDownloadStatusStore.getState().status).toBe('complete')
    })
  })

  it('does NOT advance to complete on pre-latch synced (no prior syncing observed)', async () => {
    renderHook(() => useDownloadEngineWatcher('user-1', true))

    // First event is 'synced' without prior 'syncing' — should be ignored.
    act(() => {
      useSyncStatusStore.setState({ status: 'idle' as never })
      useSyncStatusStore.getState().setStatus('synced')
    })

    // Wait a tick for the async queue count to settle — if the watcher
    // mistakenly advanced, we would see `complete` here.
    await new Promise(r => setTimeout(r, 50))
    expect(useDownloadStatusStore.getState().status).toBe('downloading-p0p2')
  })

  it('waits for queue to drain before advancing to complete', async () => {
    // Seed a pending row
    await db.syncQueue.add({
      tableName: 'notes',
      recordId: 'r1',
      operation: 'put',
      payload: {},
      attempts: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    renderHook(() => useDownloadEngineWatcher('user-1', true))

    act(() => {
      useSyncStatusStore.getState().setStatus('syncing')
    })
    act(() => {
      useSyncStatusStore.getState().markSyncComplete()
    })

    // Pending queue > 0 → watcher does NOT advance.
    await new Promise(r => setTimeout(r, 50))
    expect(useDownloadStatusStore.getState().status).toBe('downloading-p0p2')

    // Drain the queue and emit another synced cycle.
    await db.syncQueue.clear()
    act(() => {
      useSyncStatusStore.getState().setStatus('syncing')
    })
    act(() => {
      useSyncStatusStore.getState().markSyncComplete()
    })

    await waitFor(() => {
      expect(useDownloadStatusStore.getState().status).toBe('complete')
    })
  })

  it('transitions store to error when sync goes to error during Phase B', async () => {
    renderHook(() => useDownloadEngineWatcher('user-1', true))

    act(() => {
      useSyncStatusStore.getState().setStatus('syncing')
    })
    act(() => {
      useSyncStatusStore.getState().setStatus('error', 'Network down')
    })

    expect(useDownloadStatusStore.getState().status).toBe('error')
    expect(useDownloadStatusStore.getState().lastError).toBe('Network down')
  })

  it('treats offline as a no-op (watchdog handles stuck state)', async () => {
    renderHook(() => useDownloadEngineWatcher('user-1', true))

    act(() => {
      useSyncStatusStore.getState().setStatus('syncing')
    })
    act(() => {
      useSyncStatusStore.getState().setStatus('offline')
    })

    await new Promise(r => setTimeout(r, 50))
    expect(useDownloadStatusStore.getState().status).toBe('downloading-p0p2')
  })

  it('is a no-op when enabled=false', async () => {
    renderHook(() => useDownloadEngineWatcher('user-1', false))

    act(() => {
      useSyncStatusStore.getState().setStatus('syncing')
    })
    act(() => {
      useSyncStatusStore.getState().markSyncComplete()
    })

    await new Promise(r => setTimeout(r, 50))
    expect(useDownloadStatusStore.getState().status).toBe('downloading-p0p2')
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useDownloadEngineWatcher('user-1', true))
    unmount()

    // After unmount, store transitions should have no effect.
    act(() => {
      useSyncStatusStore.getState().setStatus('syncing')
    })
    act(() => {
      useSyncStatusStore.getState().markSyncComplete()
    })

    await new Promise(r => setTimeout(r, 50))
    expect(useDownloadStatusStore.getState().status).toBe('downloading-p0p2')
  })

  it('does not fire when download store is already in complete or error', async () => {
    useDownloadStatusStore.setState({
      status: 'complete',
      lastError: null,
      startedAt: null,
    })

    renderHook(() => useDownloadEngineWatcher('user-1', true))

    act(() => {
      useSyncStatusStore.getState().setStatus('error', 'late error')
    })

    expect(useDownloadStatusStore.getState().status).toBe('complete')
  })

  it('fast-path: immediately completes when sync status is already synced at Phase B entry', async () => {
    // Set up: sync engine is already in 'synced' before Phase B starts.
    useSyncStatusStore.setState({
      status: 'synced',
      pendingCount: 0,
      lastSyncAt: null,
      lastError: null,
    })
    // Start in hydrating-p3p4 (Phase A) so the watcher is active but not yet in Phase B.
    useDownloadStatusStore.setState({
      status: 'hydrating-p3p4',
      lastError: null,
      startedAt: Date.now(),
    })

    // Mount the hook while in hydrating-p3p4 — prevDownloadStatusRef initializes
    // to null, then on first render records 'hydrating-p3p4' as the prev value.
    const { rerender } = renderHook(() => useDownloadEngineWatcher('user-1', true))

    // Stabilize: let the initial render settle prevDownloadStatusRef to 'hydrating-p3p4'.
    await new Promise(r => setTimeout(r, 10))

    // Transition to Phase B — the fast-path useEffect detects the change from
    // hydrating-p3p4 → downloading-p0p2 and immediately fires tryCompleteIfQueueDrained()
    // since currentSyncStatus is already 'synced'.
    act(() => {
      useDownloadStatusStore.setState({
        status: 'downloading-p0p2',
        lastError: null,
        startedAt: Date.now(),
      })
    })
    rerender()

    await waitFor(() => {
      expect(useDownloadStatusStore.getState().status).toBe('complete')
    })
  })
})
