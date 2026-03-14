/**
 * E2E Tests: Toast Notifications
 *
 * Tests toast notification functionality across Settings page operations
 * and undo functionality for note and bookmark deletions.
 *
 * Coverage:
 * - Settings page toasts (save, export, import, reset)
 * - Note deletion with undo
 * - Bookmark deletion with undo
 * - Toast visibility, messages, and duration
 * - Undo action within time window
 */
import { test, expect, type Page } from '@playwright/test'
import { closeSidebar } from '../support/fixtures/constants/sidebar-constants'
import { TIMEOUTS } from '../utils/constants'

/**
 * Navigate to Settings page and wait for it to load.
 */
async function navigateToSettings(page: Page) {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({
    timeout: TIMEOUTS.NETWORK,
  })
}

/**
 * Navigate to Notes page bookmarks tab and wait for it to load.
 */
async function navigateToBookmarks(page: Page) {
  await page.goto('/notes?tab=bookmarks')
  await expect(page.getByRole('heading', { name: 'My Notes' })).toBeVisible({
    timeout: TIMEOUTS.NETWORK,
  })
}

/**
 * Seed a test bookmark to IndexedDB for deletion tests.
 */
async function seedTestBookmark(page: Page) {
  await page.evaluate(async () => {
    const bookmark = {
      id: 'test-bookmark-1',
      courseId: 'behavioral-analysis-101',
      lessonId: 'reading-micro-expressions',
      timestamp: 125,
      label: '2:05',
      createdAt: new Date('2025-01-15T10:00:00Z').toISOString(),
    }

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ElearningDB')

      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('bookmarks', 'readwrite')
        const store = tx.objectStore('bookmarks')
        const addRequest = store.add(bookmark)

        addRequest.onsuccess = () => {
          db.close()
          resolve()
        }
        addRequest.onerror = () => {
          db.close()
          reject(addRequest.error)
        }
      }

      request.onerror = () => reject(request.error)
    })
  })
}

/**
 * Seed a test note to IndexedDB for deletion tests.
 */
async function seedTestNote(page: Page) {
  await page.evaluate(async () => {
    const note = {
      id: 'test-note-1',
      courseId: 'behavioral-analysis-101',
      videoId: 'reading-micro-expressions',
      content: '<p>This is a test note for deletion.</p>',
      tags: ['testing'],
      timestamp: 60,
      createdAt: new Date('2025-01-15T10:00:00Z').toISOString(),
      updatedAt: new Date('2025-01-15T10:00:00Z').toISOString(),
    }

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ElearningDB')

      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('notes', 'readwrite')
        const store = tx.objectStore('notes')
        const addRequest = store.add(note)

        addRequest.onsuccess = () => {
          db.close()
          resolve()
        }
        addRequest.onerror = () => {
          db.close()
          reject(addRequest.error)
        }
      }

      request.onerror = () => reject(request.error)
    })
  })
}

