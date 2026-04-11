/**
 * Shared helper to dismiss all onboarding overlays in E2E tests.
 *
 * Sets localStorage keys via addInitScript (runs before page JS executes),
 * preventing onboarding/welcome/sidebar overlays from blocking interactions.
 *
 * Pattern extracted after 3 consecutive epics (E107, E108) had E2E failures
 * caused by onboarding overlays.
 *
 * Usage:
 *   import { dismissOnboarding } from '../helpers/dismiss-onboarding'
 *   test.beforeEach(async ({ page }) => { await dismissOnboarding(page) })
 *
 * Note: navigateAndWait() from tests/support/helpers/navigation.ts already
 * calls this logic internally. Use this helper when you need to dismiss
 * onboarding without navigateAndWait (e.g., custom navigation flows).
 */
import type { Page } from '@playwright/test'

export async function dismissOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
    )
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })
}
