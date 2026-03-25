/**
 * Shared seeding helpers for E2E tests that need IndexedDB data.
 *
 * Provides both generic (seedIndexedDBStore/clearIndexedDBStore) and
 * typed convenience helpers (seedNotes, seedQuizzes, etc.).
 *
 * All helpers use the same retry pattern: open IDB → check store exists →
 * put data → retry with rAF polling if store not yet created by Dexie.
 *
 * Reference: TEA knowledge base - fixture-architecture.md
 */
import type { Page } from '@playwright/test'
import type { ImportedCourseTestData } from '../fixtures/factories/imported-course-factory'
import { goToCourses } from './navigation'
import { RETRY_CONFIG } from '../../utils/constants'

const DB_NAME = 'ElearningDB'

type IndexedDBSeed = {
  seedImportedCourses: (courses: ImportedCourseTestData[]) => Promise<void>
}

// ---------------------------------------------------------------------------
// Core: Generic IndexedDB seeding with retry
// ---------------------------------------------------------------------------

/**
 * Seed any IndexedDB object store with an array of records.
 * Retries with rAF-based polling if the store doesn't exist yet (Dexie init race).
 */
export async function seedIndexedDBStore(
  page: Page,
  dbName: string,
  storeName: string,
  data: Record<string, unknown>[]
): Promise<void> {
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
      throw new Error(`Store "${storeName}" not found in "${dbName}" after ${maxRetries} retries`)
    },
    {
      dbName,
      storeName,
      data,
      maxRetries: RETRY_CONFIG.MAX_ATTEMPTS,
      retryDelay: RETRY_CONFIG.POLL_INTERVAL,
    }
  )
}

/**
 * Clear all records from an IndexedDB object store.
 */
export async function clearIndexedDBStore(
  page: Page,
  dbName: string,
  storeName: string
): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName }) => {
      await new Promise<void>((resolve, reject) => {
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
          store.clear()
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
    { dbName, storeName }
  )
}

// ---------------------------------------------------------------------------
// Typed convenience helpers
// ---------------------------------------------------------------------------

/** Seed imported courses into the importedCourses store. */
export async function seedImportedCourses(
  page: Page,
  courses: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, DB_NAME, 'importedCourses', courses)
}

/** Seed imported videos into the importedVideos store. */
export async function seedImportedVideos(
  page: Page,
  videos: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, DB_NAME, 'importedVideos', videos)
}

/** Seed imported PDFs into the importedPdfs store. */
export async function seedImportedPdfs(page: Page, pdfs: Record<string, unknown>[]): Promise<void> {
  await seedIndexedDBStore(page, DB_NAME, 'importedPdfs', pdfs)
}

/** Seed notes into the notes store. */
export async function seedNotes(page: Page, notes: Record<string, unknown>[]): Promise<void> {
  await seedIndexedDBStore(page, DB_NAME, 'notes', notes)
}

/** Seed study sessions into the studySessions store. */
export async function seedStudySessions(
  page: Page,
  sessions: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, DB_NAME, 'studySessions', sessions)
}

/** Seed quiz definitions into the quizzes store. */
export async function seedQuizzes(page: Page, quizzes: Record<string, unknown>[]): Promise<void> {
  await seedIndexedDBStore(page, DB_NAME, 'quizzes', quizzes)
}

/** Seed quiz attempts into the quizAttempts store. */
export async function seedQuizAttempts(
  page: Page,
  attempts: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, DB_NAME, 'quizAttempts', attempts)
}

/** Seed vector embeddings into the embeddings store. */
export async function seedVectorEmbeddings(
  page: Page,
  embeddings: Record<string, unknown>[]
): Promise<void> {
  await seedIndexedDBStore(page, DB_NAME, 'embeddings', embeddings)
}

/** Clear the learningPaths store. */
export async function clearLearningPath(page: Page): Promise<void> {
  await clearIndexedDBStore(page, DB_NAME, 'learningPaths')
}

// ---------------------------------------------------------------------------
// Composite helper: navigate → seed → reload
// ---------------------------------------------------------------------------

/**
 * Navigate to Courses page, seed IndexedDB with courses, then reload
 * so Zustand picks up the seeded data.
 *
 * Also closes the sidebar on tablet viewport (Sheet overlay blocks clicks).
 */
export async function seedAndReload(
  page: Page,
  indexedDB: IndexedDBSeed,
  courses: ImportedCourseTestData[]
): Promise<void> {
  // goToCourses already handles sidebar state via addInitScript
  await goToCourses(page)
  await indexedDB.seedImportedCourses(courses)
  await page.reload({ waitUntil: 'domcontentloaded' })
}
