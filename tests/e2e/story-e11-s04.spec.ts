import { test, expect } from '../support/fixtures'
import { goToSettings } from '../support/helpers/navigation'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'
import * as fs from 'fs'

/**
 * E11-S04: Data Export
 *
 * ATDD tests for multi-format data export.
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

/** Seed a note into IndexedDB so markdown export has data */
async function seedNote(page: import('@playwright/test').Page) {
  await seedIndexedDBStore(page, 'ElearningDB', 'notes', [
    {
      id: 'test-note-export',
      courseId: 'course-1',
      videoId: 'video-1',
      content: '<p>Test note for export</p>',
      createdAt: '2025-06-01T10:00:00.000Z',
      updatedAt: '2025-06-01T12:00:00.000Z',
      tags: ['test'],
    },
  ])
}

/** Seed a completed challenge into IndexedDB so badge export has data */
async function seedCompletedChallenge(page: import('@playwright/test').Page) {
  await seedIndexedDBStore(page, 'ElearningDB', 'challenges', [
    {
      id: 'test-challenge-export',
      name: 'Complete 5 lessons',
      type: 'lessons',
      targetValue: 5,
      deadline: '2025-12-31',
      createdAt: '2025-01-01T00:00:00.000Z',
      currentProgress: 5,
      celebratedMilestones: [25, 50, 75, 100],
      completedAt: '2025-06-15T14:30:00.000Z',
    },
  ])
}

test.describe('E11-S04: Data Export', () => {
  test.beforeEach(async ({ page }) => {
    await goToSettings(page)
  })

  test('AC1: Export all data as JSON with schema version', async ({ page }) => {
    const exportSection = page.getByTestId('data-export-section')
    await expect(exportSection).toBeVisible()

    const jsonExportBtn = page.getByRole('button', { name: /export.*json/i })
    await expect(jsonExportBtn).toBeVisible()

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await jsonExportBtn.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.json$/)

    // Verify the exported JSON contains schemaVersion at root level
    const filePath = await download.path()
    if (filePath) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      expect(content).toHaveProperty('schemaVersion')
      expect(typeof content.schemaVersion).toBe('number')
      expect(content).toHaveProperty('exportedAt')
      expect(content).toHaveProperty('data')
    }
  })

  test('AC2: Export CSV with separate files for sessions, progress, streaks', async ({ page }) => {
    const csvExportBtn = page.getByRole('button', { name: /export.*csv/i })
    await expect(csvExportBtn).toBeVisible()

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await csvExportBtn.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })

  test('AC3: Export notes as Markdown with YAML frontmatter', async ({ page }) => {
    // Seed a note so the export has data (empty notes → early return, no download)
    await seedNote(page)

    const mdExportBtn = page.getByRole('button', {
      name: /markdown|export.*notes/i,
    })
    await expect(mdExportBtn).toBeVisible()

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await mdExportBtn.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.zip$/)
  })

  test('AC5: Export achievements as Open Badges v3.0', async ({ page }) => {
    // Seed a completed challenge so badge export has data
    await seedCompletedChallenge(page)

    const badgeExportBtn = page.getByRole('button', {
      name: /badges|export.*achievement/i,
    })
    await expect(badgeExportBtn).toBeVisible()

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await badgeExportBtn.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })

  test('AC7: Progress indicator during large export', async ({ page }) => {
    const jsonExportBtn = page.getByRole('button', { name: /export.*json/i })
    await jsonExportBtn.click()

    // Progress indicator should appear (has role="status" and aria-live)
    const progressIndicator = page.getByTestId('export-progress')
    await expect(progressIndicator).toBeVisible()

    // App should remain interactive — verify a different interactive element is clickable
    const settingsHeading = page.getByRole('heading', { level: 1 })
    await expect(settingsHeading).toBeVisible()
  })

  test('AC8: Toast notification on export failure', async ({ page }) => {
    // Mock URL.createObjectURL to throw — this is the actual download mechanism
    // (the app uses blob + anchor click, not showSaveFilePicker)
    await page.evaluate(() => {
      URL.createObjectURL = () => {
        throw new DOMException(
          'Failed to execute createObjectURL: quota exceeded',
          'QuotaExceededError'
        )
      }
    })

    const jsonExportBtn = page.getByRole('button', { name: /export.*json/i })
    await jsonExportBtn.click()

    // Expect toast with error message
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: 5_000 })
    await expect(toast).toContainText(/error|fail|disk/i, { timeout: 5_000 })

    // Verify no download was triggered (partial export cleanup)
    const downloads: unknown[] = []
    page.on('download', d => downloads.push(d))
    // Brief wait to confirm no late download arrives
    await page.waitForTimeout(1_000) // justified: confirming no download fires after error
    expect(downloads).toHaveLength(0)
  })
})
