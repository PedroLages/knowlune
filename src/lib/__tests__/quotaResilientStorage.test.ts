import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('sonner', () => {
  const toastFn = vi.fn() as ReturnType<typeof vi.fn> & {
    error: ReturnType<typeof vi.fn>
    success: ReturnType<typeof vi.fn>
    warning: ReturnType<typeof vi.fn>
  }
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  toastFn.warning = vi.fn()
  return { toast: toastFn }
})

import { toast } from 'sonner'
import {
  quotaResilientStorage,
  _resetWarningThrottle,
  isQuotaExceeded,
  showThrottledWarning,
} from '@/lib/quotaResilientStorage'

const mockedToast = toast as unknown as ReturnType<typeof vi.fn> & {
  warning: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function makeQuotaError(name = 'QuotaExceededError'): DOMException {
  return new DOMException('Quota exceeded', name)
}

// Save original Storage.prototype methods (assigned by src/test/setup.ts)
const origSetItem = Storage.prototype.setItem
const origGetItem = Storage.prototype.getItem
const origRemoveItem = Storage.prototype.removeItem

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  _resetWarningThrottle()
})

afterEach(() => {
  // Restore prototype methods that tests may have overridden
  Storage.prototype.setItem = origSetItem
  Storage.prototype.getItem = origGetItem
  Storage.prototype.removeItem = origRemoveItem
})

