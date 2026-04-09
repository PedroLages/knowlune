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
import { seedBooks } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

test.describe('E107-S04: About Book Dialog', () => {
  test.beforeEach(async ({ page }) => {
    // Set localStorage to skip onboarding dialog BEFORE page load
    // Key format matches useOnboardingStore.ts STORAGE_KEY
    await page.addInitScript(() => {
      const onboardingData = {
        completedAt: new Date('2025-01-01').toISOString(),
        skipped: true
      }
      localStorage.setItem('knowlune-onboarding-v1', JSON.stringify(onboardingData))
    })

    // Navigate to library page directly
    await page.goto('/library')

    // Seed test books - one complete EPUB, one missing metadata, one audiobook
    await seedBooks(page, [
      {
        id: 'test-book-1-epub-complete',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        format: 'epub',
        status: 'reading',
        description: 'A story of the mysteriously wealthy Jay Gatsby and his love for Daisy Buchanan.',
        isbn: '978-0-7432-7356-5',
        tags: ['Classic', 'Fiction'],
        fileSize: 450000,
        progress: 45,
        chapters: [],
        source: { type: 'local', opfsPath: '/test/gatsby.epub' },
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE
      },
      {
        id: 'test-book-2-missing-metadata',
        title: 'Untitled Book',
        author: '', // Missing author
        format: 'epub',
        status: 'unread',
        description: '', // Missing description
        isbn: '', // Missing ISBN
        tags: [],
        progress: 0,
        chapters: [],
        source: { type: 'local', opfsPath: '/test/untitled.epub' },
        createdAt: FIXED_DATE
      },
      {
        id: 'test-book-3-audiobook',
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        narrator: 'Rob Inglis',
        format: 'audiobook',
        status: 'reading',
        description: 'Bilbo Baggins, a hobbit enjoying his quiet life, is swept into an epic quest.',
        isbn: '978-0-2611-0221-4',
        tags: ['Fantasy', 'Adventure'],
        fileSize: 250000000,
        totalDuration: 68400, // 19 hours
        progress: 60,
        chapters: [],
        source: { type: 'local', opfsPath: '/test/hobbit.m4b' },
        createdAt: FIXED_DATE
      }
    ])

    // Reload page to pick up seeded data
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Close any open dialogs (overlay may be present from previous test state)
    const openOverlay = page.locator('[data-slot="dialog-overlay"][data-state="open"]')
    const overlayCount = await openOverlay.count()
    if (overlayCount > 0) {
      // Click overlay to close the dialog, or press Escape
      try {
        await openOverlay.first().click({ timeout: 2000 })
      } catch {
        // If clicking fails, try Escape key
        await page.keyboard.press('Escape')
      }
      // eslint-disable-next-line test-patterns/no-hard-waits -- Necessary wait for dialog close animation to settle
      await page.waitForTimeout(500)
    }
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
    const bookCard = page.locator('[data-testid^="book-card-"]').first()
    await expect(bookCard).toContainFocus()
  })
})
