/**
 * IndexedDB fixture for seeding and cleaning up Dexie database state.
 *
 * The EduVi app stores imported courses in IndexedDB via Dexie.js:
 *   - Database: 'ElearningDB'
 *   - Table: 'importedCourses' (key: 'id', indexes: name, importedAt, *tags)
 *
 * Usage:
 *   1. Navigate to any page first (so Dexie creates the database)
 *   2. Call indexedDB.seedImportedCourses(courses)
 *   3. Reload the page to trigger Zustand store's loadImportedCourses()
 *
 * Auto-cleanup removes seeded data after each test.
 *
 * Reference: TEA knowledge base - fixture-architecture.md
 */
import { test as base, type Page } from '@playwright/test'
import type { ImportedCourseTestData } from './factories/imported-course-factory'

const DB_NAME = 'ElearningDB'
const STORE_NAME = 'importedCourses'

type IndexedDBHelper = {
  /** Seed imported courses into IndexedDB. Page must have navigated first. */
  seedImportedCourses: (courses: ImportedCourseTestData[]) => Promise<void>
  /** Clear all imported courses from IndexedDB. */
  clearImportedCourses: () => Promise<void>
  /** Clear all records from a named store. Useful for UI-created data (notes, etc). */
  clearStore: (storeName: string) => Promise<void>
}

async function putRecords(page: Page, courses: ImportedCourseTestData[]): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, data, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open(dbName)
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(storeName)) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
            for (const item of data) {
              store.put(item)
            }
            tx.oncomplete = () => {
              db.close()
              resolve('ok')
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
          request.onerror = () => reject(request.error)
        })
        if (result === 'ok') return
        // Store not yet created by Dexie — wait and retry
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error(`Store "${storeName}" not found in "${dbName}" after ${maxRetries} retries`)
    },
    { dbName: DB_NAME, storeName: STORE_NAME, data: courses, maxRetries: 10, retryDelay: 200 }
  )
}

async function clearRecords(page: Page, ids: string[]): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, recordIds }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) {
            db.close()
            resolve()
            return
          }
          const tx = db.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          for (const id of recordIds) {
            store.delete(id)
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    },
    { dbName: DB_NAME, storeName: STORE_NAME, recordIds: ids }
  )
}

async function clearAllFromStore(page: Page, storeName: string): Promise<void> {
  await page.evaluate(
    async ({ dbName, store }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(store)) {
            db.close()
            resolve()
            return
          }
          const tx = db.transaction(store, 'readwrite')
          tx.objectStore(store).clear()
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    },
    { dbName: DB_NAME, store: storeName }
  )
}

export const test = base.extend<{ indexedDB: IndexedDBHelper }>({
  indexedDB: async ({ page }, use) => {
    const seededIds: string[] = []

    const helper: IndexedDBHelper = {
      seedImportedCourses: async courses => {
        await putRecords(page, courses)
        seededIds.push(...courses.map(c => c.id))
      },

      clearImportedCourses: async () => {
        if (seededIds.length > 0) {
          await clearRecords(page, seededIds)
          seededIds.length = 0
        }
      },

      clearStore: async (storeName: string) => {
        await clearAllFromStore(page, storeName)
      },
    }

    await use(helper)

    // Auto-cleanup: remove all seeded records
    try {
      if (seededIds.length > 0) {
        await clearRecords(page, seededIds)
      }
    } catch {
      // Page may already be closed; ignore cleanup errors
    }
  },
})
