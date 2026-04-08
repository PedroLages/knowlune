import { describe, it, expect, beforeEach } from 'vitest'
import { setFocusModeActive, setFocusModeInactive, isFocusModeActive } from '../focusModeState'

describe('focusModeState', () => {
  beforeEach(() => {
    // Reset to inactive before each test
    setFocusModeInactive()
  })

  it('defaults to inactive', () => {
    expect(isFocusModeActive()).toBe(false)
  })

  it('becomes active after setFocusModeActive', () => {
    setFocusModeActive()
    expect(isFocusModeActive()).toBe(true)
  })

  it('becomes inactive after setFocusModeInactive', () => {
    setFocusModeActive()
    expect(isFocusModeActive()).toBe(true)
    setFocusModeInactive()
    expect(isFocusModeActive()).toBe(false)
  })

  it('handles multiple activations', () => {
    setFocusModeActive()
    setFocusModeActive()
    expect(isFocusModeActive()).toBe(true)
    setFocusModeInactive()
    expect(isFocusModeActive()).toBe(false)
  })
})
