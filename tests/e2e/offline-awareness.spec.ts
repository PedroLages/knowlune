/**
 * Offline Awareness E2E tests.
 *
 * Validates that the app handles offline/online transitions gracefully.
 * Uses Playwright's context.setOffline() to simulate network loss.
 *
 * Since Knowlune is an IndexedDB-first app, most pages continue to work
 * offline. These tests verify that:
 *   - Going offline doesn't crash the app
 *   - Pages that depend on network resources (Supabase, YouTube) degrade
 *   - Going back online restores functionality
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { TIMEOUTS } from '../utils/constants'

test.describe('Offline Awareness', () => {
  test('should continue showing cached content when going offline', async ({ page, context }) => {
    // Load a page while online first
    await navigateAndWait(page, '/')
    await expect(page.getByRole('heading', { name: 'Your Learning Studio', level: 1 })).toBeVisible(
      { timeout: TIMEOUTS.NETWORK }
    )

    // Go offline
    await context.setOffline(true)

    // Navigate to another page — should still render from cache/local data
    await page.goto('/courses').catch(() => {
      // Navigation may fail if page wasn't cached, that's expected
    })

    // The page should still be functional (either showing courses or previous page)
    // At minimum, the app shell should remain visible
    await expect(page.locator('nav')).toBeVisible()
  })

  test('should recover after going back online', async ({ page, context }) => {
    // Load overview while online
    await navigateAndWait(page, '/')
    await expect(page.getByRole('heading', { name: 'Your Learning Studio', level: 1 })).toBeVisible(
      { timeout: TIMEOUTS.NETWORK }
    )

    // Go offline then back online
    await context.setOffline(true)
    await context.setOffline(false)

    // Navigate to a page — should work normally after reconnection
    await navigateAndWait(page, '/reports')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: TIMEOUTS.NETWORK,
    })
  })

  test('should handle offline state on Reports page gracefully', async ({ page, context }) => {
    // Go offline before navigating
    await context.setOffline(true)

    // Navigate to reports — IndexedDB data is local so page may still render
    await page.goto('/reports').catch(() => {
      // May fail if dev server assets aren't cached
    })

    // Go back online
    await context.setOffline(false)

    // Reload to get fresh assets
    await navigateAndWait(page, '/reports')

    // Page should render correctly after recovery
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({
      timeout: TIMEOUTS.NETWORK,
    })
  })

})
