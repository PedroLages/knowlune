/**
 * Unit tests for vaultCredentials.ts — E95-S02
 *
 * Tests the four Vault client functions: storeCredential, checkCredential,
 * readCredential, deleteCredential. All tests mock supabase.functions.invoke
 * and supabase.auth.getUser to avoid real network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must use vi.hoisted so variables are available when vi.mock factory runs
const { mockGetUser, mockFunctionsInvoke } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
}))

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
    functions: {
      invoke: mockFunctionsInvoke,
    },
  },
}))

import {
  storeCredential,
  checkCredential,
  readCredential,
  deleteCredential,
} from '@/lib/vaultCredentials'

const MOCK_USER = { id: 'user-123' }

beforeEach(() => {
  vi.clearAllMocks()
  // Default: authenticated user
  mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } })
  // Default: successful invoke
  mockFunctionsInvoke.mockResolvedValue({ data: {}, error: null })
})

// ─── storeCredential ──────────────────────────────────────────────────────────

describe('storeCredential', () => {
  it('calls invoke with correct arguments for ai-provider', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { configured: true }, error: null })

    await storeCredential('ai-provider', 'openai', 'sk-abc')

    expect(mockFunctionsInvoke).toHaveBeenCalledOnce()
    const [path, options] = mockFunctionsInvoke.mock.calls[0]
    expect(path).toBe('vault-credentials/store-credential')
    expect(options.method).toBe('POST')
    expect(options.body).toEqual({
      credentialType: 'ai-provider',
      credentialId: 'openai',
      secret: 'sk-abc',
    })
  })

  it('is a no-op when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await storeCredential('ai-provider', 'openai', 'sk-abc')

    expect(mockFunctionsInvoke).not.toHaveBeenCalled()
  })

  it('does not throw when invoke returns an error', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: new Error('network error') })

    await expect(storeCredential('ai-provider', 'openai', 'sk-abc')).resolves.toBeUndefined()
  })

  it('does not throw when invoke throws', async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error('fetch failed'))

    await expect(storeCredential('ai-provider', 'openai', 'sk-abc')).resolves.toBeUndefined()
  })
})

// ─── checkCredential ──────────────────────────────────────────────────────────

describe('checkCredential', () => {
  it('returns true when invoke returns configured: true', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { configured: true }, error: null })

    const result = await checkCredential('abs-server', 'server-uuid')

    expect(result).toBe(true)
    const [path, options] = mockFunctionsInvoke.mock.calls[0]
    expect(path).toContain('check-credential')
    expect(path).toContain('credentialType=abs-server')
    expect(path).toContain('credentialId=server-uuid')
    expect(options.method).toBe('GET')
  })

  it('returns false when invoke returns configured: false', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { configured: false }, error: null })

    const result = await checkCredential('abs-server', 'server-uuid')

    expect(result).toBe(false)
  })

  it('returns false when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await checkCredential('abs-server', 'server-uuid')

    expect(result).toBe(false)
    expect(mockFunctionsInvoke).not.toHaveBeenCalled()
  })

  it('returns false when invoke returns an error (non-throwing)', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: new Error('Vault error') })

    const result = await checkCredential('opds-catalog', 'catalog-uuid')

    expect(result).toBe(false)
  })

  it('returns false when invoke throws (non-throwing)', async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error('network error'))

    const result = await checkCredential('opds-catalog', 'catalog-uuid')

    expect(result).toBe(false)
  })
})

// ─── readCredential ───────────────────────────────────────────────────────────

describe('readCredential', () => {
  it('returns the secret string when invoke succeeds', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { secret: 'sk-secret-value' }, error: null })

    const result = await readCredential('opds-catalog', 'catalog-uuid')

    expect(result).toBe('sk-secret-value')
    const [path, options] = mockFunctionsInvoke.mock.calls[0]
    expect(path).toContain('read-credential')
    expect(path).toContain('credentialType=opds-catalog')
    expect(path).toContain('credentialId=catalog-uuid')
    expect(options.method).toBe('GET')
  })

  it('returns null when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await readCredential('opds-catalog', 'catalog-uuid')

    expect(result).toBeNull()
    expect(mockFunctionsInvoke).not.toHaveBeenCalled()
  })

  it('returns null when invoke returns an error (non-throwing)', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: new Error('not found') })

    const result = await readCredential('opds-catalog', 'catalog-uuid')

    expect(result).toBeNull()
  })

  it('returns null when invoke throws (non-throwing)', async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error('network error'))

    const result = await readCredential('opds-catalog', 'catalog-uuid')

    expect(result).toBeNull()
  })

  it('returns null when data.secret is not a string', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { secret: null }, error: null })

    const result = await readCredential('opds-catalog', 'catalog-uuid')

    expect(result).toBeNull()
  })
})

// ─── deleteCredential ─────────────────────────────────────────────────────────

describe('deleteCredential', () => {
  it('calls invoke with DELETE method and correct params', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { deleted: true }, error: null })

    await deleteCredential('ai-provider', 'openai')

    expect(mockFunctionsInvoke).toHaveBeenCalledOnce()
    const [path, options] = mockFunctionsInvoke.mock.calls[0]
    expect(path).toContain('delete-credential')
    expect(path).toContain('credentialType=ai-provider')
    expect(path).toContain('credentialId=openai')
    expect(options.method).toBe('DELETE')
  })

  it('is a no-op when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await deleteCredential('ai-provider', 'openai')

    expect(mockFunctionsInvoke).not.toHaveBeenCalled()
  })

  it('does not throw when invoke returns an error', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: new Error('delete failed') })

    await expect(deleteCredential('ai-provider', 'openai')).resolves.toBeUndefined()
  })

  it('does not throw when invoke throws', async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error('network error'))

    await expect(deleteCredential('ai-provider', 'openai')).resolves.toBeUndefined()
  })
})
