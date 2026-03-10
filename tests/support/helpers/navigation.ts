/**
 * Navigation helpers for LevelUp E2E tests.
 *
 * Pure functions that accept Page as a parameter.
 * Reference: TEA knowledge base - fixture-architecture.md (pure function pattern)
 */
import type { Page } from '@playwright/test'

/** Navigate to a page and wait for the main content area to be visible. */
export async function navigateAndWait(page: Page, path: string): Promise<void> {
  // Seed sidebar state BEFORE navigation to prevent overlay blocking on tablet/mobile viewports
  // (eduvi-sidebar-v1 defaults to open=true at 640-1023px, creating fullscreen Sheet overlay)
  await page.evaluate(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await page.goto(path)
  await page.waitForLoadState('load')
}

/** Navigate to the Overview (home) page. */
export async function goToOverview(page: Page): Promise<void> {
  await navigateAndWait(page, '/')
  // Wait for stats grid to be visible (ensures loading state is complete)
  await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })
}

/** Navigate to the Courses page. */
export async function goToCourses(page: Page): Promise<void> {
  await navigateAndWait(page, '/courses')
  // Wait for either the courses heading or the "no courses" state
  await Promise.race([
    page.waitForSelector('h1:has-text("All Courses")', { state: 'visible', timeout: 10000 }),
    page.waitForSelector('text=No courses found', { state: 'visible', timeout: 10000 }),
  ]).catch(() => {
    // If neither appears, that's okay - continue anyway
  })
}

/** Navigate to the My Class page. */
export async function goToMyClass(page: Page): Promise<void> {
  await navigateAndWait(page, '/my-class')
  // Wait for page heading to confirm render
  await page
    .waitForSelector('h1:has-text("My Class")', { state: 'visible', timeout: 10000 })
    .catch(() => {})
}

/** Navigate to the Messages page. */
export async function goToMessages(page: Page): Promise<void> {
  await navigateAndWait(page, '/messages')
  // Wait for page heading to confirm render
  await page.waitForSelector('h1', { state: 'visible', timeout: 10000 }).catch(() => {})
}

/** Navigate to the Reports page. */
export async function goToReports(page: Page): Promise<void> {
  await navigateAndWait(page, '/reports')
  // Wait for page heading to confirm render
  await page.waitForSelector('h1', { state: 'visible', timeout: 10000 }).catch(() => {})
}

/** Navigate to the Settings page. */
export async function goToSettings(page: Page): Promise<void> {
  await navigateAndWait(page, '/settings')
  // Wait for page heading to confirm render
  await page.waitForSelector('h1', { state: 'visible', timeout: 10000 }).catch(() => {})
}

/** Navigate to a specific course detail page. */
export async function goToCourse(page: Page, courseId: string): Promise<void> {
  await navigateAndWait(page, `/courses/${courseId}`)
}
