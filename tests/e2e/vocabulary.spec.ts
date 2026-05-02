import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedBooks, seedVocabularyItems } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

const BOOK_ID = 'vocab-book-1'

test.describe('Vocabulary page', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  test('does not overflow horizontally and shows desktop right rail', async ({ page }) => {
    await navigateAndWait(page, '/')

    await seedBooks(page, [
      {
        id: BOOK_ID,
        title: 'The Rational Optimist',
        author: 'Matt Ridley',
        format: 'epub',
        status: 'reading',
        createdAt: FIXED_DATE,
      },
    ])

    await seedVocabularyItems(page, [
      {
        id: 'vocab-1',
        bookId: BOOK_ID,
        word:
          "Look again at the hand axe and the mouse. They are both 'man-made', but one was made by a single person, the other by hundreds of people, maybe even millions.",
        context:
          "Look again at the hand axe and the mouse. They are both 'man-made', but one was made by a single person, the other by hundreds of people, maybe even millions.",
        definition:
          'A deliberately long definition to test wrapping and ensure it never causes horizontal overflow on wide screens even when there are no convenient breakpoints.',
        masteryLevel: 0,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ])

    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 })
    await navigateAndWait(page, '/vocabulary')

    await expect(page.getByTestId('vocabulary-page')).toBeVisible()
    await expect(page.getByTestId('vocabulary-list')).toBeVisible()
    await expect(page.getByTestId('vocabulary-rail')).toBeVisible()
    await expect(page.getByTestId('vocabulary-card')).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(() => {
      const rootOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth
      if (rootOverflow) return true

      // Also catch overflow inside the app's main scroll container (common in dashboard shells).
      const main = document.querySelector('main#main-content') as HTMLElement | null
      if (main && main.scrollWidth > main.clientWidth) return true

      // Last resort: look for any substantial element overflowing horizontally.
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      for (const el of nodes) {
        if (el.clientWidth >= 300 && el.scrollWidth > el.clientWidth + 1) return true
      }
      return false
    })
    expect(hasHorizontalOverflow).toBe(false)

    // Selection should update details deterministically.
    await page.getByTestId('vocab-word-vocab-1').click()
    await expect(page.getByTestId('vocabulary-rail')).toContainText('Selected')
  })
})

