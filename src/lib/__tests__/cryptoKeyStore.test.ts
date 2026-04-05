import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadCryptoKey,
  saveCryptoKey,
  deleteCryptoKey,
  _resetDBForTesting,
} from '../cryptoKeyStore'

async function generateTestKey(extractable = false): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt']
  )
}

beforeEach(async () => {
  await _resetDBForTesting()
  indexedDB.deleteDatabase('CryptoKeyStore')
})

describe('cryptoKeyStore', () => {
  it('returns null when store is empty', async () => {
    const key = await loadCryptoKey()
    expect(key).toBeNull()
  })

  it('saves and loads a CryptoKey', async () => {
    const key = await generateTestKey(true)
    await saveCryptoKey(key)

    const loaded = await loadCryptoKey()
    expect(loaded).not.toBeNull()
    expect(loaded!.algorithm).toEqual(key.algorithm)
    expect(loaded!.usages).toEqual(key.usages)
  })

  it('deleteCryptoKey removes the key', async () => {
    const key = await generateTestKey()
    await saveCryptoKey(key)
    expect(await loadCryptoKey()).not.toBeNull()

    await deleteCryptoKey()
    expect(await loadCryptoKey()).toBeNull()
  })

  it('second saveCryptoKey does not overwrite (race-safe add)', async () => {
    const key1 = await generateTestKey(true)
    const key2 = await generateTestKey(true)

    await saveCryptoKey(key1)
    // Second save should silently succeed without overwriting
    await saveCryptoKey(key2)

    const loaded = await loadCryptoKey()
    expect(loaded).not.toBeNull()

    // Verify the first key is still there by exporting both and comparing
    const loadedRaw = await crypto.subtle.exportKey('raw', loaded!)
    const key1Raw = await crypto.subtle.exportKey('raw', key1)
    expect(new Uint8Array(loadedRaw)).toEqual(new Uint8Array(key1Raw))
  })

  it('getDB is idempotent across multiple calls', async () => {
    const key = await generateTestKey()
    await saveCryptoKey(key)

    // Multiple loads should all work (same DB connection)
    const [a, b, c] = await Promise.all([loadCryptoKey(), loadCryptoKey(), loadCryptoKey()])
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(c).not.toBeNull()
  })
})
