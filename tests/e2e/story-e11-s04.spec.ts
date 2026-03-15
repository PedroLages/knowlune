import { test, expect } from '../support/fixtures'
import { goToSettings } from '../support/helpers/navigation'

/**
 * E11-S04: Data Export
 *
 * ATDD tests — written RED (failing) before implementation.
 * Each test maps to an acceptance criterion from the story.
 *
 * Acceptance Criteria:
 * - AC1: Full data export in JSON format with schema version
 * - AC2: CSV export with separate files for sessions, progress, streaks
 * - AC3: Markdown notes export with YAML frontmatter
 * - AC5: Open Badges v3.0 achievement export
 * - AC7: Progress indicator during export, non-blocking UI
 * - AC8: Error toast on export failure with cleanup
 *
 * Note: AC4 (xAPI logging) and AC6 (re-import) are better validated
 * via unit/integration tests — no E2E tests for those.
 */

test.describe('E11-S04: Data Export', () => {
  test.beforeEach(async ({ page }) => {
    await goToSettings(page)
  })

  test('AC1: Export all data as JSON with schema version', async ({ page }) => {
    // Expect an export section on the Settings page
    const exportSection = page.getByTestId('data-export-section')
    await expect(exportSection).toBeVisible()

    // Click JSON export button
    const jsonExportBtn = page.getByRole('button', { name: /export.*json/i })
    await expect(jsonExportBtn).toBeVisible()
    await jsonExportBtn.click()

    // Expect download to trigger (Playwright captures downloads)
    const download = await page.waitForEvent('download', { timeout: 30_000 })
    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })

  test('AC2: Export CSV with separate files for sessions, progress, streaks', async ({
    page,
  }) => {
    const csvExportBtn = page.getByRole('button', { name: /export.*csv/i })
    await expect(csvExportBtn).toBeVisible()
    await csvExportBtn.click()

    // CSV export produces a zip bundle
    const download = await page.waitForEvent('download', { timeout: 30_000 })
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })

  test('AC3: Export notes as Markdown with YAML frontmatter', async ({ page }) => {
    const mdExportBtn = page.getByRole('button', { name: /export.*markdown|export.*notes/i })
    await expect(mdExportBtn).toBeVisible()
    await mdExportBtn.click()

    const download = await page.waitForEvent('download', { timeout: 30_000 })
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })

  test('AC5: Export achievements as Open Badges v3.0', async ({ page }) => {
    const badgeExportBtn = page.getByRole('button', { name: /export.*badge|export.*achievement/i })
    await expect(badgeExportBtn).toBeVisible()
    await badgeExportBtn.click()

    const download = await page.waitForEvent('download', { timeout: 30_000 })
    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })

  test('AC7: Progress indicator during large export', async ({ page }) => {
    // Trigger an export
    const jsonExportBtn = page.getByRole('button', { name: /export.*json/i })
    await jsonExportBtn.click()

    // Progress indicator should appear
    const progressIndicator = page.getByTestId('export-progress')
    await expect(progressIndicator).toBeVisible()

    // App should remain interactive (can navigate away)
    const settingsHeading = page.getByRole('heading', { level: 1 })
    await expect(settingsHeading).toBeVisible()
  })

  test('AC8: Toast notification on export failure', async ({ page }) => {
    // Simulate storage error by filling up quota or mocking File System Access API failure
    // For now, verify that the error toast mechanism exists
    await page.evaluate(() => {
      // Mock showSaveFilePicker to simulate write error
      ;(window as unknown as Record<string, unknown>).showSaveFilePicker = async () => {
        throw new DOMException('The request is not allowed', 'NotAllowedError')
      }
    })

    const jsonExportBtn = page.getByRole('button', { name: /export.*json/i })
    await jsonExportBtn.click()

    // Expect toast with error message
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: 5_000 })
    await expect(toast).toContainText(/error|fail|disk/i)
  })
})
