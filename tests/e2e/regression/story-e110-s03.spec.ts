/**
 * E110-S03: Reading Queue — E2E tests
 *
 * Tests queue visibility, add/remove via context menu, remove button,
 * persistence across reloads, book detail display, and auto-removal
 * on book completion.
 */
import { test, expect } from '@playwright/test'
import { navigateAndWait } from '../../support/helpers/navigation'
import { seedBooks, seedReadingQueue } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const BOOK_1 = {
  id: 'q-book-1',
  title: 'Dune',
  author: 'Frank Herbert',
  format: 'epub',
  status: 'reading',
  tags: [],
  chapters: [],
  source: { type: 'local', opfsPath: '/test' },
  progress: 42,
  createdAt: FIXED_DATE,
}

const BOOK_2 = {
  id: 'q-book-2',
  title: 'Foundation',
  author: 'Isaac Asimov',
  format: 'epub',
  status: 'unread',
  tags: [],
  chapters: [],
  source: { type: 'local', opfsPath: '/test2' },
  progress: 0,
  createdAt: FIXED_DATE,
}

const QUEUE_ENTRY_1 = {
  id: 'qe-1',
  bookId: 'q-book-1',
  sortOrder: 0,
  addedAt: FIXED_DATE,
}

const BOOK_3 = {
  id: 'q-book-3',
  title: 'Neuromancer',
  author: 'William Gibson',
  format: 'epub',
  status: 'unread',
  tags: [],
  chapters: [],
  source: { type: 'local', opfsPath: '/test3' },
  progress: 0,
  createdAt: FIXED_DATE,
}

const QUEUE_ENTRY_2 = {
  id: 'qe-2',
  bookId: 'q-book-2',
  sortOrder: 1,
  addedAt: FIXED_DATE,
}

const QUEUE_ENTRY_3 = {
  id: 'qe-3',
  bookId: 'q-book-3',
  sortOrder: 2,
  addedAt: FIXED_DATE,
}

