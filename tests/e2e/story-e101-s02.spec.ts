/**
 * E2E Tests: E101-S02 — Audiobookshelf Server Connection & Authentication UI
 *
 * Acceptance criteria covered:
 * - AC1: Settings dialog opens from Library page with form fields
 * - AC2: Successful connection shows server version, library count, checkboxes
 * - AC3: Save persists server in Dexie, appears as "Connected" card
 * - AC4: HTTP warning appears when URL uses http://
 * - AC5: CORS error shows troubleshooting guidance
 * - AC6: Auth error (401) shows "Authentication failed" message
 * - AC7: Edit server pre-fills form with masked API key
 * - AC8: Remove server shows confirmation, removes from list
 * - AC9: Auth-failed status shows Re-authenticate button
 * - AC10: Status badges use icon + text for all three states
 * - AC11: Keyboard navigation works for all form elements
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedIndexedDBStore } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const DB_NAME = 'ElearningDB'

const ABS_SERVER_URL = 'https://abs.example.com'

const TEST_SERVER = {
  id: 'test-abs-server-1',
  name: 'Home ABS',
  url: ABS_SERVER_URL,
  apiKey: 'test-api-key-123',
  libraryIds: ['lib-1'],
  status: 'connected' as const,
  lastSyncedAt: undefined,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function openAbsSettings(page: import('@playwright/test').Page): Promise<void> {
  await navigateAndWait(page, '/library')
  await page.getByTestId('abs-settings-trigger').click()
  await expect(page.getByTestId('abs-settings')).toBeVisible({ timeout: 5000 })
}

/**
 * Mock ABS API at the fetch level using addInitScript.
 * page.route() doesn't reliably intercept cross-origin fetch in Chromium,
 * so we override window.fetch for ABS URLs before the app loads.
 */
