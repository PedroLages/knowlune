/**
 * Unit tests for encryption utilities
 *
 * Validates:
 * - Encrypt/decrypt roundtrip integrity
 * - Different IVs produce different ciphertexts
 * - Decryption fails with wrong IV
 * - Encrypted data doesn't contain plaintext
 * - Error handling for invalid inputs
 */

import { describe, it, expect } from 'vitest'
import { encryptData, decryptData } from '../crypto'

describe('crypto utilities', () => {
  describe('encryptData', () => {
    it('encrypts plaintext and returns IV and encrypted data', async () => {
      const plaintext = 'sk-test-secret-key-12345'
      const result = await encryptData(plaintext)

      expect(result.iv).toBeDefined()
      expect(result.encryptedData).toBeDefined()
      expect(result.iv).toHaveLength(24) // 12 bytes hex-encoded (12 * 2)
      expect(result.encryptedData.length).toBeGreaterThan(0)
    })

    it('produces different ciphertexts with different IVs', async () => {
      const plaintext = 'sk-test-secret-key-12345'

      const result1 = await encryptData(plaintext)
      const result2 = await encryptData(plaintext)

      // Different IVs
      expect(result1.iv).not.toBe(result2.iv)
      // Different ciphertexts
      expect(result1.encryptedData).not.toBe(result2.encryptedData)
    })

    it('encrypted data does not contain plaintext', async () => {
      const plaintext = 'sk-test-secret-key-12345'
      const result = await encryptData(plaintext)

      // Neither IV nor encrypted data should contain plaintext
      expect(result.iv).not.toContain('sk-test')
      expect(result.encryptedData).not.toContain('sk-test')
      expect(result.encryptedData).not.toContain('secret')
      expect(result.encryptedData).not.toContain('key')
    })

    it('handles empty string', async () => {
      const plaintext = ''
      const result = await encryptData(plaintext)

      expect(result.iv).toBeDefined()
      expect(result.encryptedData).toBeDefined()
    })
  })

  describe('decryptData', () => {
    it('decrypts data encrypted with encryptData', async () => {
      const plaintext = 'sk-test-secret-key-12345'

      // Generate a key to use for both operations
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ])

      const encrypted = await encryptData(plaintext, key)
      const decrypted = await decryptData(encrypted.iv, encrypted.encryptedData, key)

      expect(decrypted).toBe(plaintext)
    })

    it('roundtrip with multiple plaintexts', async () => {
      const testCases = [
        'sk-openai-key-abc123',
        'sk-ant-anthropic-key-xyz789',
        'short',
        'a very long api key with many characters 0123456789',
        '!@#$%^&*()_+-=[]{}|;:,.<>?',
      ]

      for (const plaintext of testCases) {
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
          'encrypt',
          'decrypt',
        ])

        const encrypted = await encryptData(plaintext, key)
        const decrypted = await decryptData(encrypted.iv, encrypted.encryptedData, key)

        expect(decrypted).toBe(plaintext)
      }
    })

    it('fails with wrong IV', async () => {
      const plaintext = 'sk-test-secret-key-12345'

      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ])

      const encrypted = await encryptData(plaintext, key)

      // Use a different IV
      const wrongIv = '000000000000000000000000'

      await expect(decryptData(wrongIv, encrypted.encryptedData, key)).rejects.toThrow()
    })

    it('fails with tampered encrypted data', async () => {
      const plaintext = 'sk-test-secret-key-12345'

      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ])

      const encrypted = await encryptData(plaintext, key)

      // Tamper with encrypted data
      const tampered = encrypted.encryptedData.replace(/[0-9]/, 'f')

      await expect(decryptData(encrypted.iv, tampered, key)).rejects.toThrow()
    })

    it('fails with invalid hex string format', async () => {
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ])

      // Invalid hex (odd length)
      await expect(decryptData('abc', 'def', key)).rejects.toThrow()

      // Invalid hex characters
      await expect(decryptData('gg00', 'hh00', key)).rejects.toThrow()
    })
  })

  describe('encryption security properties', () => {
    it('uses authenticated encryption (AES-GCM)', async () => {
      // AES-GCM provides both confidentiality and integrity
      const plaintext = 'sk-test-secret-key-12345'

      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ])

      const encrypted = await encryptData(plaintext, key)

      // Tampering should be detected (integrity protection)
      const tampered = encrypted.encryptedData.slice(0, -2) + 'ff'

      await expect(decryptData(encrypted.iv, tampered, key)).rejects.toThrow()
    })

    it('generates cryptographically secure random IVs', async () => {
      // Generate multiple IVs and ensure they're unique
      const ivs = new Set<string>()
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        const result = await encryptData('test')
        ivs.add(result.iv)
      }

      // All IVs should be unique (probability of collision is negligible)
      expect(ivs.size).toBe(iterations)
    })
  })
})
