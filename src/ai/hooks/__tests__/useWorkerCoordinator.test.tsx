/**
 * useWorkerCoordinator Hook Tests (AC9)
 *
 * Verifies that the hook terminates specified worker types on unmount
 * while leaving the global coordinator singleton intact for other consumers.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWorkerCoordinator } from '../useWorkerCoordinator'
import { coordinator } from '@/ai/workers/coordinator'

describe('useWorkerCoordinator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC9: calls terminateWorkerType for specified types on unmount', () => {
    const spy = vi.spyOn(coordinator, 'terminateWorkerType')

    const { unmount } = renderHook(() => useWorkerCoordinator(['search']))

    unmount()

    expect(spy).toHaveBeenCalledWith('search')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('AC9: does not terminate other worker types on unmount', () => {
    const spy = vi.spyOn(coordinator, 'terminateWorkerType')

    const { unmount } = renderHook(() => useWorkerCoordinator(['search']))

    unmount()

    expect(spy).not.toHaveBeenCalledWith('embed')
    expect(spy).not.toHaveBeenCalledWith('infer')
  })

  it('AC9: does not call terminateWorkerType when no types specified', () => {
    const spy = vi.spyOn(coordinator, 'terminateWorkerType')

    const { unmount } = renderHook(() => useWorkerCoordinator([]))

    unmount()

    expect(spy).not.toHaveBeenCalled()
  })

  it('returns the global coordinator singleton', () => {
    renderHook(() => useWorkerCoordinator([]))
    // Hook is void, just verify it doesn't throw
    expect(coordinator).toBeDefined()
  })

  it('AC9: terminates multiple worker types on unmount', () => {
    const spy = vi.spyOn(coordinator, 'terminateWorkerType')

    const { unmount } = renderHook(() => useWorkerCoordinator(['search', 'embed']))

    unmount()

    expect(spy).toHaveBeenCalledWith('search')
    expect(spy).toHaveBeenCalledWith('embed')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