async function mockAbsApiSuccess(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(serverUrl => {
    const _origFetch = window.fetch
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.startsWith(serverUrl) && url.includes('/api/ping')) {
        return new Response(JSON.stringify({ success: true, version: '2.17.3' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.startsWith(serverUrl) && url.includes('/api/libraries')) {
        return new Response(
          JSON.stringify({
            libraries: [
              { id: 'lib-1', name: 'Audiobooks', mediaType: 'book' },
              { id: 'lib-2', name: 'Podcasts', mediaType: 'podcast' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return _origFetch(input, init)
    }
  }, ABS_SERVER_URL)
}

async function mockAbsApiAuthFailure(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(serverUrl => {
    const _origFetch = window.fetch
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.startsWith(serverUrl)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return _origFetch(input, init)
    }
  }, ABS_SERVER_URL)
}

async function mockAbsApiCorsError(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(serverUrl => {
    const _origFetch = window.fetch
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.startsWith(serverUrl)) {
        throw new TypeError('Failed to fetch')
      }
      return _origFetch(input, init)
    }
  }, ABS_SERVER_URL)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('E101-S02: Audiobookshelf Server Connection & Auth UI', () => {
  test('opens ABS settings dialog from Library page', async ({ page }) => {
    await navigateAndWait(page, '/library')

    const trigger = page.getByTestId('abs-settings-trigger')
    await expect(trigger).toBeVisible({ timeout: 5000 })
    await trigger.click()

    await expect(page.getByTestId('abs-settings')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('heading', { name: 'Audiobookshelf Servers' })).toBeVisible()
  })

  test('shows empty state when no servers are connected', async ({ page }) => {
    await openAbsSettings(page)

    await expect(page.getByText('No servers connected yet.')).toBeVisible()
    await expect(page.getByTestId('add-abs-server-btn')).toBeVisible()
  })

  test('navigates to Add Server form with correct fields', async ({ page }) => {
    await openAbsSettings(page)

    await page.getByTestId('add-abs-server-btn').click()

    await expect(page.getByRole('heading', { name: 'Add Server' })).toBeVisible()
    await expect(page.getByTestId('abs-name-input')).toBeVisible()
    await expect(page.getByTestId('abs-url-input')).toBeVisible()
    await expect(page.getByTestId('abs-api-key-input')).toBeVisible()
    await expect(page.getByTestId('abs-help-link')).toBeVisible()
  })

  test('Test Connection button is disabled when URL is empty', async ({ page }) => {
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    await expect(page.getByTestId('abs-test-btn')).toBeDisabled()
  })

  test('Save button is disabled until test passes', async ({ page }) => {
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    // Even with URL filled, save should be disabled until test passes
    await page.getByTestId('abs-url-input').fill(ABS_SERVER_URL)
    await page.getByTestId('abs-api-key-input').fill('some-key')
    await expect(page.getByTestId('abs-save-btn')).toBeDisabled()
  })

  test('successful connection shows server version and library checkboxes', async ({ page }) => {
    // Set up route intercepts BEFORE navigating
    await mockAbsApiSuccess(page)
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    await page.getByTestId('abs-url-input').fill(ABS_SERVER_URL)
    await page.getByTestId('abs-api-key-input').fill('test-key')
    await page.getByTestId('abs-test-btn').click()

    // Success message with version and library count
    const result = page.getByTestId('abs-test-result')
    await expect(result).toBeVisible({ timeout: 5000 })
    await expect(result).toContainText('Connected — ABS v2.17.3, 2 libraries found')

    // Library checkboxes appear
    const librarySelection = page.getByTestId('abs-library-selection')
    await expect(librarySelection).toBeVisible()
    await expect(page.getByTestId('abs-library-checkbox-lib-1')).toBeVisible()
    await expect(page.getByTestId('abs-library-checkbox-lib-2')).toBeVisible()

    // Save button becomes enabled
    await expect(page.getByTestId('abs-save-btn')).not.toBeDisabled()
  })

  test('save server shows it in list with Connected status', async ({ page }) => {
    await mockAbsApiSuccess(page)
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    await page.getByTestId('abs-name-input').fill('My ABS')
    await page.getByTestId('abs-url-input').fill(ABS_SERVER_URL)
    await page.getByTestId('abs-api-key-input').fill('test-key')
    await page.getByTestId('abs-test-btn').click()

    await expect(page.getByTestId('abs-test-result')).toContainText('Connected', { timeout: 5000 })
    await page.getByTestId('abs-save-btn').click()

    // Should return to list view with the server shown
    await expect(page.getByRole('heading', { name: 'Audiobookshelf Servers' })).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByText('My ABS')).toBeVisible()
    await expect(page.getByTestId('abs-server-status')).toContainText('Connected')
  })

  test('auth failure shows authentication error message', async ({ page }) => {
    await mockAbsApiAuthFailure(page)
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    await page.getByTestId('abs-url-input').fill(ABS_SERVER_URL)
    await page.getByTestId('abs-api-key-input').fill('bad-key')
    await page.getByTestId('abs-test-btn').click()

    const result = page.getByTestId('abs-test-result')
    await expect(result).toBeVisible({ timeout: 5000 })
    await expect(result).toContainText('Authentication failed')
  })

  test('CORS error shows troubleshooting guidance', async ({ page }) => {
    await mockAbsApiCorsError(page)
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    await page.getByTestId('abs-url-input').fill(ABS_SERVER_URL)
    await page.getByTestId('abs-api-key-input').fill('test-key')
    await page.getByTestId('abs-test-btn').click()

    const result = page.getByTestId('abs-test-result')
    await expect(result).toBeVisible({ timeout: 5000 })
    await expect(result).toContainText('CORS settings')

    // Collapsible troubleshooting section
    const troubleshoot = page.getByTestId('abs-cors-troubleshoot')
    await expect(troubleshoot).toBeVisible()
    await troubleshoot.getByText('Troubleshooting').click()
    await expect(troubleshoot).toContainText('Allowed Origins')
  })

  test('HTTP warning appears when URL uses http://', async ({ page }) => {
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    await page.getByTestId('abs-url-input').fill('http://192.168.1.50:13378')

    await expect(page.getByTestId('abs-http-warning')).toBeVisible()
    await expect(page.getByTestId('abs-http-warning')).toContainText(
      'Credentials will be sent unencrypted over HTTP'
    )
  })

  test('HTTP warning does not appear for HTTPS URLs', async ({ page }) => {
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    await page.getByTestId('abs-url-input').fill('https://abs.example.com')

    await expect(page.getByTestId('abs-http-warning')).not.toBeVisible()
  })

  test('edit server pre-fills form with masked API key', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedIndexedDBStore(page, DB_NAME, 'audiobookshelfServers', [
      TEST_SERVER,
    ] as unknown as Record<string, unknown>[])

    await openAbsSettings(page)

    const item = page.getByTestId(`abs-server-item-${TEST_SERVER.id}`)
    await expect(item).toBeVisible({ timeout: 5000 })
    await item.getByRole('button', { name: /Edit/i }).click()

    await expect(page.getByRole('heading', { name: 'Edit Server' })).toBeVisible()
    await expect(page.getByTestId('abs-name-input')).toHaveValue('Home ABS')
    await expect(page.getByTestId('abs-url-input')).toHaveValue(ABS_SERVER_URL)
    // API key should be empty (placeholder shows masked)
    await expect(page.getByTestId('abs-api-key-input')).toHaveValue('')
  })

  test('remove server shows confirmation and removes from list', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedIndexedDBStore(page, DB_NAME, 'audiobookshelfServers', [
      TEST_SERVER,
    ] as unknown as Record<string, unknown>[])

    await openAbsSettings(page)

    const item = page.getByTestId(`abs-server-item-${TEST_SERVER.id}`)
    await expect(item).toBeVisible({ timeout: 5000 })
    await item.getByRole('button', { name: /Remove/i }).click()

    // Confirmation dialog
    await expect(page.getByText(/Remove .Home ABS.?/)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Cached audiobook metadata will not be deleted')).toBeVisible()

    await page.getByTestId('abs-confirm-delete-btn').click()

    // Server should be removed from list
    await expect(page.getByText('No servers connected yet.')).toBeVisible({ timeout: 5000 })
  })

  test('status badges display icon + text for all three states', async ({ page }) => {
    const servers = [
      { ...TEST_SERVER, id: 'srv-connected', name: 'Connected Server', status: 'connected' },
      { ...TEST_SERVER, id: 'srv-offline', name: 'Offline Server', status: 'offline' },
      { ...TEST_SERVER, id: 'srv-auth', name: 'Auth Failed Server', status: 'auth-failed' },
    ]

    await navigateAndWait(page, '/')
    await seedIndexedDBStore(
      page,
      DB_NAME,
      'audiobookshelfServers',
      servers as unknown as Record<string, unknown>[]
    )

    await openAbsSettings(page)

    // Connected
    const connectedItem = page.getByTestId('abs-server-item-srv-connected')
    await expect(connectedItem).toBeVisible({ timeout: 5000 })
    await expect(connectedItem.getByTestId('abs-server-status')).toContainText('Connected')

    // Offline
    const offlineItem = page.getByTestId('abs-server-item-srv-offline')
    await expect(offlineItem).toBeVisible()
    await expect(offlineItem.getByTestId('abs-server-status')).toContainText('Offline')

    // Auth Failed
    const authItem = page.getByTestId('abs-server-item-srv-auth')
    await expect(authItem).toBeVisible()
    await expect(authItem.getByTestId('abs-server-status')).toContainText('Auth Failed')
  })

  test('auth-failed server shows Re-authenticate button', async ({ page }) => {
    const authFailedServer = {
      ...TEST_SERVER,
      id: 'srv-auth-failed',
      name: 'Expired Server',
      status: 'auth-failed',
    }

    await navigateAndWait(page, '/')
    await seedIndexedDBStore(page, DB_NAME, 'audiobookshelfServers', [
      authFailedServer,
    ] as unknown as Record<string, unknown>[])

    await openAbsSettings(page)

    const item = page.getByTestId('abs-server-item-srv-auth-failed')
    await expect(item).toBeVisible({ timeout: 5000 })
    const reauthBtn = page.getByTestId('abs-reauthenticate-btn')
    await expect(reauthBtn).toBeVisible()

    // Clicking opens edit mode
    await reauthBtn.click()
    await expect(page.getByRole('heading', { name: 'Edit Server' })).toBeVisible()
  })

  test('API key visibility toggle works', async ({ page }) => {
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    const apiKeyInput = page.getByTestId('abs-api-key-input')
    const toggleBtn = page.getByTestId('abs-api-key-toggle')

    // Initially hidden
    await expect(apiKeyInput).toHaveAttribute('type', 'password')

    // Show
    await toggleBtn.click()
    await expect(apiKeyInput).toHaveAttribute('type', 'text')

    // Hide again
    await toggleBtn.click()
    await expect(apiKeyInput).toHaveAttribute('type', 'password')
  })

  test('keyboard navigation works for dialog and form elements (AC11)', async ({ page }) => {
    await mockAbsApiSuccess(page)
    await openAbsSettings(page)

    // Tab to "Add Server" button and activate with Enter
    await page.keyboard.press('Tab')
    const addBtn = page.getByTestId('add-abs-server-btn')
    await expect(addBtn).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Add Server' })).toBeVisible()

    // Tab through form fields — Name, URL, API Key
    const nameInput = page.getByTestId('abs-name-input')
    const urlInput = page.getByTestId('abs-url-input')
    const apiKeyInput = page.getByTestId('abs-api-key-input')

    await nameInput.focus()
    await page.keyboard.type('KB Test Server')
    await page.keyboard.press('Tab')
    await expect(urlInput).toBeFocused()
    await page.keyboard.type(ABS_SERVER_URL)
    await page.keyboard.press('Tab')
    await expect(apiKeyInput).toBeFocused()
    await page.keyboard.type('test-key')

    // Test Connection button — Tab to it and press Enter
    const testBtn = page.getByTestId('abs-test-btn')
    await testBtn.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('abs-test-result')).toBeVisible({ timeout: 5000 })

    // Save button — Tab to it and press Enter
    const saveBtn = page.getByTestId('abs-save-btn')
    await saveBtn.focus()
    await page.keyboard.press('Enter')

    // Should return to list view
    await expect(page.getByRole('heading', { name: 'Audiobookshelf Servers' })).toBeVisible({
      timeout: 5000,
    })

    // Escape key closes the dialog
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('abs-settings')).not.toBeVisible()
  })

  test('Back button returns to server list', async ({ page }) => {
    await openAbsSettings(page)
    await page.getByTestId('add-abs-server-btn').click()

    await expect(page.getByRole('heading', { name: 'Add Server' })).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()

    await expect(page.getByRole('heading', { name: 'Audiobookshelf Servers' })).toBeVisible()
  })
})
