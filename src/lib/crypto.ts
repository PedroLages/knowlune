/**
 * Cryptographic utilities for secure API key encryption using Web Crypto API
 *
 * Uses AES-GCM (Galois/Counter Mode) for authenticated encryption providing
 * both confidentiality and integrity protection for sensitive data.
 *
 * Security guarantees:
 * - 256-bit AES encryption (non-extractable key)
 * - Unique random IV per encryption operation
 * - Authenticated encryption prevents tampering
 * - Key persisted in IndexedDB via cryptoKeyStore.ts — survives page refresh
 * - Non-extractable: even malicious extensions cannot export the raw key bytes
 */

import { loadCryptoKey, saveCryptoKey } from './cryptoKeyStore'

export interface EncryptedData {
  /** Initialization Vector (12 bytes, hex-encoded) */
  iv: string
  /** Encrypted data (hex-encoded) */
  encryptedData: string
}

/**
 * In-memory cache for the encryption key.
 *
 * The canonical key lives in IndexedDB ("CryptoKeyStore"). This variable
 * is a fast-path cache that avoids hitting IndexedDB on every encrypt/decrypt
 * call within a session. On page refresh the cache is empty and the key is
 * reloaded from IndexedDB.
 */
let _sessionKey: CryptoKey | null = null

/**
 * Gets or generates the persistent encryption key.
 *
 * Resolution order:
 * 1. In-memory cache (_sessionKey) — fast path, no I/O
 * 2. IndexedDB ("CryptoKeyStore") — survives page refresh
 * 3. Generate new key → persist to IndexedDB → cache in memory
 */
async function getSessionKey(): Promise<CryptoKey> {
  if (_sessionKey) return _sessionKey

  // Try loading persisted key from IndexedDB
  try {
    const persisted = await loadCryptoKey()
    if (persisted) {
      _sessionKey = persisted
      return _sessionKey
    }
  } catch {
    // IndexedDB unavailable (e.g. Firefox private browsing quirks) — fall through to generate
  }

  // Generate new non-extractable key and persist it
  _sessionKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable: prevents extension-based key theft
    ['encrypt', 'decrypt']
  )

  try {
    await saveCryptoKey(_sessionKey)
  } catch {
    // IndexedDB write failed — key still works in-memory for this session
  }

  return _sessionKey
}

/** @internal Clear in-memory key cache to simulate page refresh in tests. */
export function _resetKeyCache(): void {
  _sessionKey = null
}

/**
 * Encrypts plaintext using AES-GCM with a generated or provided key
 *
 * @param plaintext - The sensitive data to encrypt (e.g., API key)
 * @param key - Optional crypto key (generated if not provided)
 * @returns Object containing IV and encrypted data (both hex-encoded)
 *
 * @example
 * const encrypted = await encryptData('sk-secret-api-key')
 * // Returns: { iv: '3a7f...', encryptedData: '9d2e...' }
 */
export async function encryptData(plaintext: string, key?: CryptoKey): Promise<EncryptedData> {
  // Use session key or provided key
  const cryptoKey = key || (await getSessionKey())

  // Generate random IV (Initialization Vector) - must be unique per encryption
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encode plaintext to bytes
  const encoder = new TextEncoder()
  const encodedData = encoder.encode(plaintext)

  // Encrypt using AES-GCM
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedData
  )

  // Convert to hex strings for storage
  return {
    iv: bytesToHex(iv),
    encryptedData: bytesToHex(new Uint8Array(encryptedBuffer)),
  }
}

/**
 * Decrypts data encrypted with encryptData()
 *
 * @param iv - Initialization vector (hex-encoded)
 * @param encryptedData - Encrypted data (hex-encoded)
 * @param key - Optional crypto key (generated if not provided, must match encryption key)
 * @returns Decrypted plaintext string
 * @throws {Error} If decryption fails (wrong key, tampered data, or invalid format)
 *
 * @example
 * const plaintext = await decryptData(encrypted.iv, encrypted.encryptedData)
 * // Returns: 'sk-secret-api-key'
 */
export async function decryptData(
  iv: string,
  encryptedData: string,
  key?: CryptoKey
): Promise<string> {
  const cryptoKey = key || (await getSessionKey())

  // Convert hex strings back to byte arrays
  const ivArray = hexToBytes(iv)
  const dataArray = hexToBytes(encryptedData)

  // Decrypt using AES-GCM
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArray as unknown as BufferSource },
    cryptoKey,
    dataArray as unknown as BufferSource
  )

  // Decode bytes to string
  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}

/**
 * Converts byte array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Converts hex string to byte array
 */
function hexToBytes(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g)
  if (!matches) {
    throw new Error('Invalid hex string format')
  }
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)))
}
