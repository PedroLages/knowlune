/**
 * E2E Tests: ABS Server Connection Flow
 *
 * Acceptance criteria covered:
 * - Add server: fill form, test connection, save, verify server appears
 * - Remove server: add then remove, verify list empty
 * - CORS error handling: mock CORS failure, verify user-friendly message
 * - Reconnect after failure: mock offline then online, verify reconnection
 */
import { test, expect } from '../../support/fixtures'
import { FIXED_DATE } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'
const ABS_URL = 'http://abs.test:13378'

const ABS_SERVER = {
  id: 'abs-conn-server-1',
  name: 'Test Server',
  url: ABS_URL,
  apiKey: 'test-api-key-conn',
  libraryIds: ['lib-1'],
  status: 'connected' as const,
  lastSyncedAt: FIXED_DATE,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const PING_RESPONSE = {
  success: true,
  serverVersion: '2.7.0',
}

const LIBRARIES_RESPONSE = {
  libraries: [{ id: 'lib-1', name: 'Audiobooks', mediaType: 'book' }],
}

async function seedOnboarding(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z', skipped: true })
    )
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z' })
    )
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
}

async function seedServerData(page: import('@playwright/test').Page): Promise<void> {
  const { seedIndexedDBStore } = await import('../../support/helpers/seed-helpers')
  await seedOnboarding(page)
  await page.goto('/')
  await seedIndexedDBStore(page, DB_NAME, 'audiobookshelfServers', [
    ABS_SERVER,
  ] as unknown as Record<string, unknown>[])
}

async function openAbsSettings(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/library')
  await page.waitForLoadState('domcontentloaded')
  await page.getByTestId('abs-settings-trigger').click()
  await expect(page.getByTestId('abs-settings')).toBeVisible()
}

test.describe('ABS Server Connection', () => {
  test('Add server — fill form, test connection, save, verify server in list', async ({ page }) => {
    // Mock ABS ping and libraries endpoints
    await page.route(`${ABS_URL}/api/ping`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PING_RESPONSE),
      })
    )
    await page.route(`${ABS_URL}/api/libraries`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(LIBRARIES_RESPONSE),
      })
    )

    await seedOnboarding(page)
    await openAbsSettings(page)

    // Click "Add Server"
    await page.getByTestId('add-abs-server-btn').click()

    // Fill form
    await page.getByTestId('abs-name-input').fill('My Home Server')
    await page.getByTestId('abs-url-input').fill(ABS_URL)
    await page.getByTestId('abs-api-key-input').fill('test-api-key-123')

    // Test connection
    await page.getByTestId('abs-test-btn').click()

    // Wait for success result
    await expect(page.getByTestId('abs-test-result')).toContainText('Connected')

    // Library checkbox should appear
    await expect(page.getByTestId('abs-library-selection')).toBeVisible()

    // Save
    await page.getByTestId('abs-save-btn').click()

    // Should return to list view showing the new server
    await expect(page.getByText('My Home Server')).toBeVisible()
    await expect(page.getByTestId('abs-server-status')).toContainText('Connected')
  })

  test('Remove server — add then remove, verify list is empty', async ({ page }) => {
    // Seed a server, then remove it via the UI
    await page.route(`${ABS_URL}/**`, route => route.abort('connectionrefused'))

    await seedServerData(page)
    await openAbsSettings(page)

    // Server should be visible
    await expect(page.getByText(ABS_SERVER.name)).toBeVisible()

    // Click the remove (trash) button
    await page.getByRole('button', { name: `Remove ${ABS_SERVER.name}` }).click()

    // Confirm deletion in the alert dialog
    await page.getByTestId('abs-confirm-delete-btn').click()

    // List should now show empty state
    await expect(page.getByText('No servers connected yet.')).toBeVisible()
  })

  test('CORS error handling — mock CORS failure, verify user-friendly error', async ({ page }) => {
    // Mock ping to simulate a CORS/network failure
    await page.route(`${ABS_URL}/api/ping`, route => route.abort('failed'))

    await seedOnboarding(page)
    await openAbsSettings(page)

    // Open add form
    await page.getByTestId('add-abs-server-btn').click()

    // Fill form
    await page.getByTestId('abs-url-input').fill(ABS_URL)
    await page.getByTestId('abs-api-key-input').fill('test-key')

    // Test connection — should fail
    await page.getByTestId('abs-test-btn').click()

    // Verify error message appears (the service maps network errors to CORS guidance)
    await expect(page.getByTestId('abs-test-result')).toBeVisible()

    // CORS troubleshooting details should be available
    await expect(page.getByTestId('abs-cors-troubleshoot')).toBeVisible()
  })

  test('Reconnect after failure — mock offline then online, verify recovery', async ({ page }) => {
    // Start with all requests failing
    let shouldFail = true
    await page.route(`${ABS_URL}/api/ping`, route => {
      if (shouldFail) {
        return route.abort('connectionrefused')
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PING_RESPONSE),
      })
    })
    await page.route(`${ABS_URL}/api/libraries`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(LIBRARIES_RESPONSE),
      })
    )

    await seedOnboarding(page)
    await openAbsSettings(page)

    // Open add form
    await page.getByTestId('add-abs-server-btn').click()
    await page.getByTestId('abs-url-input').fill(ABS_URL)
    await page.getByTestId('abs-api-key-input').fill('test-key')

    // First attempt — should fail
    await page.getByTestId('abs-test-btn').click()
    await expect(page.getByTestId('abs-test-result')).toBeVisible()

    // Now simulate server coming back online
    shouldFail = false

    // Retry — should succeed
    await page.getByTestId('abs-test-btn').click()
    await expect(page.getByTestId('abs-test-result')).toContainText('Connected')
  })
})
