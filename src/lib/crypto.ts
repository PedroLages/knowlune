/**
 * Cryptographic utilities for secure API key encryption using Web Crypto API
 *
 * Uses AES-GCM (Galois/Counter Mode) for authenticated encryption providing
 * both confidentiality and integrity protection for sensitive data.
 *
 * Security guarantees:
 * - 256-bit AES encryption
 * - Unique random IV per encryption operation
 * - Authenticated encryption prevents tampering
 * - No keys persisted (generated per-session)
 */

export interface EncryptedData {
  /** Initialization Vector (12 bytes, hex-encoded) */
  iv: string
  /** Encrypted data (hex-encoded) */
  encryptedData: string
}

/**
 * Session-scoped encryption key singleton
 *
 * Maintains the same key across multiple encrypt/decrypt operations within
 * a browser session. Key is regenerated only when:
 * - Browser tab is closed/refreshed
 * - User explicitly clears session storage
 *
 * This ensures encrypted data can be decrypted during the same session
 * without persisting keys to disk (which would be a security risk).
 */
let _sessionKey: CryptoKey | null = null

/**
 * Gets or generates the session-scoped encryption key
 *
 * @returns CryptoKey that persists for the duration of the browser session
 */
async function getSessionKey(): Promise<CryptoKey> {
  if (!_sessionKey) {
    _sessionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable
      ['encrypt', 'decrypt']
    )
  }
  return _sessionKey
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
