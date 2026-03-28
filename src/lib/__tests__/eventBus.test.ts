import { describe, it, expect, beforeEach } from 'vitest'
import { appEventBus } from '@/lib/eventBus'
import type { AppEvent } from '@/lib/eventBus'

describe('eventBus', () => {
  beforeEach(() => {
    appEventBus.clear()
  })

  // ── emit / subscribe ────────────────────────────────────────

  describe('emit and subscribe', () => {
    it('delivers typed event to subscriber', () => {
      const received: AppEvent[] = []
      appEventBus.on('course:completed', event => received.push(event))

      appEventBus.emit({
        type: 'course:completed',
        courseId: 'c1',
        courseName: 'React Basics',
      })

      expect(received).toHaveLength(1)
      expect(received[0]).toEqual({
        type: 'course:completed',
        courseId: 'c1',
        courseName: 'React Basics',
      })
    })

    it('delivers to multiple subscribers of the same event', () => {
      let countA = 0
      let countB = 0
      appEventBus.on('streak:milestone', () => countA++)
      appEventBus.on('streak:milestone', () => countB++)

      appEventBus.emit({ type: 'streak:milestone', days: 7 })

      expect(countA).toBe(1)
      expect(countB).toBe(1)
    })

    it('does not deliver events to subscribers of different types', () => {
      const received: AppEvent[] = []
      appEventBus.on('course:completed', event => received.push(event))

      appEventBus.emit({ type: 'streak:milestone', days: 14 })

      expect(received).toHaveLength(0)
    })

    it('handles emit with no subscribers gracefully', () => {
      // Should not throw
      expect(() => {
        appEventBus.emit({ type: 'streak:milestone', days: 7 })
      }).not.toThrow()
    })
  })

  // ── unsubscribe ─────────────────────────────────────────────

  describe('unsubscribe', () => {
    it('stops receiving events after unsubscribe via returned function', () => {
      let count = 0
      const unsub = appEventBus.on('streak:milestone', () => count++)

      appEventBus.emit({ type: 'streak:milestone', days: 7 })
      expect(count).toBe(1)

      unsub()
      appEventBus.emit({ type: 'streak:milestone', days: 14 })
      expect(count).toBe(1) // Still 1 — not called again
    })

    it('stops receiving events after off()', () => {
      let count = 0
      const listener = () => count++
      appEventBus.on('review:due', listener)

      appEventBus.emit({ type: 'review:due', dueCount: 5 })
      expect(count).toBe(1)

      appEventBus.off('review:due', listener)
      appEventBus.emit({ type: 'review:due', dueCount: 3 })
      expect(count).toBe(1)
    })

    it('off() is safe when listener was never registered', () => {
      const listener = () => {}
      expect(() => appEventBus.off('review:due', listener)).not.toThrow()
    })
  })

  // ── clear ───────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all listeners', () => {
      let count = 0
      appEventBus.on('course:completed', () => count++)
      appEventBus.on('streak:milestone', () => count++)
      appEventBus.on('review:due', () => count++)

      appEventBus.clear()

      appEventBus.emit({ type: 'course:completed', courseId: 'c1', courseName: 'Test' })
      appEventBus.emit({ type: 'streak:milestone', days: 7 })
      appEventBus.emit({ type: 'review:due', dueCount: 1 })

      expect(count).toBe(0)
    })
  })

  // ── error isolation ─────────────────────────────────────────

  describe('error isolation', () => {
    it('does not propagate listener errors to other listeners', () => {
      let secondCalled = false
      appEventBus.on('streak:milestone', () => {
        throw new Error('boom')
      })
      appEventBus.on('streak:milestone', () => {
        secondCalled = true
      })

      // Should not throw — errors are caught internally
      expect(() => {
        appEventBus.emit({ type: 'streak:milestone', days: 7 })
      }).not.toThrow()

      expect(secondCalled).toBe(true)
    })
  })
})
