/**
 * Shared seeding helpers for E2E tests that need IndexedDB data.
 *
 * Encapsulates the navigate → seed → reload pattern used across
 * story-1-2, story-1-3, and future specs that test imported courses.
 *
 * Reference: TEA knowledge base - fixture-architecture.md
 */
import type { Page } from '@playwright/test'
import type { ImportedCourseTestData } from '../fixtures/factories/imported-course-factory'
import { goToCourses } from './navigation'
import { closeSidebar } from '@/tests/support/fixtures/constants/sidebar-constants'

type IndexedDBSeed = {
  seedImportedCourses: (courses: ImportedCourseTestData[]) => Promise<void>
}

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
  // Ensure sidebar is closed on tablet so Sheet overlay doesn't block clicks
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  await goToCourses(page)
  await indexedDB.seedImportedCourses(courses)
  await page.reload({ waitUntil: 'domcontentloaded' })
}
