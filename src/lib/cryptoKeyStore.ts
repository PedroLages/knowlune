/**
 * Standalone IndexedDB store for persistent CryptoKey storage.
 *
 * Stores the AES-256-GCM encryption key used by crypto.ts in a dedicated
 * IndexedDB database ("CryptoKeyStore"), separate from the app's Dexie DB.
 *
 * Why standalone (not Dexie): CryptoKey objects with extractable=false are
 * stored natively via the structured clone algorithm. Dexie's serialization
 * layer has edge cases with non-extractable keys. A single-row store doesn't
 * justify a Dexie table, migration, and checkpoint update.
 *
 * @see W3C Web Crypto — IndexedDB is the recommended persistence for CryptoKey
 */

const DB_NAME = 'CryptoKeyStore'
const STORE_NAME = 'keys'
const DB_VERSION = 1
const RECORD_KEY = 'session'

let _dbPromise: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (!_dbPromise) {
    _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        _dbPromise = null
        reject(request.error)
      }
    })
  }
  return _dbPromise
}

/** Load the persisted CryptoKey, or null if none exists. */
export async function loadCryptoKey(): Promise<CryptoKey | null> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(RECORD_KEY)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Persist a CryptoKey. Uses add() first to avoid overwriting in a multi-tab
 * race, falling back to the existing key if one was already written.
 */
export async function saveCryptoKey(key: CryptoKey): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const addRequest = store.add(key, RECORD_KEY)
    addRequest.onsuccess = () => resolve()
    addRequest.onerror = () => {
      // ConstraintError: key already exists (another tab wrote first) — safe to ignore
      if (addRequest.error?.name === 'ConstraintError') {
        tx.abort()
        resolve()
      } else {
        reject(addRequest.error)
      }
    }
  })
}

/** Remove the persisted key (for testing or explicit key rotation). */
export async function deleteCryptoKey(): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(RECORD_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Close connection and reset cached DB promise (for test isolation). */
export async function _resetDBForTesting(): Promise<void> {
  if (_dbPromise) {
    try {
      const db = await _dbPromise
      db.close()
    } catch {
      // DB open may have failed — ignore
    }
  }
  _dbPromise = null
}
