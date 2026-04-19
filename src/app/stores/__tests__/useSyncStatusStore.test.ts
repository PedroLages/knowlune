/**
 * E97-S01 Unit 1: Tests for useSyncStatusStore lastError semantics.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Dexie db before importing the store.
const mockCount = vi.fn().mockResolvedValue(0)
vi.mock('@/db', () => ({
  db: {
    syncQueue: {
      where: () => ({
        equals: () => ({
          count: mockCount,
        }),
      }),
    },
  },
}))

import { useSyncStatusStore } from '../useSyncStatusStore'

describe('useSyncStatusStore', () => {
  beforeEach(() => {
    useSyncStatusStore.setState({
      status: 'synced',
      pendingCount: 0,
      lastSyncAt: null,
      lastError: null,
    })
    mockCount.mockResolvedValue(0)
  })

  describe('setStatus', () => {
    it('persists explicit error message when status is error', () => {
      useSyncStatusStore.getState().setStatus('error', 'Network error')
      const state = useSyncStatusStore.getState()
      expect(state.status).toBe('error')
      expect(state.lastError).toBe('Network error')
    })

    it('falls back to default message when setStatus(error) called with no message', () => {
      useSyncStatusStore.getState().setStatus('error')
      const state = useSyncStatusStore.getState()
      expect(state.status).toBe('error')
      expect(state.lastError).toBe('Sync failed')
    })

    it('does NOT clear lastError on transitions to syncing (retry invariant)', () => {
      useSyncStatusStore.setState({ lastError: 'Network error', status: 'error' })
      useSyncStatusStore.getState().setStatus('syncing')
      const state = useSyncStatusStore.getState()
      expect(state.status).toBe('syncing')
      expect(state.lastError).toBe('Network error')
    })

    it('does NOT clear lastError on transitions to offline', () => {
      useSyncStatusStore.setState({ lastError: 'Server error', status: 'error' })
      useSyncStatusStore.getState().setStatus('offline')
      expect(useSyncStatusStore.getState().lastError).toBe('Server error')
    })

    it('does NOT clear lastError on direct transition to synced (only markSyncComplete clears)', () => {
      useSyncStatusStore.setState({ lastError: 'Server error', status: 'error' })
      useSyncStatusStore.getState().setStatus('synced')
      expect(useSyncStatusStore.getState().lastError).toBe('Server error')
    })
  })

  describe('markSyncComplete', () => {
    it('sets status=synced, advances lastSyncAt, and clears lastError', () => {
      useSyncStatusStore.setState({
        status: 'syncing',
        lastError: 'Network error',
        lastSyncAt: null,
      })
      const before = Date.now()
      useSyncStatusStore.getState().markSyncComplete()
      const state = useSyncStatusStore.getState()
      expect(state.status).toBe('synced')
      expect(state.lastError).toBeNull()
      expect(state.lastSyncAt).not.toBeNull()
      expect(state.lastSyncAt!.getTime()).toBeGreaterThanOrEqual(before)
    })
  })

  describe('refreshPendingCount', () => {
    it('updates pendingCount from Dexie', async () => {
      mockCount.mockResolvedValue(7)
      await useSyncStatusStore.getState().refreshPendingCount()
      expect(useSyncStatusStore.getState().pendingCount).toBe(7)
    })

    it('keeps previous count when Dexie read throws', async () => {
      useSyncStatusStore.setState({ pendingCount: 4 })
      mockCount.mockRejectedValueOnce(new Error('dexie boom'))
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      await useSyncStatusStore.getState().refreshPendingCount()
      expect(useSyncStatusStore.getState().pendingCount).toBe(4)
      errSpy.mockRestore()
    })
  })
})
