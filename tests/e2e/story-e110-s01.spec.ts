/**
 * E110-S01: Smart Shelves — E2E tests
 *
 * Tests shelf creation, renaming, deletion, adding/removing books,
 * and filtering by shelf in the library.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedBooks, seedShelves, seedBookShelves } from '../support/helpers/seed-helpers'
import { FIXED_DATE } from '../utils/test-time'

const TEST_BOOKS = [
  {
    id: 'book-1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    format: 'epub',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/test' },
    progress: 30,
    createdAt: FIXED_DATE,
  },
  {
    id: 'book-2',
    title: 'Dune',
    author: 'Frank Herbert',
    format: 'audiobook',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/test2' },
    progress: 0,
    createdAt: FIXED_DATE,
  },
]

test.describe('Smart Shelves (E110-S01)', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  test('default shelves are created on first load', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, TEST_BOOKS)
    await navigateAndWait(page, '/library')

    // Open shelf manager
    await page.getByTestId('manage-shelves-trigger').click()
    await expect(page.getByTestId('shelf-manager-dialog')).toBeVisible()

    // Verify 3 default shelves exist
    await expect(page.getByTestId('shelf-item-favorites')).toBeVisible()
    await expect(page.getByTestId('shelf-item-currently-reading')).toBeVisible()
    await expect(page.getByTestId('shelf-item-want-to-read')).toBeVisible()
  })

  test('can create a custom shelf', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, TEST_BOOKS)
    await navigateAndWait(page, '/library')

    await page.getByTestId('manage-shelves-trigger').click()
    await expect(page.getByTestId('shelf-manager-dialog')).toBeVisible()

    // Type and create
    await page.getByTestId('new-shelf-input').fill('Science Fiction')
    await page.getByTestId('create-shelf-btn').click()

    // Verify it appears
    await expect(page.getByTestId('shelf-item-science-fiction')).toBeVisible()
  })

  test('can rename a custom shelf', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, TEST_BOOKS)
    // Seed a custom shelf
    await seedShelves(page, [
      {
        id: 'shelf-custom-1',
        name: 'My Shelf',
        isDefault: false,
        sortOrder: 10,
        createdAt: FIXED_DATE,
      },
    ])
    await navigateAndWait(page, '/library')

    await page.getByTestId('manage-shelves-trigger').click()
    await expect(page.getByTestId('shelf-manager-dialog')).toBeVisible()

    // Click rename button
    await page.getByTestId('rename-shelf-my-shelf').click()
    await page.getByTestId('rename-shelf-input').fill('Renamed Shelf')
    await page.getByTestId('save-rename-btn').click()

    // Verify renamed
    await expect(page.getByTestId('shelf-item-renamed-shelf')).toBeVisible()
  })

  test('can delete a custom shelf with confirmation', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, TEST_BOOKS)
    await seedShelves(page, [
      {
        id: 'shelf-to-delete',
        name: 'Temporary',
        isDefault: false,
        sortOrder: 10,
        createdAt: FIXED_DATE,
      },
    ])
    await navigateAndWait(page, '/library')

    await page.getByTestId('manage-shelves-trigger').click()
    await expect(page.getByTestId('shelf-item-temporary')).toBeVisible()

    // Click delete
    await page.getByTestId('delete-shelf-temporary').click()
    await expect(page.getByTestId('confirm-delete-shelf')).toBeVisible()
    await page.getByTestId('confirm-delete-shelf').click()

    // Verify gone
    await expect(page.getByTestId('shelf-item-temporary')).not.toBeVisible()
  })

  test('can add book to shelf via context menu and filter by shelf', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, TEST_BOOKS)
    await navigateAndWait(page, '/library')

    // Wait for books to render
    await expect(page.getByText('The Great Gatsby')).toBeVisible()
    await expect(page.getByText('Dune')).toBeVisible()

    // Right-click on first book to open context menu
    await page.getByText('The Great Gatsby').click({ button: 'right' })
    await expect(page.getByTestId('context-menu-add-to-shelf')).toBeVisible()
    await page.getByTestId('context-menu-add-to-shelf').hover()

    // Click "Favorites" shelf
    await page.getByTestId('context-menu-shelf-favorites').click()

    // Now open filter sidebar and filter by Favorites shelf
    // The filter sidebar is opened via the filter button in LibraryFilters
    await page.getByTestId('filter-sidebar-trigger').click()
    await expect(page.getByTestId('filter-sidebar')).toBeVisible()

    // Click on Favorites shelf filter
    await page.getByTestId('shelf-filter-favorites').click()

    // Close sidebar
    await page.keyboard.press('Escape')

    // Only The Great Gatsby should be visible, not Dune
    await expect(page.getByText('The Great Gatsby')).toBeVisible()
    await expect(page.getByText('Dune')).not.toBeVisible()
  })
})
