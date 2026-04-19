/**
 * E97-S01: Tests for classifyError helper.
 */
import { describe, it, expect } from 'vitest'
import { classifyError } from '../classifyError'

describe('classifyError', () => {
  it('maps fetch failures to "Network error"', () => {
    expect(classifyError(new Error('fetch failed'))).toBe('Network error')
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('Network error')
    expect(classifyError({ message: 'NetworkError when attempting to fetch' })).toBe(
      'Network error'
    )
  })

  it('maps 401/403 status to "Sign-in expired"', () => {
    expect(classifyError({ status: 401, message: 'bad' })).toBe('Sign-in expired')
    expect(classifyError({ status: 403, message: 'forbidden' })).toBe('Sign-in expired')
  })

  it('maps JWT message to "Sign-in expired"', () => {
    expect(classifyError(new Error('JWT expired'))).toBe('Sign-in expired')
    expect(classifyError(new Error('unauthorized request'))).toBe('Sign-in expired')
  })

  it('maps 5xx status to "Server error"', () => {
    expect(classifyError({ status: 500, message: 'oops' })).toBe('Server error')
    expect(classifyError({ status: 503, message: 'unavailable' })).toBe('Server error')
    expect(classifyError(new Error('received 502 bad gateway'))).toBe('Server error')
  })

  it('defaults to "Sync failed" for unknown errors', () => {
    expect(classifyError(new Error('something weird'))).toBe('Sync failed')
    expect(classifyError(undefined)).toBe('Sync failed')
    expect(classifyError(null)).toBe('Sync failed')
    expect(classifyError('string error')).toBe('Sync failed')
  })

  it('prefers auth classification when both 401 and fetch-like message present', () => {
    expect(classifyError({ status: 401, message: 'fetch failed with 401' })).toBe(
      'Sign-in expired'
    )
  })
})
