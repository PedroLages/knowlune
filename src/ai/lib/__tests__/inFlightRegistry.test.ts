/**
 * Unit tests for inFlightRegistry — E119-S08
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerAIRequest,
  unregisterAIRequest,
  abortAllInFlightAIRequests,
  _registrySize,
} from '../inFlightRegistry'

// Reset registry state between tests by aborting all
beforeEach(() => {
  abortAllInFlightAIRequests()
})

describe('inFlightRegistry', () => {
  it('registers controllers and reports correct size', () => {
    const c1 = new AbortController()
    const c2 = new AbortController()
    registerAIRequest(c1)
    registerAIRequest(c2)
    expect(_registrySize()).toBe(2)
  })

  it('abortAllInFlightAIRequests aborts all registered controllers', () => {
    const c1 = new AbortController()
    const c2 = new AbortController()
    registerAIRequest(c1)
    registerAIRequest(c2)

    abortAllInFlightAIRequests()

    expect(c1.signal.aborted).toBe(true)
    expect(c2.signal.aborted).toBe(true)
    expect(_registrySize()).toBe(0)
  })

  it('abortAllInFlightAIRequests on empty registry does not throw', () => {
    expect(() => abortAllInFlightAIRequests()).not.toThrow()
    expect(_registrySize()).toBe(0)
  })

  it('unregisterAIRequest removes a controller from the registry', () => {
    const c1 = new AbortController()
    registerAIRequest(c1)
    unregisterAIRequest(c1)
    expect(_registrySize()).toBe(0)
  })

  it('unregisterAIRequest with unknown controller does not throw', () => {
    const unknown = new AbortController()
    expect(() => unregisterAIRequest(unknown)).not.toThrow()
  })

  it('completed requests are removed and do not appear in abort', () => {
    const c1 = new AbortController()
    const c2 = new AbortController()
    registerAIRequest(c1)
    registerAIRequest(c2)

    // Simulate c1 completing
    unregisterAIRequest(c1)

    abortAllInFlightAIRequests()

    // c1 was unregistered before abort — should NOT be aborted
    expect(c1.signal.aborted).toBe(false)
    // c2 was still in flight — should be aborted
    expect(c2.signal.aborted).toBe(true)
  })
})
