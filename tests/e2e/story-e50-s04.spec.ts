/**
 * E50-S04: Calendar Integration Settings UI
 *
 * Tests cover:
 * - AC1: Toggle enables/disables the calendar feed section
 * - AC2: Feed URL displayed when enabled
 * - AC3: Copy feed URL to clipboard
 * - AC4: Regenerate with confirmation dialog
 * - AC5: Weekly study summary displayed
 * - AC6: Download .ics button visible when enabled
 */
import { test, expect } from '../support/fixtures'
import { goToSettings } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed the study schedule store with feed enabled and sample schedules */
async function seedFeedEnabled(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/useStudyScheduleStore')
    const store = mod.useStudyScheduleStore
    store.setState({
      feedToken: 'abc123def456abc123def456abc123def456abc1',
      feedEnabled: true,
      feedLoading: false,
      schedules: [
        {
          id: 'sched-01',
          title: 'Morning React Study',
          days: ['monday', 'wednesday', 'friday'] as import('/src/data/types').DayOfWeek[],
          startTime: '09:00',
          durationMinutes: 60,
          recurrence: 'weekly',
          reminderMinutes: 15,
          enabled: true,
          timezone: 'UTC',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        {
          id: 'sched-02',
          title: 'Evening TypeScript',
          days: ['tuesday', 'thursday'] as import('/src/data/types').DayOfWeek[],
          startTime: '18:00',
          durationMinutes: 45,
          recurrence: 'weekly',
          reminderMinutes: 10,
          enabled: true,
          timezone: 'UTC',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
      ],
      isLoaded: true,
    })
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E50-S04: Calendar Integration Settings UI', () => {
  test('AC1: toggle shows disabled state by default', async ({ page }) => {
    await goToSettings(page)

    const section = page.getByTestId('calendar-settings-section')
    await expect(section).toBeVisible()

    // Toggle should be off by default (no Supabase token)
    const toggle = page.getByTestId('calendar-feed-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('data-state', 'unchecked')

    // Disabled state message should be visible
    await expect(
      section.getByText('Enable to sync your study schedule')
    ).toBeVisible()

    // Feed URL input should NOT be visible when disabled
    await expect(page.getByTestId('feed-url-input')).not.toBeVisible()
  })

  test('AC1 + AC2: enabled state shows feed URL', async ({ page }) => {
    await goToSettings(page)
    await seedFeedEnabled(page)

    const section = page.getByTestId('calendar-settings-section')

    // Toggle should now be checked
    const toggle = page.getByTestId('calendar-feed-toggle')
    await expect(toggle).toHaveAttribute('data-state', 'checked')

    // Feed URL input should be visible with the token-based URL
    const feedInput = page.getByTestId('feed-url-input')
    await expect(feedInput).toBeVisible()
    const feedValue = await feedInput.inputValue()
    expect(feedValue).toContain('abc123def456')
    expect(feedValue).toContain('.ics')
  })

  test('AC3: copy button is present and enabled when feed URL exists', async ({ page }) => {
    await goToSettings(page)
    await seedFeedEnabled(page)

    const copyButton = page.getByTestId('copy-feed-url')
    await expect(copyButton).toBeVisible()
    await expect(copyButton).toBeEnabled()
  })

  test('AC4: regenerate shows confirmation dialog', async ({ page }) => {
    await goToSettings(page)
    await seedFeedEnabled(page)

    // Click regenerate button
    const regenerateButton = page.getByTestId('regenerate-feed-url')
    await expect(regenerateButton).toBeVisible()
    await regenerateButton.click()

    // Confirmation dialog should appear
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Regenerate Feed URL?')).toBeVisible()
    await expect(
      dialog.getByText('invalidate your current feed URL')
    ).toBeVisible()

    // Cancel button should dismiss the dialog
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()
  })

  test('AC5: weekly study summary is rendered when feed enabled', async ({ page }) => {
    await goToSettings(page)
    await seedFeedEnabled(page)

    // StudyScheduleSummary should render with schedule data
    // It shows day labels and total hours
    const section = page.getByTestId('calendar-settings-section')
    await expect(section.getByText('Morning React Study')).toBeVisible()
  })

  test('AC6: download .ics button is visible when feed enabled', async ({ page }) => {
    await goToSettings(page)
    await seedFeedEnabled(page)

    const downloadButton = page.getByTestId('download-ics')
    await expect(downloadButton).toBeVisible()
    await expect(downloadButton).toBeEnabled()
    await expect(downloadButton).toContainText('Download .ics')
  })
})
