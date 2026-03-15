import type { Page } from '@playwright/test'

const RETRY_DELAY_MS = 200
const MAX_RETRIES = 10

/**
 * Seeds an IndexedDB object store with data, retrying if the store doesn't exist yet.
 * Uses frame-accurate delays via requestAnimationFrame instead of Date.now().
 *
 * @param page - Playwright Page instance
 * @param dbName - IndexedDB database name
 * @param storeName - Object store name
 * @param data - Array of records to insert
 * @throws Error if store not found after MAX_RETRIES attempts
 */
export async function seedIndexedDBStore(
  page: Page,
  dbName: string,
  storeName: string,
  data: Record<string, unknown>[]
): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, data, retryDelay, maxRetries }) => {
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

        // Frame-accurate wait using requestAnimationFrame tick counting
        // Assumes 60fps (~16.67ms per frame)
        await new Promise<void>(resolve => {
          let ticks = 0
          const targetTicks = Math.ceil(retryDelay / 16.67)
          const tick = () => {
            ticks++
            if (ticks >= targetTicks) resolve()
            else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
      }
      throw new Error(
        `Store "${storeName}" not found in database "${dbName}" after ${maxRetries} retries`
      )
    },
    { dbName, storeName, data, retryDelay: RETRY_DELAY_MS, maxRetries: MAX_RETRIES }
  )
}

/**
 * Seeds the studySessions object store in ElearningDB.
 * Convenience wrapper around seedIndexedDBStore.
 *
 * @param page - Playwright Page instance
 * @param sessions - Array of study session records
 */
export async function seedStudySessions(
  page: Page,
  sessions: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'studySessions', sessions)
}

/**
 * Seeds the importedVideos object store in ElearningDB.
 * Convenience wrapper around seedIndexedDBStore.
 *
 * @param page - Playwright Page instance
 * @param videos - Array of imported video records
 */
export async function seedImportedVideos(
  page: Page,
  videos: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'importedVideos', videos)
}

/**
 * Seeds the importedPdfs object store in ElearningDB.
 * Convenience wrapper around seedIndexedDBStore.
 *
 * @param page - Playwright Page instance
 * @param pdfs - Array of imported PDF records
 */
export async function seedImportedPdfs(page: Page, pdfs: Record<string, unknown>[]): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'importedPdfs', pdfs)
}

/**
 * Seeds the importedCourses object store in ElearningDB.
 * Convenience wrapper around seedIndexedDBStore.
 *
 * @param page - Playwright Page instance
 * @param courses - Array of imported course records
 */
export async function seedImportedCourses(
  page: Page,
  courses: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'importedCourses', courses)
}

/**
 * Seeds the contentProgress object store in ElearningDB.
 * Convenience wrapper around seedIndexedDBStore.
 *
 * @param page - Playwright Page instance
 * @param progress - Array of content progress records
 */
export async function seedContentProgress(
  page: Page,
  progress: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'contentProgress', progress)
}

/**
 * Seeds the embeddings object store in ElearningDB.
 * Convenience wrapper around seedIndexedDBStore.
 *
 * @param page - Playwright Page instance
 * @param embeddings - Array of embedding records ({ noteId, embedding, createdAt })
 */
export async function seedVectorEmbeddings(
  page: Page,
  embeddings: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'embeddings', embeddings)
}

/**
 * Clears all records from an IndexedDB object store.
 * Uses frame-accurate delays via requestAnimationFrame instead of Date.now().
 *
 * @param page - Playwright Page instance
 * @param dbName - IndexedDB database name
 * @param storeName - Object store name to clear
 * @throws Error if store not found after MAX_RETRIES attempts
 */
export async function clearIndexedDBStore(
  page: Page,
  dbName: string,
  storeName: string
): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, retryDelay, maxRetries }) => {
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
            store.clear()
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

        // Frame-accurate wait using requestAnimationFrame tick counting
        await new Promise<void>(resolve => {
          let ticks = 0
          const targetTicks = Math.ceil(retryDelay / 16.67)
          const tick = () => {
            ticks++
            if (ticks >= targetTicks) resolve()
            else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
      }
      throw new Error(
        `Store "${storeName}" not found in database "${dbName}" after ${maxRetries} retries`
      )
    },
    { dbName, storeName, retryDelay: RETRY_DELAY_MS, maxRetries: MAX_RETRIES }
  )
}

/**
 * Clears the learningPath object store in ElearningDB.
 * Convenience wrapper around clearIndexedDBStore.
 *
 * @param page - Playwright Page instance
 */
export async function clearLearningPath(page: Page): Promise<void> {
  await clearIndexedDBStore(page, 'ElearningDB', 'learningPath')
}