test.describe('Reading Queue (E110-S03)', () => {
  test('empty state is shown when no books are queued (AC-1)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [BOOK_1])
    await navigateAndWait(page, '/library')

    await expect(page.getByTestId('reading-queue-empty')).toBeVisible()
  })

  test('add book to queue via dropdown menu (AC-2)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [BOOK_1])
    await navigateAndWait(page, '/library')

    // Open "more actions" dropdown on the first book card
    const bookCard = page.getByTestId('book-card-q-book-1')
    await bookCard.hover()
    await page.getByTestId('book-more-actions').first().click()

    // Click "Add to Queue"
    await page.getByTestId('dropdown-menu-queue-toggle').click()

    // Queue section should now show the book
    await expect(page.getByTestId('reading-queue-section')).toBeVisible()
    await expect(page.getByTestId('queue-item-q-book-1')).toBeVisible()
  })

  test('remove book from queue via remove button (AC-3)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [BOOK_1])
    await seedReadingQueue(page, [QUEUE_ENTRY_1])
    await navigateAndWait(page, '/library')

    // Queue item should be visible
    await expect(page.getByTestId('queue-item-q-book-1')).toBeVisible()

    // Click the remove button
    await page.getByTestId('queue-remove-q-book-1').click()

    // Queue should now be empty
    await expect(page.getByTestId('reading-queue-empty')).toBeVisible()
    await expect(page.getByTestId('queue-item-q-book-1')).not.toBeVisible()
  })

  test('queue persists across page reloads (AC-5)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [BOOK_1, BOOK_2])
    await seedReadingQueue(page, [QUEUE_ENTRY_1, QUEUE_ENTRY_2])
    await navigateAndWait(page, '/library')

    // Both queue items should appear
    await expect(page.getByTestId('queue-item-q-book-1')).toBeVisible()
    await expect(page.getByTestId('queue-item-q-book-2')).toBeVisible()

    // Reload and check persistence
    await page.reload()
    await page.waitForLoadState('load')
    await expect(page.getByTestId('queue-item-q-book-1')).toBeVisible()
    await expect(page.getByTestId('queue-item-q-book-2')).toBeVisible()
  })

  test('queue shows book title, author, and progress (AC-6)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [BOOK_1])
    await seedReadingQueue(page, [QUEUE_ENTRY_1])
    await navigateAndWait(page, '/library')

    const queueItem = page.getByTestId('queue-item-q-book-1')
    await expect(queueItem).toBeVisible()

    // Title and author
    await expect(queueItem.getByText('Dune')).toBeVisible()
    await expect(queueItem.getByText('Frank Herbert')).toBeVisible()

    // Progress percentage text
    await expect(queueItem.getByText('42%')).toBeVisible()
  })

  test('auto-removes book from queue when marked as finished (AC-7)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [BOOK_1])
    await seedReadingQueue(page, [QUEUE_ENTRY_1])
    await navigateAndWait(page, '/library')

    // Verify book is in queue
    await expect(page.getByTestId('queue-item-q-book-1')).toBeVisible()

    // Mark book as finished via "more actions" dropdown → Change Status → Finished
    const bookCard = page.getByTestId('book-card-q-book-1')
    await bookCard.hover()
    await page.getByTestId('book-more-actions').first().click()
    await page.getByRole('menuitem', { name: /change status/i }).hover()
    await page.getByTestId('context-menu-status-finished').click()

    // Book should be auto-removed from queue
    await expect(page.getByTestId('queue-item-q-book-1')).not.toBeVisible()
    await expect(page.getByTestId('reading-queue-empty')).toBeVisible()
  })

  test('queue badge count updates as books are added and removed (AC-1)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [BOOK_1, BOOK_2])
    await seedReadingQueue(page, [QUEUE_ENTRY_1, QUEUE_ENTRY_2])
    await navigateAndWait(page, '/library')

    // Count badge should show 2
    const badge = page.getByTestId('reading-queue-count')
    await expect(badge).toHaveText('2')

    // Remove one book
    await page.getByTestId('queue-remove-q-book-1').click()

    // Count badge should show 1
    await expect(badge).toHaveText('1')
  })

  test('drag-and-drop reorders queue and persists after reload (AC-4)', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedBooks(page, [BOOK_1, BOOK_2, BOOK_3])
    await seedReadingQueue(page, [QUEUE_ENTRY_1, QUEUE_ENTRY_2, QUEUE_ENTRY_3])
    await navigateAndWait(page, '/library')

    // Verify initial DOM order: book-1, book-2, book-3
    const items = page.locator('[data-testid^="queue-item-q-book-"]')
    await expect(items).toHaveCount(3)
    await expect(items.nth(0)).toHaveAttribute('data-testid', 'queue-item-q-book-1')
    await expect(items.nth(1)).toHaveAttribute('data-testid', 'queue-item-q-book-2')

    // Drag book-2's handle above book-1 using pointer events
    const handle = page.getByTestId('queue-drag-handle-q-book-2')
    const target = page.getByTestId('queue-item-q-book-1')

    const handleBox = await handle.boundingBox()
    const targetBox = await target.boundingBox()
    if (!handleBox || !targetBox) throw new Error('Could not get bounding boxes for drag test')

    const startX = handleBox.x + handleBox.width / 2
    const startY = handleBox.y + handleBox.height / 2
    const endX = targetBox.x + targetBox.width / 2
    // Drop in upper quarter of book-1 to place above it
    const endY = targetBox.y + targetBox.height / 4

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    // Activate PointerSensor: needs ≥5px movement before drag starts
    await page.mouse.move(startX, startY - 6, { steps: 4 })
    // Gradually move to target position
    await page.mouse.move(endX, endY, { steps: 20 })
    await page.mouse.up()

    // Assert new order: book-2 is now before book-1
    await expect(items.nth(0)).toHaveAttribute('data-testid', 'queue-item-q-book-2')
    await expect(items.nth(1)).toHaveAttribute('data-testid', 'queue-item-q-book-1')

    // Reload and assert order persists (was saved to IndexedDB)
    await page.reload()
    await page.waitForLoadState('load')

    const reloadedItems = page.locator('[data-testid^="queue-item-q-book-"]')
    await expect(reloadedItems.nth(0)).toHaveAttribute('data-testid', 'queue-item-q-book-2')
    await expect(reloadedItems.nth(1)).toHaveAttribute('data-testid', 'queue-item-q-book-1')
  })
})
