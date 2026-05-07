/**
 * E2E tests for the Library tabbed IA (Continue | Browse | Collections | History).
 *
 * Covers:
 * - Tab persistence: URL param priority > localStorage > default 'continue'
 * - TabBar click navigation
 * - Cross-tab content scoping (browse content doesn't leak to other tabs)
 * - Continue, Collections, History tabs render content
 *
 * Note: Tab buttons have data-testid="library-tab-{id}".
 * Tab content panels have data-testid="library-tab-panel-{id}".
 */

import { test, expect } from '../support/fixtures'
import { seedBooks } from '../support/helpers/indexeddb-seed'
import {
  tabSeedsBase,
  tabSeedsAudiobooksOnly,
  tabSeedsEbooksOnly,
  tabSeedsWithMixedAudiobook,
} from '../support/helpers/library-tab-seed'

const TAB_BUTTON = (id: string) => `[role="tab"][data-testid="library-tab-${id}"]`
const TAB_PANEL = (id: string) => `[data-testid="library-tab-panel-${id}"]`

const TEST_BOOKS = tabSeedsBase()

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await seedBooks(page, TEST_BOOKS)
})

test.describe('Tab state persistence', () => {
  test('URL param ?tab= overrides localStorage and default', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('knowlune-library-tab', 'browse'))
    await page.goto('/library?tab=collections')

    // Tab button is active
    await expect(page.locator(TAB_BUTTON('collections'))).toHaveAttribute(
      'aria-selected',
      'true'
    )
    // Content panel is visible
    await expect(page.locator(TAB_PANEL('collections'))).toBeVisible()
  })

  test('localStorage fallback when no URL param present', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('knowlune-library-tab', 'history'))
    await page.goto('/library')

    await expect(page.locator(TAB_BUTTON('history'))).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(TAB_PANEL('history'))).toBeVisible()
  })

  test('invalid URL param falls through to default continue', async ({ page }) => {
    await page.goto('/library?tab=invalidtab')

    await expect(page.locator(TAB_BUTTON('continue'))).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator(TAB_PANEL('continue'))).toBeVisible()
  })

  test('clicking a tab writes to localStorage and updates URL', async ({ page }) => {
    await page.goto('/library?tab=browse')

    await page.locator(TAB_BUTTON('history')).click()

    await expect(page.locator(TAB_BUTTON('history'))).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/tab=history/)

    // Reload and verify persistence
    await page.reload()
    await expect(page.locator(TAB_BUTTON('history'))).toHaveAttribute('aria-selected', 'true')
  })

  test('tab choice persists across navigation via localStorage', async ({ page }) => {
    await page.goto('/library')

    await page.locator(TAB_BUTTON('collections')).click()

    // Navigate away and back — localStorage should restore the tab
    await page.goto('/library')
    await expect(page.locator(TAB_BUTTON('collections'))).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })
})

test.describe('TabBar click navigation', () => {
  test('all four tabs are visible and clickable', async ({ page }) => {
    await page.goto('/library?tab=browse')

    for (const tab of ['continue', 'browse', 'collections', 'history']) {
      await expect(page.locator(TAB_BUTTON(tab))).toBeVisible()
    }
  })

  test('clicking Continue tab shows media hero', async ({ page }) => {
    await page.goto('/library?tab=history')
    await page.locator(TAB_BUTTON('continue')).click()

    await expect(page.locator('[data-testid="library-media-hero"]')).toBeVisible()
  })

  test('clicking Collections tab shows manage shelves button', async ({ page }) => {
    await page.goto('/library?tab=history')
    await page.locator(TAB_BUTTON('collections')).click()

    await expect(page.locator('[data-testid="manage-shelves-inline"]')).toBeVisible()
  })

  test('clicking History tab shows stats cards', async ({ page }) => {
    await page.goto('/library?tab=browse')
    await page.locator(TAB_BUTTON('history')).click()

    await expect(page.getByText('Books finished this year')).toBeVisible()
  })
})

test.describe('Cross-tab content scoping', () => {
  test('browse filters do not appear on Continue tab', async ({ page }) => {
    await page.goto('/library?tab=continue')

    await expect(page.locator(TAB_PANEL('browse'))).not.toBeVisible()
    await expect(page.locator('[data-testid="library-search-input"]')).not.toBeVisible()
  })

  test('Continue hero does not appear on Browse tab', async ({ page }) => {
    await page.goto('/library?tab=browse')

    await expect(page.locator(TAB_PANEL('continue'))).not.toBeVisible()
    await expect(page.locator('[data-testid="library-media-hero"]')).not.toBeVisible()
  })

  test('switching tabs hides previous tab content', async ({ page }) => {
    await page.goto('/library?tab=browse')
    await expect(page.locator(TAB_PANEL('browse'))).toBeVisible()

    await page.locator(TAB_BUTTON('continue')).click()
    await expect(page.locator(TAB_PANEL('browse'))).not.toBeVisible()
    await expect(page.locator(TAB_PANEL('continue'))).toBeVisible()

    await page.locator(TAB_BUTTON('history')).click()
    await expect(page.locator(TAB_PANEL('continue'))).not.toBeVisible()
    await expect(page.locator(TAB_PANEL('history'))).toBeVisible()
  })
})

