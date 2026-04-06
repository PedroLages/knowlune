/**
 * Navigation helpers for Knowlune E2E tests.
 *
 * Pure functions that accept Page as a parameter.
 * Reference: TEA knowledge base - fixture-architecture.md (pure function pattern)
 */
import type { Page } from '@playwright/test'

/** Navigate to a page and wait for the main content area to be visible. */
export async function navigateAndWait(page: Page, path: string): Promise<void> {
  // Seed sidebar state BEFORE navigation to prevent overlay blocking on tablet/mobile viewports
  // (knowlune-sidebar-v1 defaults to open=true at 640-1023px, creating fullscreen Sheet overlay)
  // Also dismiss onboarding overlay to prevent it from blocking test interactions (E25-S07).
  // Tests that need the overlay visible (e.g., onboarding.spec.ts) set __test_show_onboarding=1
  // before calling navigateAndWait; that flag tells us to skip seeding the dismissal.
  // Use addInitScript instead of evaluate to ensure localStorage is accessible before page loads
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
    if (!localStorage.getItem('__test_show_onboarding')) {
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
      // Dismiss WelcomeWizard (uses a different storage key than onboarding)
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    }
  })
  await page.goto(path)
  await page.waitForLoadState('load')

  // Fallback: if onboarding overlay still appears despite localStorage seed,
  // dismiss it by clicking "Skip for now" or the close button.
  // This handles race conditions where the store initializes before addInitScript runs.
  const skipButton = page.getByRole('button', { name: 'Skip for now' })
  if (await skipButton.isVisible({ timeout: 500 }).catch(() => false)) {
    await skipButton.click()
    // Wait for dialog to close
    await page
      .getByRole('dialog', { name: 'Welcome to Knowlune' })
      .waitFor({ state: 'hidden', timeout: 2000 })
      .catch(() => {})
  }
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

/** Navigate to the My Courses page. */
export async function goToMyClass(page: Page): Promise<void> {
  await navigateAndWait(page, '/my-class')
  // Wait for page heading to confirm render
  await page.waitForSelector('h1:has-text("My Courses")', { state: 'visible', timeout: 10000 })
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
