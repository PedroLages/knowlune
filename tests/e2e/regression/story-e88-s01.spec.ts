/**
 * E2E Tests: E88-S01 — OPDS Catalog Connection
 *
 * Acceptance criteria covered:
 * - AC1: OPDS catalog settings dialog opens from Library page
 * - AC2: Empty state is shown when no catalogs are connected
 * - AC3: Add catalog form renders with name, URL, and auth fields
 * - AC4: Test Connection button is available (disabled when URL is empty)
 * - AC5: Save button is disabled when required fields are missing
 * - AC6: Catalog list shows connected catalogs with edit/remove actions
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const TEST_CATALOG = {
  id: 'test-opds-catalog-1',
  name: 'My Calibre Library',
  url: 'https://calibre.local/opds',
  createdAt: FIXED_DATE,
}

async function openOpdsCatalogDialog(page: import('@playwright/test').Page): Promise<void> {
  await navigateAndWait(page, '/library')
  await page.getByTestId('opds-catalog-settings-trigger').click()
  await expect(page.getByTestId('opds-catalog-settings')).toBeVisible({ timeout: 5000 })
}

test.describe('E88-S01: OPDS Catalog Settings', () => {
  test('opens OPDS catalog dialog from Library page', async ({ page }) => {
    await navigateAndWait(page, '/library')

    const trigger = page.getByTestId('opds-catalog-settings-trigger')
    await expect(trigger).toBeVisible({ timeout: 5000 })
    await trigger.click()

    await expect(page.getByTestId('opds-catalog-settings')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('heading', { name: 'OPDS Catalogs' })).toBeVisible()
  })

  test('shows empty state when no catalogs are connected', async ({ page }) => {
    await openOpdsCatalogDialog(page)

    await expect(page.getByText('No catalogs connected yet.')).toBeVisible()
    await expect(page.getByTestId('add-opds-catalog-btn')).toBeVisible()
  })

  test('navigates to Add Catalog form', async ({ page }) => {
    await openOpdsCatalogDialog(page)

    await page.getByTestId('add-opds-catalog-btn').click()

    await expect(page.getByText('Add Catalog')).toBeVisible()
    await expect(page.getByTestId('opds-name-input')).toBeVisible()
    await expect(page.getByTestId('opds-url-input')).toBeVisible()
  })

  test('Test Connection button is disabled when URL is empty', async ({ page }) => {
    await openOpdsCatalogDialog(page)
    await page.getByTestId('add-opds-catalog-btn').click()

    const testBtn = page.getByTestId('opds-test-btn')
    await expect(testBtn).toBeVisible()
    await expect(testBtn).toBeDisabled()
  })

  test('Save button is disabled when name and URL are empty', async ({ page }) => {
    await openOpdsCatalogDialog(page)
    await page.getByTestId('add-opds-catalog-btn').click()

    const saveBtn = page.getByTestId('opds-save-btn')
    await expect(saveBtn).toBeDisabled()
  })

  test('Save button enables when name and URL are filled', async ({ page }) => {
    await openOpdsCatalogDialog(page)
    await page.getByTestId('add-opds-catalog-btn').click()

    await page.getByTestId('opds-name-input').fill('My Library')
    await page.getByTestId('opds-url-input').fill('https://calibre.local/opds')

    await expect(page.getByTestId('opds-save-btn')).not.toBeDisabled()
  })

  test('Back button returns to catalog list', async ({ page }) => {
    await openOpdsCatalogDialog(page)
    await page.getByTestId('add-opds-catalog-btn').click()

    await expect(page.getByText('Add Catalog')).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()

    await expect(page.getByRole('heading', { name: 'OPDS Catalogs' })).toBeVisible()
  })

  test('shows connected catalog in list view', async ({ page }) => {
    // Seed the catalog before navigating
    await navigateAndWait(page, '/')
    await seedIndexedDBStore(page, DB_NAME, 'opdsCatalogs', [TEST_CATALOG] as unknown as Record<
      string,
      unknown
    >[])

    await openOpdsCatalogDialog(page)

    await expect(page.getByText('My Calibre Library')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('https://calibre.local/opds')).toBeVisible()
  })

  test('shows edit and remove buttons for connected catalogs', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedIndexedDBStore(page, DB_NAME, 'opdsCatalogs', [TEST_CATALOG] as unknown as Record<
      string,
      unknown
    >[])

    await openOpdsCatalogDialog(page)

    const item = page.getByTestId(`opds-catalog-item-${TEST_CATALOG.id}`)
    await expect(item).toBeVisible({ timeout: 5000 })
    await expect(item.getByRole('button', { name: /Edit/i })).toBeVisible()
    await expect(item.getByRole('button', { name: /Remove/i })).toBeVisible()
  })

  test('password visibility toggle is present in auth section', async ({ page }) => {
    await openOpdsCatalogDialog(page)
    await page.getByTestId('add-opds-catalog-btn').click()

    // Open the authentication details section
    await page.getByText('Authentication (optional)').click()

    await expect(page.getByTestId('opds-password-input')).toBeVisible()
    await expect(page.getByTestId('opds-password-toggle')).toBeVisible()
  })

  test('password toggle switches input type', async ({ page }) => {
    await openOpdsCatalogDialog(page)
    await page.getByTestId('add-opds-catalog-btn').click()

    await page.getByText('Authentication (optional)').click()

    const passwordInput = page.getByTestId('opds-password-input')
    const toggleBtn = page.getByTestId('opds-password-toggle')

    // Initially password type (hidden)
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Click toggle to show
    await toggleBtn.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')

    // Click toggle again to hide
    await toggleBtn.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