test.describe('Tab content rendering', () => {
  test('Continue tab shows hero and shelves', async ({ page }) => {
    await page.goto('/library?tab=continue')

    await expect(page.locator('[data-testid="library-media-hero"]')).toBeVisible()
    await expect(page.getByText('Recently Added')).toBeVisible()
    await expect(page.getByText('Continue Reading')).toBeVisible()
  })

  test('History tab shows stats and recently finished list', async ({ page }) => {
    await page.goto('/library?tab=history')

    await expect(page.getByText('Books finished this year')).toBeVisible()
    await expect(page.getByText('Pages read')).toBeVisible()
    await expect(page.getByText('Recently Finished')).toBeVisible()
    await expect(page.getByText('Tab Test Novel')).toBeVisible()
  })

  test('Collections tab shows smart grouped view with books', async ({ page }) => {
    await page.goto('/library?tab=collections')

    await expect(page.locator('[data-testid="manage-shelves-inline"]')).toBeVisible()
    await expect(page.locator('[data-testid="smart-grouped-view"]')).toBeVisible()
  })

  test('no JS console errors during tab navigation', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/library?tab=browse')
    await page.locator(TAB_BUTTON('continue')).click()
    await page.locator(TAB_BUTTON('collections')).click()
    await page.locator(TAB_BUTTON('history')).click()

    const realErrors = errors.filter(
      e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('400') &&
        !e.includes('syncEngine')
    )
    expect(realErrors, `Console errors during tab nav: ${realErrors.join('\n')}`).toEqual([])
  })
})

test.describe('Mixed-format library defaults', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await seedBooks(page, tabSeedsWithMixedAudiobook())
  })

  test('Browse tab does not auto-apply format filter chip when both formats exist', async ({
    page,
  }) => {
    await page.goto('/library?tab=browse')
    await expect(page.getByTestId('library-active-filter-remove-format')).toHaveCount(0)
  })

  test('Continue tab shows Books badge when both formats exist and no format is selected', async ({
    page,
  }) => {
    await page.goto('/library?tab=continue')

    // Hero should be visible
    await expect(page.getByTestId('library-media-hero')).toBeVisible()
    // Badge shows 'Books' in all-mode (not a single format name)
    await expect(page.getByTestId('library-media-hero')).toContainText('Books')
  })

  test('Continue tab format tab switching works with mixed-format library', async ({
    page,
  }) => {
    await page.goto('/library?tab=continue')

    // Format tab bar is visible
    await expect(page.getByTestId('library-format-mode-tabs')).toBeVisible()

    // Click audiobooks tab — hero should update to audiobook content
    await page.getByTestId('library-format-mode-audiobooks').click()
    await expect(page.getByTestId('library-media-hero')).toBeVisible()

    // Click ebooks tab — hero should update to ebook content
    await page.getByTestId('library-format-mode-ebooks').click()
    await expect(page.getByTestId('library-media-hero')).toBeVisible()
  })
})

test.describe('Single-format library auto-filter', () => {
  test('Audiobooks-only library auto-selects Audiobooks format tab', async ({ page }) => {
    await page.goto('/')
    await seedBooks(page, tabSeedsAudiobooksOnly())
    await page.goto('/library?tab=continue')

    // Format tab bar is visible
    await expect(page.getByTestId('library-format-mode-tabs')).toBeVisible()
    // Audiobooks tab should be active (auto-filter applied)
    await expect(page.getByTestId('library-format-mode-audiobooks')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    // Ebooks tab should NOT be active
    await expect(page.getByTestId('library-format-mode-ebooks')).toHaveAttribute(
      'aria-selected',
      'false'
    )
  })

  test('Ebooks-only library auto-selects Ebooks format tab', async ({ page }) => {
    await page.goto('/')
    await seedBooks(page, tabSeedsEbooksOnly())
    await page.goto('/library?tab=continue')

    // Format tab bar is visible
    await expect(page.getByTestId('library-format-mode-tabs')).toBeVisible()
    // Ebooks tab should be active (auto-filter applied)
    await expect(page.getByTestId('library-format-mode-ebooks')).toHaveAttribute(
      'aria-selected',
      'true'
    )
    // Audiobooks tab should NOT be active
    await expect(page.getByTestId('library-format-mode-audiobooks')).toHaveAttribute(
      'aria-selected',
      'false'
    )
  })
})
