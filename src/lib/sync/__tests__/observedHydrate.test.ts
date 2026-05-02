/**
 * E97-S04 Unit 3: Tests for observedHydrate wrapper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the hydrator BEFORE importing the wrapper.
const mockHydrateP3P4 = vi.fn()
vi.mock('../hydrateP3P4', () => ({
  hydrateP3P4FromSupabase: (...args: unknown[]) => mockHydrateP3P4(...args),
}))

import { observedHydrate } from '../observedHydrate'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'

beforeEach(() => {
  useDownloadStatusStore.setState({
    status: 'idle',
    lastError: null,
    startedAt: null,
  })
  mockHydrateP3P4.mockReset()
})

describe('observedHydrate', () => {
  it('transitions idle → hydrating-p3p4 → downloading-p0p2 on success', async () => {
    mockHydrateP3P4.mockResolvedValue(undefined)
    const statusesSeen: string[] = []
    const unsubscribe = useDownloadStatusStore.subscribe(s => {
      statusesSeen.push(s.status)
    })
    await observedHydrate('user-1')
    unsubscribe()
    expect(statusesSeen).toEqual(['hydrating-p3p4', 'downloading-p0p2'])
    expect(useDownloadStatusStore.getState().status).toBe('downloading-p0p2')
    expect(mockHydrateP3P4).toHaveBeenCalledWith('user-1')
  })

  it('does NOT transition to complete — that is owned by the engine watcher', async () => {
    mockHydrateP3P4.mockResolvedValue(undefined)
    await observedHydrate('user-1')
    expect(useDownloadStatusStore.getState().status).not.toBe('complete')
  })

  it('transitions hydrating-p3p4 → error on rejection and re-throws', async () => {
    const err = new Error('supabase 500')
    mockHydrateP3P4.mockRejectedValue(err)
    await expect(observedHydrate('user-1')).rejects.toThrow('supabase 500')
    const state = useDownloadStatusStore.getState()
    expect(state.status).toBe('error')
    expect(state.lastError).toBe('supabase 500')
  })

  it('falls back to a default message when rejection has no message', async () => {
    mockHydrateP3P4.mockRejectedValue({})
    await expect(observedHydrate('user-1')).rejects.toBeDefined()
    expect(useDownloadStatusStore.getState().lastError).toBe('Hydration failed')
  })

  it('is a no-op when userId is falsy', async () => {
    await observedHydrate('')
    await observedHydrate(null)
    await observedHydrate(undefined)
    expect(mockHydrateP3P4).not.toHaveBeenCalled()
    expect(useDownloadStatusStore.getState().status).toBe('idle')
  })
})
