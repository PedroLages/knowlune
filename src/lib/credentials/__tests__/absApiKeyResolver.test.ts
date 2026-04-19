/**
 * Tests for the ABS apiKey resolver.
 *
 * Covers the retry ladder, caching, telemetry emission, and undefined-id
 * guards. The OPDS resolver shares the same factory, so behavior-level
 * parity is relied on rather than duplicated — a thin smoke test lives in
 * `opdsPasswordResolver.test.ts`.
 *
 * @since E95-S05
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { readMock, refreshMock } = vi.hoisted(() => ({
  readMock: vi.fn(),
  refreshMock: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
}))
const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

vi.mock('@/lib/vaultCredentials', () => ({
  readCredentialWithStatus: readMock,
  readCredential: vi.fn(),
}))

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: refreshMock,
    },
  },
}))

import { getAbsApiKey, invalidateAbsApiKey } from '@/lib/credentials/absApiKeyResolver'
import { credentialCache } from '@/lib/credentials/cache'

beforeEach(() => {
  credentialCache.clear()
  readMock.mockReset()
  refreshMock.mockClear()
  infoSpy.mockClear()
})

describe('getAbsApiKey — happy paths', () => {
  it('returns null for undefined serverId without hitting the broker', async () => {
    const value = await getAbsApiKey(undefined)
    expect(value).toBeNull()
    expect(readMock).not.toHaveBeenCalled()
  })

  it('first call hits the broker, second call hits the cache', async () => {
    readMock.mockResolvedValueOnce({ ok: true, value: 'KEY-1' })
    expect(await getAbsApiKey('srv-1')).toBe('KEY-1')
    expect(await getAbsApiKey('srv-1')).toBe('KEY-1')
    expect(readMock).toHaveBeenCalledTimes(1)
  })

  it('caches null results so unconfigured servers do not thrash the broker', async () => {
    readMock.mockResolvedValueOnce({ ok: true, value: null })
    expect(await getAbsApiKey('srv-2')).toBeNull()
    expect(await getAbsApiKey('srv-2')).toBeNull()
    expect(readMock).toHaveBeenCalledTimes(1)
  })
})

describe('getAbsApiKey — error / retry paths', () => {
  it('retries once after session refresh when the broker returns 401', async () => {
    readMock
      .mockResolvedValueOnce({ ok: false, reason: 'auth-failed' })
      .mockResolvedValueOnce({ ok: true, value: 'KEY-AFTER-REFRESH' })
    const value = await getAbsApiKey('srv-3')
    expect(value).toBe('KEY-AFTER-REFRESH')
    expect(readMock).toHaveBeenCalledTimes(2)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('returns null, emits telemetry, and does NOT cache when still 401 after refresh', async () => {
    readMock
      .mockResolvedValueOnce({ ok: false, reason: 'auth-failed' })
      .mockResolvedValueOnce({ ok: false, reason: 'auth-failed' })
    const value = await getAbsApiKey('srv-4')
    expect(value).toBeNull()
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(infoSpy).toHaveBeenCalledWith(
      '[telemetry] sync.credential.auth_failed',
      expect.objectContaining({ kind: 'abs-server', id: 'srv-4' }),
    )
    // Next call retries (no cached null entry).
    readMock.mockResolvedValueOnce({ ok: true, value: 'now-ok' })
    expect(await getAbsApiKey('srv-4')).toBe('now-ok')
    expect(readMock).toHaveBeenCalledTimes(3)
  })

  it('returns null on network error without caching', async () => {
    readMock.mockResolvedValueOnce({ ok: false, reason: 'error', message: 'boom' })
    expect(await getAbsApiKey('srv-5')).toBeNull()
    // Next call retries.
    readMock.mockResolvedValueOnce({ ok: true, value: 'recovered' })
    expect(await getAbsApiKey('srv-5')).toBe('recovered')
    expect(readMock).toHaveBeenCalledTimes(2)
  })
})

describe('invalidateAbsApiKey', () => {
  it('drops a cached value so the next call hits the broker', async () => {
    readMock
      .mockResolvedValueOnce({ ok: true, value: 'v1' })
      .mockResolvedValueOnce({ ok: true, value: 'v2' })
    expect(await getAbsApiKey('srv-6')).toBe('v1')
    invalidateAbsApiKey('srv-6')
    expect(await getAbsApiKey('srv-6')).toBe('v2')
    expect(readMock).toHaveBeenCalledTimes(2)
  })
})