describe('quotaResilientStorage', () => {
  describe('getItem', () => {
    it('reads from localStorage when available', () => {
      localStorage.setItem('test-key', 'value-from-local')
      expect(quotaResilientStorage.getItem('test-key')).toBe('value-from-local')
    })

    it('falls back to sessionStorage when localStorage returns null', () => {
      // sessionStorage and localStorage share the same Map in tests,
      // so we override getItem to simulate per-storage behavior.
      // Use the module-level origGetItem to avoid capturing a dirty prototype.
      Storage.prototype.getItem = function (this: Storage, key: string) {
        if (this === localStorage) return null
        if (key === 'test-key') return 'value-from-session'
        return origGetItem.call(this, key)
      }

      expect(quotaResilientStorage.getItem('test-key')).toBe('value-from-session')
    })

    it('returns null when neither storage has the key', () => {
      expect(quotaResilientStorage.getItem('missing')).toBeNull()
    })

    it('returns null when storage throws', () => {
      Storage.prototype.getItem = () => {
        throw new Error('SecurityError')
      }
      expect(quotaResilientStorage.getItem('test-key')).toBeNull()
    })
  })

  describe('setItem', () => {
    it('writes to localStorage normally', () => {
      quotaResilientStorage.setItem('key', 'value')
      expect(localStorage.getItem('key')).toBe('value')
    })

    it('catches QuotaExceededError and attempts cleanup before retry', () => {
      // Seed stale quiz-progress keys
      origSetItem.call(localStorage, 'quiz-progress-old-quiz', '{}')
      origSetItem.call(localStorage, 'other-key', 'keep-me')

      let callCount = 0
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'target-key' && callCount === 0) {
          callCount++
          throw makeQuotaError()
        }
        origSetItem.call(this, key, value)
      }
      // Override removeItem to be per-storage aware — jsdom shares a single
      // backing Map so sessionStorage.removeItem would nuke localStorage values.
      Storage.prototype.removeItem = function (this: Storage, key: string) {
        if (this === localStorage) origRemoveItem.call(this, key)
        // Ignore sessionStorage.removeItem to prevent cross-storage deletion
      }

      quotaResilientStorage.setItem('target-key', 'data')

      // Stale quiz key should have been cleared during cleanup
      expect(localStorage.getItem('quiz-progress-old-quiz')).toBeNull()
      // Non-quiz keys preserved
      expect(localStorage.getItem('other-key')).toBe('keep-me')
      // Retry succeeded — value written to localStorage
      expect(localStorage.getItem('target-key')).toBe('data')
    })

    it('preserves the active quiz key during stale key cleanup', () => {
      // The key being written matches quiz-progress-* pattern — it should NOT be deleted
      origSetItem.call(localStorage, 'quiz-progress-active', 'existing-progress')
      origSetItem.call(localStorage, 'quiz-progress-old', '{}')

      let callCount = 0
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'quiz-progress-active' && callCount === 0) {
          callCount++
          throw makeQuotaError()
        }
        origSetItem.call(this, key, value)
      }
      // Per-storage removeItem — prevent jsdom shared-Map cross-deletion
      Storage.prototype.removeItem = function (this: Storage, key: string) {
        if (this === localStorage) origRemoveItem.call(this, key)
      }

      quotaResilientStorage.setItem('quiz-progress-active', 'updated-progress')

      // Old quiz key cleaned up
      expect(localStorage.getItem('quiz-progress-old')).toBeNull()
      // Active quiz key preserved during cleanup, then overwritten by retry
      expect(localStorage.getItem('quiz-progress-active')).toBe('updated-progress')
    })

    it('falls back to sessionStorage when localStorage always throws quota error', () => {
      const sessionWrites: Array<[string, string]> = []
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (this === localStorage) throw makeQuotaError()
        sessionWrites.push([key, value])
        origSetItem.call(this, key, value)
      }

      quotaResilientStorage.setItem('key', 'value')

      expect(sessionWrites).toContainEqual(['key', 'value'])
    })

    it('shows throttled warning toast on fallback with correct message', () => {
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (this === localStorage) throw makeQuotaError()
        origSetItem.call(this, key, value)
      }
      // Per-storage removeItem — adapter removes stale localStorage entry after
      // fallback; prevent jsdom shared-Map from nuking the sessionStorage value.
      Storage.prototype.removeItem = function (this: Storage, key: string) {
        if (this === sessionStorage) origRemoveItem.call(this, key)
        // Ignore localStorage.removeItem — it's inaccessible in this scenario anyway
      }

      quotaResilientStorage.setItem('k1', 'v1')
      expect(mockedToast.warning).toHaveBeenCalledTimes(1)
      expect(mockedToast.warning).toHaveBeenCalledWith(
        'Storage limit reached. Quiz progress will be saved for this session only. Try clearing browser data or using a different browser.',
        expect.objectContaining({ duration: expect.any(Number) })
      )

      // Verify sessionStorage received the data
      expect(sessionStorage.getItem('k1')).toBe('v1')

      // Second call within throttle window — no new toast
      quotaResilientStorage.setItem('k2', 'v2')
      expect(mockedToast.warning).toHaveBeenCalledTimes(1)
      expect(sessionStorage.getItem('k2')).toBe('v2')
    })

    it('shows toast again after throttle expires', () => {
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (this === localStorage) throw makeQuotaError()
        origSetItem.call(this, key, value)
      }

      quotaResilientStorage.setItem('k1', 'v1')
      expect(mockedToast.warning).toHaveBeenCalledTimes(1)

      _resetWarningThrottle()
      quotaResilientStorage.setItem('k2', 'v2')
      expect(mockedToast.warning).toHaveBeenCalledTimes(2)
    })

    it('handles Firefox NS_ERROR_DOM_QUOTA_REACHED variant', () => {
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (this === localStorage) throw makeQuotaError('NS_ERROR_DOM_QUOTA_REACHED')
        origSetItem.call(this, key, value)
      }

      expect(() => quotaResilientStorage.setItem('key', 'value')).not.toThrow()
      expect(mockedToast.warning).toHaveBeenCalledTimes(1)
    })

    it('logs non-quota errors without fallback or toast', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      Storage.prototype.setItem = () => {
        throw new Error('SecurityError')
      }

      quotaResilientStorage.setItem('key', 'value')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[quotaResilientStorage] setItem failed:',
        expect.any(Error)
      )
      expect(mockedToast.warning).not.toHaveBeenCalled()
      // Value was not written to either storage
      Storage.prototype.getItem = origGetItem
      expect(localStorage.getItem('key')).toBeNull()
      expect(sessionStorage.getItem('key')).toBeNull()

      consoleSpy.mockRestore()
    })

    it('shows error toast when both storages fail', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      Storage.prototype.setItem = () => {
        throw makeQuotaError()
      }

      quotaResilientStorage.setItem('key', 'value')

      // Warning toast should NOT fire (sessionStorage also failed)
      expect(mockedToast.warning).not.toHaveBeenCalled()
      // Error toast should fire instead
      expect(mockedToast.error).toHaveBeenCalledTimes(1)
      // sessionStorage failure logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[quotaResilientStorage] sessionStorage fallback failed:',
        expect.any(DOMException)
      )
      // Both storages should remain empty after double failure
      Storage.prototype.getItem = origGetItem
      expect(localStorage.getItem('key')).toBeNull()
      expect(sessionStorage.getItem('key')).toBeNull()

      consoleSpy.mockRestore()
    })
  })

  describe('removeItem', () => {
    it('removes from both localStorage and sessionStorage', () => {
      const removedFrom: string[] = []
      Storage.prototype.removeItem = function (this: Storage, key: string) {
        if (this === localStorage) removedFrom.push('local:' + key)
        if (this === sessionStorage) removedFrom.push('session:' + key)
        origRemoveItem.call(this, key)
      }

      quotaResilientStorage.removeItem('key')

      expect(removedFrom).toContain('local:key')
      expect(removedFrom).toContain('session:key')
    })

    it('does not throw if storage is inaccessible', () => {
      Storage.prototype.removeItem = () => {
        throw new Error('SecurityError')
      }

      expect(() => quotaResilientStorage.removeItem('key')).not.toThrow()
    })
  })

  describe('isQuotaExceeded', () => {
    it('returns true for QuotaExceededError', () => {
      expect(isQuotaExceeded(makeQuotaError())).toBe(true)
    })

    it('returns true for Firefox NS_ERROR_DOM_QUOTA_REACHED', () => {
      expect(isQuotaExceeded(makeQuotaError('NS_ERROR_DOM_QUOTA_REACHED'))).toBe(true)
    })

    it('returns false for non-DOMException errors', () => {
      expect(isQuotaExceeded(new Error('SecurityError'))).toBe(false)
    })

    it('returns false for non-quota DOMException', () => {
      expect(isQuotaExceeded(new DOMException('Not found', 'NotFoundError'))).toBe(false)
    })

    it('returns false for non-error values', () => {
      expect(isQuotaExceeded(null)).toBe(false)
      expect(isQuotaExceeded(undefined)).toBe(false)
      expect(isQuotaExceeded('string')).toBe(false)
    })
  })

  describe('showThrottledWarning', () => {
    it('fires toast on first call', () => {
      showThrottledWarning()
      expect(mockedToast.warning).toHaveBeenCalledTimes(1)
    })

    it('suppresses within throttle window', () => {
      showThrottledWarning()
      showThrottledWarning()
      expect(mockedToast.warning).toHaveBeenCalledTimes(1)
    })

    it('fires again after throttle reset', () => {
      showThrottledWarning()
      _resetWarningThrottle()
      showThrottledWarning()
      expect(mockedToast.warning).toHaveBeenCalledTimes(2)
    })
  })
})
