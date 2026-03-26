import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reportError, getErrorLog, clearErrorLog, initErrorTracking } from '@/lib/errorTracking'

describe('errorTracking', () => {
  beforeEach(() => {
    clearErrorLog()
    vi.restoreAllMocks()
  })

  describe('reportError', () => {
    it('stores an entry with timestamp, message, stack, and context', () => {
      const error = new Error('test failure')
      vi.spyOn(console, 'error').mockImplementation(() => {})

      reportError(error, 'TestContext')

      const log = getErrorLog()
      expect(log).toHaveLength(1)
      expect(log[0].message).toBe('test failure')
      expect(log[0].context).toBe('TestContext')
      expect(log[0].stack).toBeDefined()
      expect(log[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(log[0].raw).toBe(error)
    })

    it('uses "Unknown" as default context when none provided', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      reportError('simple string error')

      const log = getErrorLog()
      expect(log[0].context).toBe('Unknown')
      expect(log[0].message).toBe('simple string error')
      expect(log[0].stack).toBeUndefined()
    })

    it('converts non-Error values to string messages', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      reportError(42, 'NumberError')

      const log = getErrorLog()
      expect(log[0].message).toBe('42')
    })

    it('logs to console.error with structured format', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      reportError(new Error('boom'), 'MyCtx')

      expect(spy).toHaveBeenCalledOnce()
      expect(spy.mock.calls[0][0]).toContain('[Knowlune:Error]')
      expect(spy.mock.calls[0][0]).toContain('MyCtx')
      expect(spy.mock.calls[0][0]).toContain('boom')
    })
  })

  describe('ring buffer', () => {
    it('drops oldest entries when exceeding MAX_ENTRIES (50)', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      for (let i = 0; i < 55; i++) {
        reportError(new Error(`error-${i}`), `ctx-${i}`)
      }

      const log = getErrorLog()
      expect(log).toHaveLength(50)
      // Oldest 5 should have been dropped
      expect(log[0].message).toBe('error-5')
      expect(log[49].message).toBe('error-54')
    })
  })

  describe('getErrorLog', () => {
    it('returns a copy — mutating it does not affect internal state', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      reportError(new Error('original'), 'Test')

      const copy = getErrorLog()
      // Mutate the returned array
      ;(copy as unknown[]).push({ fake: true })
      ;(copy as unknown[]).length = 0

      // Internal state should be unaffected
      const fresh = getErrorLog()
      expect(fresh).toHaveLength(1)
      expect(fresh[0].message).toBe('original')
    })
  })

  describe('clearErrorLog', () => {
    it('empties the buffer completely', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      reportError(new Error('a'))
      reportError(new Error('b'))
      expect(getErrorLog()).toHaveLength(2)

      clearErrorLog()
      expect(getErrorLog()).toHaveLength(0)
    })
  })

  describe('initErrorTracking', () => {
    it('sets window.onerror and window.onunhandledrejection handlers', () => {
      window.onerror = null
      window.onunhandledrejection = null

      initErrorTracking()

      expect(window.onerror).toBeTypeOf('function')
      expect(window.onunhandledrejection).toBeTypeOf('function')
    })

    it('window.onerror handler calls reportError with error object', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      initErrorTracking()

      const error = new Error('global boom')
      ;(window.onerror as (...args: unknown[]) => void)('msg', 'script.js', 10, 5, error)

      const log = getErrorLog()
      expect(log).toHaveLength(1)
      expect(log[0].message).toBe('global boom')
      expect(log[0].context).toContain('GlobalError')
      expect(log[0].context).toContain('script.js:10:5')
    })

    it('window.onerror handler falls back to message when no error object', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      initErrorTracking()
      ;(window.onerror as (...args: unknown[]) => void)(
        'Script error',
        undefined,
        undefined,
        undefined,
        undefined
      )

      const log = getErrorLog()
      expect(log).toHaveLength(1)
      expect(log[0].message).toBe('Script error')
      expect(log[0].context).toBe('GlobalError')
    })

    it('window.onunhandledrejection handler calls reportError', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      initErrorTracking()

      const event = new Event('unhandledrejection') as PromiseRejectionEvent
      Object.defineProperty(event, 'reason', { value: new Error('rejected!') })
      ;(window.onunhandledrejection as (...args: unknown[]) => void)(event)

      const log = getErrorLog()
      expect(log).toHaveLength(1)
      expect(log[0].message).toBe('rejected!')
      expect(log[0].context).toBe('UnhandledPromiseRejection')
    })
  })

  describe('graceful degradation (no Sentry)', () => {
    it('works entirely standalone without external error tracking services', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      // The module should function without any Sentry SDK or external config
      reportError(new Error('no sentry'), 'StandaloneCtx')

      const log = getErrorLog()
      expect(log).toHaveLength(1)
      expect(log[0].message).toBe('no sentry')
      expect(log[0].context).toBe('StandaloneCtx')
    })

    it('initErrorTracking does not throw when Sentry is absent', () => {
      expect(() => initErrorTracking()).not.toThrow()
    })
  })

  describe('export / serialization', () => {
    it('getErrorLog returns entries that are JSON-serializable', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      reportError(new Error('serialize-me'), 'ExportCtx')

      const log = getErrorLog()
      // Entries should serialize cleanly (raw may contain Error, but the rest is primitive)
      const serialized = JSON.parse(
        JSON.stringify(log, (_, v) => (v instanceof Error ? v.message : v))
      )
      expect(serialized).toHaveLength(1)
      expect(serialized[0].message).toBe('serialize-me')
      expect(serialized[0].context).toBe('ExportCtx')
      expect(serialized[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('getErrorLog returns all accumulated entries in insertion order', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      reportError(new Error('first'))
      reportError(new Error('second'))
      reportError(new Error('third'))

      const log = getErrorLog()
      expect(log.map(e => e.message)).toEqual(['first', 'second', 'third'])
    })
  })
})
