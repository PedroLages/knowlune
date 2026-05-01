/**
 * Integration tests for API key persistence across page refreshes.
 *
 * Uses real crypto (no mocks) + fake-indexeddb to validate the full chain:
 *   saveProviderApiKey() → encryptData() → localStorage
 *   → [page refresh] →
 *   getDecryptedApiKeyForProvider() → loadCryptoKey() → decryptData()
 *   → [IndexedDB cleared] →
 *   getDecryptedApiKeyForProvider() → Vault fallback → re-encrypt
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { _resetKeyCache } from '../crypto'
import { _resetDBForTesting } from '../cryptoKeyStore'

const vaultMocks = vi.hoisted(() => ({
  readCredential: vi.fn().mockResolvedValue(null),
  storeCredential: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/vaultCredentials', () => ({
  checkCredential: vi.fn(),
  storeCredential: vaultMocks.storeCredential,
  readCredential: vaultMocks.readCredential,
}))

// We need localStorage for aiConfiguration / youtubeConfiguration
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

// Stub window.dispatchEvent to prevent errors (custom events for cross-tab sync)
vi.stubGlobal('dispatchEvent', vi.fn())

// Import AFTER mocks are set up
const { saveProviderApiKey, getDecryptedApiKeyForProvider } = await import('../aiConfiguration')
const { saveYouTubeConfiguration, getDecryptedYouTubeApiKey } =
  await import('../youtubeConfiguration')

beforeEach(async () => {
  _resetKeyCache()
  await _resetDBForTesting()
  localStorageMock.clear()
  indexedDB.deleteDatabase('CryptoKeyStore')
  vaultMocks.readCredential.mockReset().mockResolvedValue(null)
  vaultMocks.storeCredential.mockClear()
})

describe('API key persistence across page refresh', () => {
  it('provider key survives simulated page refresh', async () => {
    // Save a provider API key (encrypts with session key, persists key to IndexedDB)
    await saveProviderApiKey('openai', 'sk-test-openai-key-12345678')

    // Simulate page refresh: clear in-memory key cache
    _resetKeyCache()

    // Key should be decryptable (session key reloaded from IndexedDB)
    const decrypted = await getDecryptedApiKeyForProvider('openai')
    expect(decrypted).toBe('sk-test-openai-key-12345678')
  })

  it('multiple provider keys survive refresh', async () => {
    await saveProviderApiKey('openai', 'sk-openai-abc12345678')
    await saveProviderApiKey('anthropic', 'sk-ant-xyz12345678')
    await saveProviderApiKey('glm', 'glm-key-12345678abcd')

    _resetKeyCache()

    expect(await getDecryptedApiKeyForProvider('openai')).toBe('sk-openai-abc12345678')
    expect(await getDecryptedApiKeyForProvider('anthropic')).toBe('sk-ant-xyz12345678')
    expect(await getDecryptedApiKeyForProvider('glm')).toBe('glm-key-12345678abcd')
  })

  it('YouTube API key survives refresh', async () => {
    await saveYouTubeConfiguration({}, 'AIzaSyTestYouTubeKey12345')

    _resetKeyCache()

    const decrypted = await getDecryptedYouTubeApiKey()
    expect(decrypted).toBe('AIzaSyTestYouTubeKey12345')
  })

  it('recovers key from Vault when IndexedDB is cleared', async () => {
    await saveProviderApiKey('openai', 'sk-will-survive-12345678')

    // Simulate user clearing browsing data (IndexedDB lost, new CryptoKey)
    _resetKeyCache()
    await _resetDBForTesting()
    indexedDB.deleteDatabase('CryptoKeyStore')

    // Vault has the plaintext key
    vaultMocks.readCredential.mockResolvedValue('sk-will-survive-12345678')

    const decrypted = await getDecryptedApiKeyForProvider('openai')
    expect(decrypted).toBe('sk-will-survive-12345678')
    expect(vaultMocks.readCredential).toHaveBeenCalledWith('ai-provider', 'openai')
  })

  it('returns null when IndexedDB is cleared and Vault has no credential', async () => {
    await saveProviderApiKey('openai', 'sk-will-be-lost-12345678')

    _resetKeyCache()
    await _resetDBForTesting()
    indexedDB.deleteDatabase('CryptoKeyStore')

    // Vault has no credential for this provider (default mock returns null)
    const decrypted = await getDecryptedApiKeyForProvider('openai')
    expect(decrypted).toBeNull()
  })

  it('self-heals after Vault recovery: second call decrypts locally', async () => {
    await saveProviderApiKey('openai', 'sk-self-healing-12345678')

    // Clear IndexedDB
    _resetKeyCache()
    await _resetDBForTesting()
    indexedDB.deleteDatabase('CryptoKeyStore')

    // First call: Vault recovers the key and re-encrypts locally
    vaultMocks.readCredential.mockResolvedValue('sk-self-healing-12345678')
    const first = await getDecryptedApiKeyForProvider('openai')
    expect(first).toBe('sk-self-healing-12345678')
    expect(vaultMocks.readCredential).toHaveBeenCalledTimes(1)

    // Second call: local decrypt succeeds, no Vault call needed
    vaultMocks.readCredential.mockClear()
    _resetKeyCache() // simulate another refresh
    const second = await getDecryptedApiKeyForProvider('openai')
    expect(second).toBe('sk-self-healing-12345678')
    expect(vaultMocks.readCredential).not.toHaveBeenCalled()
  })

  it('provider without saved key returns null', async () => {
    await saveProviderApiKey('openai', 'sk-test-12345678')

    _resetKeyCache()

    // Anthropic was never saved
    const decrypted = await getDecryptedApiKeyForProvider('anthropic')
    expect(decrypted).toBeNull()
  })
})
