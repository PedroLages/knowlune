import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readHintDismissed, writeHintDismissed } from '@/lib/searchHintDismiss'

const HINT_KEY = 'knowlune.searchPrefixHintDismissed.v1'

beforeEach(() => {
  localStorage.clear()
})

describe('readHintDismissed', () => {
  it('returns false when key is absent', () => {
    expect(readHintDismissed()).toBe(false)
  })

  it('returns true after the key is set to "true"', () => {
    localStorage.setItem(HINT_KEY, 'true')
    expect(readHintDismissed()).toBe(true)
  })

  it('returns false for unexpected stored values', () => {
    localStorage.setItem(HINT_KEY, '1')
    expect(readHintDismissed()).toBe(false)
  })

  it('returns false when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('storage locked')
    })
    expect(readHintDismissed()).toBe(false)
    vi.restoreAllMocks()
  })
})

describe('writeHintDismissed', () => {
  it('persists "true" to the correct key', () => {
    writeHintDismissed()
    expect(localStorage.getItem(HINT_KEY)).toBe('true')
  })

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota exceeded')
    })
    expect(() => writeHintDismissed()).not.toThrow()
    vi.restoreAllMocks()
  })
})
