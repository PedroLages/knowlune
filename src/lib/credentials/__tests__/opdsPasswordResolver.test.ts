/**
 * Smoke test for the OPDS password resolver — confirms it shares the factory
 * contract and is wired to the `opds-catalog` vault namespace.
 *
 * @since E95-S05
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { readMock } = vi.hoisted(() => ({ readMock: vi.fn() }))

vi.mock('@/lib/vaultCredentials', () => ({
  readCredentialWithStatus: readMock,
  readCredential: vi.fn(),
}))

vi.mock('@/lib/auth/supabase', () => ({
  supabase: { auth: { refreshSession: vi.fn() } },
}))

import { getOpdsPassword } from '@/lib/credentials/opdsPasswordResolver'
import { credentialCache } from '@/lib/credentials/cache'

beforeEach(() => {
  credentialCache.clear()
  readMock.mockReset()
})

describe('getOpdsPassword', () => {
  it('calls the broker with the opds-catalog kind', async () => {
    readMock.mockResolvedValueOnce({ ok: true, value: 'PW-1' })
    const value = await getOpdsPassword('cat-1')
    expect(value).toBe('PW-1')
    expect(readMock).toHaveBeenCalledWith('opds-catalog', 'cat-1')
  })

  it('returns null for undefined id without hitting the broker', async () => {
    expect(await getOpdsPassword(undefined)).toBeNull()
    expect(readMock).not.toHaveBeenCalled()
  })

  it('caches positive hits', async () => {
    readMock.mockResolvedValueOnce({ ok: true, value: 'PW-2' })
    expect(await getOpdsPassword('cat-2')).toBe('PW-2')
    expect(await getOpdsPassword('cat-2')).toBe('PW-2')
    expect(readMock).toHaveBeenCalledTimes(1)
  })
})
