/**
 * Navigation helpers for LevelUp E2E tests.
 *
 * Pure functions that accept Page as a parameter.
 * Reference: TEA knowledge base - fixture-architecture.md (pure function pattern)
 */
import type { Page } from '@playwright/test'

/** Navigate to a page and wait for the main content area to be visible. */
export async function navigateAndWait(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await page.waitForLoadState('domcontentloaded')
}

/** Navigate to the Overview (home) page. */
export async function goToOverview(page: Page): Promise<void> {
  await navigateAndWait(page, '/')
}

/** Navigate to the Courses page. */
export async function goToCourses(page: Page): Promise<void> {
  await navigateAndWait(page, '/courses')
}

/** Navigate to the My Class page. */
export async function goToMyClass(page: Page): Promise<void> {
  await navigateAndWait(page, '/my-class')
}

/** Navigate to the Messages page. */
export async function goToMessages(page: Page): Promise<void> {
  await navigateAndWait(page, '/messages')
}

/** Navigate to the Reports page. */
export async function goToReports(page: Page): Promise<void> {
  await navigateAndWait(page, '/reports')
}

/** Navigate to the Settings page. */
export async function goToSettings(page: Page): Promise<void> {
  await navigateAndWait(page, '/settings')
}

/** Navigate to a specific course detail page. */
export async function goToCourse(page: Page, courseId: string): Promise<void> {
  await navigateAndWait(page, `/courses/${courseId}`)
}