test.describe('Toast Notifications', () => {
  test.beforeEach(async ({ page }) => {
    // Close tablet sidebar overlay to prevent click blocking
    // Use addInitScript to set localStorage before page loads
    await page.addInitScript(sidebarState => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    }, closeSidebar())
  })

  // ── Settings Page Toasts ──────────────────────────────────────

  test('Settings: profile save shows success toast', async ({ page }) => {
    await navigateToSettings(page)

    // Modify display name
    const nameInput = page.getByLabel(/display name/i)
    await nameInput.clear()
    await nameInput.fill('Test User')

    // Click save button
    await page.getByRole('button', { name: /save profile changes/i }).click()

    // Verify success toast appears
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await expect(toast).toContainText(/profile settings/i)
  })

  test('Settings: export shows success toast', async ({ page }) => {
    await navigateToSettings(page)

    // Find and click export button
    const exportButton = page.getByRole('button', { name: /export/i }).first()

    // Set up download handler
    const downloadPromise = page.waitForEvent('download')
    await exportButton.click()
    const download = await downloadPromise

    // Verify download started
    expect(download.suggestedFilename()).toBe('levelup-backup.json')

    // Verify success toast appears
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await expect(toast).toContainText(/data exported/i)
  })

  test('Settings: import with invalid file shows error toast', async ({ page }) => {
    await navigateToSettings(page)

    // Create a non-JSON file for testing
    const fileContent = 'This is not JSON'
    const buffer = Buffer.from(fileContent, 'utf-8')

    // Find file input (it's hidden)
    const fileInput = page.locator('input[type="file"][accept=".json"]')

    // Set file on input
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer,
    })

    // Verify error toast appears
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await expect(toast).toContainText(/invalid file/i)
    await expect(toast).toContainText(/json/i)
  })

  test('Settings: import with valid JSON shows success toast', async ({ page }) => {
    await navigateToSettings(page)

    // Create valid backup JSON
    const validBackup = {
      settings: {
        displayName: 'Imported User',
        bio: 'Imported bio',
        theme: 'light',
      },
      version: '1.0.0',
      exportDate: new Date().toISOString(),
    }
    const buffer = Buffer.from(JSON.stringify(validBackup), 'utf-8')

    // Find file input
    const fileInput = page.locator('input[type="file"][accept=".json"]')

    // Set file on input
    await fileInput.setInputFiles({
      name: 'levelup-backup.json',
      mimeType: 'application/json',
      buffer,
    })

    // Verify success toast appears
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await expect(toast).toContainText(/data imported successfully/i)
  })

  test('Settings: reset shows success toast', async ({ page }) => {
    await navigateToSettings(page)

    // Click reset button to open dialog
    const resetButton = page.getByRole('button', { name: /reset/i }).last()
    await resetButton.click()

    // Wait for alert dialog
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    // Confirm reset
    const confirmButton = dialog.getByRole('button', { name: /reset everything/i })
    await confirmButton.click()

    // Verify success toast appears
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await expect(toast).toContainText(/all data reset to defaults/i)
  })

  // ── Note Deletion with Undo ────────────────────────────────────

  test('Note: deletion shows undo toast', async ({ page }) => {
    // Seed test note
    await seedTestNote(page)

    // Navigate to Library > Notes
    await page.goto('/notes')
    await expect(page.getByRole('heading', { name: 'My Notes' })).toBeVisible()

    // Wait for note to appear
    const noteCard = page.getByText(/this is a test note/i)
    await expect(noteCard).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Click to expand note
    await noteCard.click()

    // Wait for delete button to appear
    const deleteButton = page.getByTestId('delete-note-button')
    await expect(deleteButton).toBeVisible()

    // Click delete
    await deleteButton.click()

    // Verify undo toast appears
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await expect(toast).toContainText(/note deleted/i)

    // Verify undo button exists
    const undoButton = toast.getByRole('button', { name: /undo/i })
    await expect(undoButton).toBeVisible()
  })

  test('Note: undo restores note and shows success toast', async ({ page }) => {
    // Seed test note
    await seedTestNote(page)

    // Navigate to Library > Notes
    await page.goto('/notes')
    await expect(page.getByRole('heading', { name: 'My Notes' })).toBeVisible()

    // Expand and delete note
    const noteCard = page.getByText(/this is a test note/i)
    await expect(noteCard).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await noteCard.click()

    const deleteButton = page.getByTestId('delete-note-button')
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()

    // Wait for undo toast
    const deleteToast = page.locator('[data-sonner-toast]').filter({ hasText: /note deleted/i })
    await expect(deleteToast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Click undo
    const undoButton = deleteToast.getByRole('button', { name: /undo/i })
    await undoButton.click()

    // Verify success toast appears
    const successToast = page.locator('[data-sonner-toast]').filter({ hasText: /note restored/i })
    await expect(successToast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Verify note is restored
    await expect(noteCard).toBeVisible()
  })

  // ── Bookmark Deletion with Undo ────────────────────────────────

  test('Bookmark: deletion shows undo toast with timestamp', async ({ page }) => {
    // Seed test bookmark
    await seedTestBookmark(page)

    // Navigate to Library > Bookmarks
    await navigateToBookmarks(page)

    // Wait for bookmark to appear
    const bookmarkEntry = page.getByTestId('bookmark-entry')
    await expect(bookmarkEntry).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Hover to show delete button
    await bookmarkEntry.hover()

    // Click delete button
    const deleteButton = bookmarkEntry.getByRole('button', { name: /delete bookmark/i })
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()

    // Verify undo toast appears with timestamp
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await expect(toast).toContainText(/bookmark at 2:05 deleted/i)

    // Verify undo button exists
    const undoButton = toast.getByRole('button', { name: /undo/i })
    await expect(undoButton).toBeVisible()
  })

  test('Bookmark: undo restores bookmark and shows success toast', async ({ page }) => {
    // Seed test bookmark
    await seedTestBookmark(page)

    // Navigate to Library > Bookmarks
    await navigateToBookmarks(page)

    // Wait for bookmark to appear
    const bookmarkEntry = page.getByTestId('bookmark-entry')
    await expect(bookmarkEntry).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Hover to show delete button
    await bookmarkEntry.hover()

    // Delete bookmark
    const deleteButton = bookmarkEntry.getByRole('button', { name: /delete bookmark/i })
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()

    // Wait for undo toast
    const deleteToast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /bookmark.*deleted/i })
    await expect(deleteToast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Click undo
    const undoButton = deleteToast.getByRole('button', { name: /undo/i })
    await undoButton.click()

    // Verify success toast appears
    const successToast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /bookmark restored/i })
    await expect(successToast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Verify bookmark is restored
    await expect(bookmarkEntry).toBeVisible()
  })

  // ── Toast Duration and Auto-Dismiss ────────────────────────────

  test('Success toast auto-dismisses after short duration', async ({ page }) => {
    await navigateToSettings(page)

    // Trigger a success toast (profile save)
    const nameInput = page.getByLabel(/display name/i)
    await nameInput.clear()
    await nameInput.fill('Auto Dismiss Test')
    await page.getByRole('button', { name: /save profile changes/i }).click()

    // Verify toast appears
    const toast = page.locator('[data-sonner-toast]')
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Wait for auto-dismiss (SHORT duration = 3000ms)
    // Add 500ms buffer for animation
    await page.waitForTimeout(3500)

    // Verify toast is gone
    await expect(toast).not.toBeVisible()
  })

  test('Undo toast persists for longer duration', async ({ page }) => {
    // Seed test note
    await seedTestNote(page)

    // Navigate to Library > Notes and delete
    await page.goto('/notes')
    await expect(page.getByRole('heading', { name: 'My Notes' })).toBeVisible()

    const noteCard = page.getByText(/this is a test note/i)
    await expect(noteCard).toBeVisible({ timeout: TIMEOUTS.NETWORK })
    await noteCard.click()

    const deleteButton = page.getByTestId('delete-note-button')
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()

    // Verify undo toast appears
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /note deleted/i })
    await expect(toast).toBeVisible({ timeout: TIMEOUTS.NETWORK })

    // Wait 3.5 seconds (SHORT duration) - toast should still be visible
    await page.waitForTimeout(3500)
    await expect(toast).toBeVisible()

    // Undo toast uses MEDIUM duration (5000ms)
    // Wait another 2 seconds (total 5.5s) - toast should be gone
    await page.waitForTimeout(2000)
    await expect(toast).not.toBeVisible()
  })
})
