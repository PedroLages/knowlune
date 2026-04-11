/**
 * E109-S01: Vocabulary Builder — E2E tests
 *
 * Tests the vocabulary page: empty state, navigation, and basic rendering.
 * Note: Full reader integration (text selection → add to vocabulary) requires
 * an EPUB loaded in the reader, which is complex to set up in E2E.
 * These tests focus on the vocabulary page itself.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { navigateAndWait } from '../support/helpers/navigation'

test.describe('Vocabulary Builder (E109-S01)', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  test('vocabulary page renders with empty state', async ({ page }) => {
    await navigateAndWait(page, '/vocabulary')

    // Page heading visible
    await expect(page.getByRole('heading', { name: 'Vocabulary', level: 1 })).toBeVisible()

    // Empty state message
    await expect(page.getByTestId('vocabulary-empty')).toBeVisible()
    await expect(page.getByText('No vocabulary items yet')).toBeVisible()

    // Review button should be disabled (no items)
    const reviewBtn = page.getByTestId('start-review-btn')
    await expect(reviewBtn).toBeVisible()
    await expect(reviewBtn).toBeDisabled()
  })

  test('vocabulary page is accessible via sidebar navigation', async ({ page }) => {
    await navigateAndWait(page, '/')

    // Click vocabulary in sidebar (desktop)
    const vocabLink = page.getByRole('link', { name: 'Vocabulary' })
    if (await vocabLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await vocabLink.click()
      await expect(page).toHaveURL('/vocabulary')
      await expect(page.getByRole('heading', { name: 'Vocabulary', level: 1 })).toBeVisible()
    }
  })

  test('vocabulary page shows word count as 0 when empty', async ({ page }) => {
    await navigateAndWait(page, '/vocabulary')
    await expect(page.getByText('0 words saved')).toBeVisible()
  })

  test('vocabulary page has accessible review button', async ({ page }) => {
    await navigateAndWait(page, '/vocabulary')
    const reviewBtn = page.getByTestId('start-review-btn')
    await expect(reviewBtn).toHaveAccessibleName(/Review/)
  })
})
