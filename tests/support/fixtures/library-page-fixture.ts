/**
 * Library Page Fixture — E2E test helper for library page interactions
 *
 * Provides reusable methods for:
 * - Navigation to library page
 * - Opening context menus on book cards and list items
 * - Switching between grid and list views
 * - Opening the About Book dialog
 *
 * @since E107-S04
 */

import { test as base } from '@playwright/test'

export interface LibraryPageHelper {
  goto: () => Promise<void>
  switchToListView: () => Promise<void>
  openBookCardContextMenu: (index: number) => Promise<void>
  openBookListItemContextMenu: (index: number) => Promise<void>
  openAboutBookDialog: (index: number) => Promise<void>
}

export const test = base.extend<{
  libraryPage: LibraryPageHelper
}>({
  libraryPage: async ({ page }, use) => {
    const helper: LibraryPageHelper = {
      goto: () => page.goto('/library'),

      switchToListView: () =>
        page.locator('[data-testid="view-toggle-list"]').click(),

      openBookCardContextMenu: async (index: number) => {
        const card = page.locator('[data-testid="book-card"]').nth(index)
        await card.click({ button: 'right' })
      },

      openBookListItemContextMenu: async (index: number) => {
        const item = page.locator('[data-testid="book-list-item"]').nth(index)
        const dropdown = item.locator('[data-testid="dropdown-trigger"]')
        await dropdown.click()
      },

      openAboutBookDialog: async (index: number) => {
        await helper.openBookCardContextMenu(index)
        await page.locator('[data-testid="context-menu-about-book"]').click()
      }
    }
    await use(helper)
  }
})
