/**
 * Tests for the credential cache — positive hits held for the session,
 * negative (null) hits held for 5 minutes, explicit invalidate / clear.
 *
 * @since E95-S05
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { credentialCache } from '@/lib/credentials/cache'

beforeEach(() => {
  credentialCache.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('credentialCache', () => {
  it('returns undefined on cold miss', () => {
    expect(credentialCache.get('abs-server', 'srv-1')).toBeUndefined()
  })

  it('holds positive hits for the session', () => {
    credentialCache.set('abs-server', 'srv-1', 'key-1')
    vi.advanceTimersByTime(60 * 60 * 1000) // 1 hour
    expect(credentialCache.get('abs-server', 'srv-1')).toBe('key-1')
  })

  it('expires null entries after 5 minutes', () => {
    credentialCache.set('opds-catalog', 'cat-1', null)
    expect(credentialCache.get('opds-catalog', 'cat-1')).toBeNull()
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(credentialCache.get('opds-catalog', 'cat-1')).toBeUndefined()
  })

  it('invalidate() drops a specific entry only', () => {
    credentialCache.set('abs-server', 'srv-1', 'a')
    credentialCache.set('abs-server', 'srv-2', 'b')
    credentialCache.invalidate('abs-server', 'srv-1')
    expect(credentialCache.get('abs-server', 'srv-1')).toBeUndefined()
    expect(credentialCache.get('abs-server', 'srv-2')).toBe('b')
  })

  it('clear() drops everything', () => {
    credentialCache.set('abs-server', 'srv-1', 'a')
    credentialCache.set('opds-catalog', 'cat-1', 'b')
    credentialCache.clear()
    expect(credentialCache._size()).toBe(0)
  })

  it('keys the abs and opds namespaces separately', () => {
    credentialCache.set('abs-server', 'shared-id', 'abs-value')
    credentialCache.set('opds-catalog', 'shared-id', 'opds-value')
    expect(credentialCache.get('abs-server', 'shared-id')).toBe('abs-value')
    expect(credentialCache.get('opds-catalog', 'shared-id')).toBe('opds-value')
  })
})
