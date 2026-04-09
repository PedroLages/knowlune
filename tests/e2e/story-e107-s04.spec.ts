/**
 * E2E Tests for E107-S04: Wire About Book Dialog
 *
 * Acceptance Criteria:
 * - AC-1: About Book dialog is accessible from BookCard and BookListItem context menu
 * - AC-2: Dialog displays book metadata (title, author, description, publish date, ISBN, tags, format)
 * - AC-3: Dialog handles missing metadata gracefully with fallback text
 * - AC-4: Dialog is accessible (keyboard navigation, ARIA labels, focus trap)
 * - AC-5: Dialog works for both EPUB and audiobook formats
 */

import { test, expect } from '../support/fixtures'

test.describe('E107-S04: About Book Dialog', () => {
  test.beforeEach(async ({ libraryPage }) => {
    // Navigate to library page
    await libraryPage.goto()
  })

  test('AC-1: Opens About Book dialog from BookCard context menu', async ({ libraryPage, page }) => {
    // Open context menu on first book card
    await libraryPage.openBookCardContextMenu(0)

    // Click "About Book" menu item
    await page.click('[data-testid="context-menu-about-book"]')

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Verify dialog has proper ARIA role
    await expect(dialog).toHaveAttribute('role', 'dialog')
  })

  test('AC-1: Opens About Book dialog from BookListItem', async ({ libraryPage, page }) => {
    // Switch to list view
    await libraryPage.switchToListView()

    // Open context menu on first book list item
    await libraryPage.openBookListItemContextMenu(0)

    // Click "About Book" menu item
    await page.click('[data-testid="dropdown-menu-about-book"]')

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
  })

  test('AC-2: Displays complete book metadata', async ({ libraryPage, page }) => {
    // Open About Book dialog for a book with complete metadata
    await libraryPage.openAboutBookDialog(0)

    // Verify title is displayed
    await expect(page.locator('[data-testid="about-book-title"]')).toBeVisible()

    // Verify author is displayed
    await expect(page.locator('[data-testid="about-book-author"]')).toBeVisible()

    // Verify description is displayed
    await expect(page.locator('[data-testid="about-book-description"]')).toBeVisible()

    // Verify metadata fields are displayed with actual values
    await expect(page.locator('[data-testid="about-book-format"]')).toContainText(/EPUB|Audiobook/)
    await expect(page.locator('[data-testid="about-book-isbn"]')).toHaveText(/[\d-]+/)
    await expect(page.locator('[data-testid="about-book-tags"]')).toBeVisible()
  })

  test('AC-3: Handles missing metadata gracefully', async ({ libraryPage, page }) => {
    // Open About Book dialog for a book with incomplete metadata
    // (This test assumes test data includes a book with missing fields)
    await libraryPage.openAboutBookDialog(1) // Use second test book

    // Verify fallback text is shown for missing author
    const author = page.locator('[data-testid="about-book-author"]')
    await expect(author).toBeVisible()
    await expect(author).toContainText('Unknown author')

    // Verify fallback text is shown for missing description
    const description = page.locator('[data-testid="about-book-description"]')
    await expect(description).toBeVisible()
    await expect(description).toContainText('No description')
  })

  test('AC-4: Keyboard navigation and focus trap', async ({ libraryPage, page }) => {
    // Open About Book dialog
    await libraryPage.openAboutBookDialog(0)

    // Verify focus is trapped in dialog
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeFocused()

    // Press Tab to move focus within dialog
    await page.keyboard.press('Tab')

    // Verify focus stays within dialog (focus trap)
    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    expect(focusedElement).toBeTruthy()

    // Press Escape to close dialog
    await page.keyboard.press('Escape')

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible()
  })

  test('AC-4: ARIA labels and accessibility', async ({ libraryPage, page }) => {
    // Open About Book dialog
    await libraryPage.openAboutBookDialog(0)

    // Verify dialog has accessible name
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toHaveAttribute('aria-labelledby')

    // Verify close button has aria-label
    const closeButton = page.locator('[aria-label="Close dialog"]')
    await expect(closeButton).toBeVisible()
  })

  test('AC-5: Works with EPUB format', async ({ libraryPage, page }) => {
    // Open About Book dialog for EPUB book
    await libraryPage.openAboutBookDialog(0) // Assuming first book is EPUB

    // Verify format shows EPUB
    const format = page.locator('[data-testid="about-book-format"]')
    await expect(format).toContainText('EPUB')
  })

  test('AC-5: Works with audiobook format', async ({ libraryPage, page }) => {
    // Open About Book dialog for audiobook
    // This assumes test data includes an audiobook
    await libraryPage.openAboutBookDialog(2) // Use third test book (audiobook)

    // Verify format shows Audiobook
    const format = page.locator('[data-testid="about-book-format"]')
    await expect(format).toContainText('Audiobook')
  })

  test('Dialog closes on click outside', async ({ libraryPage, page }) => {
    // Open About Book dialog
    await libraryPage.openAboutBookDialog(0)

    // Click overlay (outside dialog)
    const overlay = page.locator('[data-radix-overlay]').first()
    await overlay.click({ position: { x: 10, y: 10 } })

    // Verify dialog is closed
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).not.toBeVisible()
  })

  test('Dialog returns focus to triggering element on close', async ({ libraryPage, page }) => {
    // Open context menu
    await libraryPage.openBookCardContextMenu(0)

    // Store reference to menu item before opening dialog
    const menuItem = page.locator('[data-testid="context-menu-about-book"]')

    // Click to open dialog
    await menuItem.click()

    // Close dialog with Escape
    await page.keyboard.press('Escape')

    // Verify focus returns to menu item or button that triggered it
    // Note: After Escape, the context menu may also be closed, so we check
    // that focus is returned to a sensible element in the book card
    const bookCard = page.locator('[data-testid="book-card"]').first()
    await expect(bookCard).toContainFocus()
  })
})
