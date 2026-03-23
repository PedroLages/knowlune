/**
 * E20-S04: Skill Proficiency Radar Chart — ATDD Tests
 *
 * Validates:
 *   - Radar chart section displays on Overview dashboard
 *   - Chart has accessible aria-label with proficiency data
 *
 * Strategy: explicitly seed the `courses` IndexedDB table with 3 courses
 * spanning distinct categories before navigating, so the chart renders
 * deterministically regardless of requestIdleCallback timing.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import type { Page } from '@playwright/test'

const TEST_COURSES = [
  {
    id: 'e20s04-course-1',
    title: 'Behavioral Analysis Fundamentals',
    shortTitle: 'BA-101',
    description: 'Test course',
    category: 'behavioral-analysis',
    difficulty: 'beginner',
    totalLessons: 0,
    totalVideos: 0,
    totalPDFs: 0,
    estimatedHours: 2,
    tags: ['test'],
    modules: [],
    isSequential: false,
    basePath: '/courses/e20s04-1',
    authorId: 'test-author',
  },
  {
    id: 'e20s04-course-2',
    title: 'Influence Authority Mastery',
    shortTitle: 'IA-101',
    description: 'Test course',
    category: 'influence-authority',
    difficulty: 'intermediate',
    totalLessons: 0,
    totalVideos: 0,
    totalPDFs: 0,
    estimatedHours: 3,
    tags: ['test'],
    modules: [],
    isSequential: false,
    basePath: '/courses/e20s04-2',
    authorId: 'test-author',
  },
  {
    id: 'e20s04-course-3',
    title: 'Confidence Mastery Workshop',
    shortTitle: 'CM-101',
    description: 'Test course',
    category: 'confidence-mastery',
    difficulty: 'advanced',
    totalLessons: 0,
    totalVideos: 0,
    totalPDFs: 0,
    estimatedHours: 4,
    tags: ['test'],
    modules: [],
    isSequential: false,
    basePath: '/courses/e20s04-3',
    authorId: 'test-author',
  },
]

/** Seed the Dexie `courses` table with retry (waits for DB to be initialized). */
async function seedCoursesIntoIDB(page: Page): Promise<void> {
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
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error(`Store "${storeName}" not found in "${dbName}" after ${maxRetries} retries`)
    },
    {
      dbName: 'ElearningDB',
      storeName: 'courses',
      data: TEST_COURSES,
      maxRetries: 10,
      retryDelay: 200,
    }
  )
}

/** Navigate to Overview with pre-seeded multi-category courses. */
async function goToOverviewWithCourses(page: Page): Promise<void> {
  // First navigation: initializes IndexedDB schema
  await navigateAndWait(page, '/')
  // Seed courses into the `courses` table
  await seedCoursesIntoIDB(page)
  // Reload so `loadCourses()` reads the seeded data from IndexedDB
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  // Wait for loading state to complete (stats grid appears after 500ms spinner)
  await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })
}

test.describe('E20-S04: Skill Proficiency Radar Chart', () => {
  test('displays radar chart section on Overview with pre-seeded courses', async ({ page }) => {
    await goToOverviewWithCourses(page)

    const heading = page.getByRole('heading', { name: 'Skill Proficiency' })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()

    const chart = page.getByRole('img', { name: /skill proficiency/i })
    await expect(chart).toBeVisible()
  })

  test('radar chart aria-label contains proficiency percentages', async ({ page }) => {
    await goToOverviewWithCourses(page)

    const chart = page.getByRole('img', { name: /skill proficiency/i })
    await chart.scrollIntoViewIfNeeded()
    await expect(chart).toBeVisible()

    const label = await chart.getAttribute('aria-label')
    expect(label).toContain('%')
    expect(label).toContain('Skill proficiency:')
  })
})
