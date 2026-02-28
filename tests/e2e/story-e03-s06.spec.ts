/**
 * Story 3.6: View Course Notes Collection — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Notes tab showing notes grouped by video with preview, tags, timestamps, sort controls
 *   - AC2: Click note → full content, inline edit, delete with confirmation + MiniSearch removal
 *   - AC3: Empty state when course has no notes
 *
 * RED phase — these tests are written before implementation and should fail initially.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

const COURSE_ID = 'operative-six'
const COURSE_URL = `/courses/${COURSE_ID}`

/** Suppress sidebar overlay and navigate to course detail. */
async function goToCourseDetail(page: Parameters<typeof navigateAndWait>[0]) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await navigateAndWait(page, COURSE_URL)
}

/** Seed notes into IndexedDB for the operative-six course. */
async function seedNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ElearningDB')
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('notes')) {
          db.close()
          reject(new Error('notes store not found'))
          return
        }
        const tx = db.transaction('notes', 'readwrite')
        const store = tx.objectStore('notes')

        const notes = [
          {
            id: 'test-note-1',
            courseId: 'operative-six',
            videoId: 'op6-introduction',
            content: '<p>Introduction notes about the operative training program.</p>',
            timestamp: 30,
            createdAt: '2026-02-20T10:00:00.000Z',
            updatedAt: new Date().toISOString(),
            tags: ['overview', 'training'],
          },
          {
            id: 'test-note-2',
            courseId: 'operative-six',
            videoId: 'op6-pillars-of-influence',
            content: '<p>Key takeaways from the pillars of influence lesson.</p>',
            timestamp: 120,
            createdAt: '2026-02-21T14:30:00.000Z',
            updatedAt: '2026-02-22T09:00:00.000Z',
            tags: ['influence', 'psychology'],
          },
        ]

        for (const note of notes) {
          store.put(note)
        }

        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      request.onerror = () => reject(request.error)
    })
  })
}

/** Clear all notes from IndexedDB. */
async function clearNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ElearningDB')
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('notes')) {
          db.close()
          resolve()
          return
        }
        const tx = db.transaction('notes', 'readwrite')
        tx.objectStore('notes').clear()
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      request.onerror = () => reject(request.error)
    })
  })
}

test.describe('AC1: Notes tab with grouped notes', () => {
  test('shows Notes tab on CourseDetail page', async ({ page }) => {
    await goToCourseDetail(page)
    await seedNotes(page)
    await page.reload()

    // Notes tab should be visible
    const notesTab = page.getByRole('tab', { name: /notes/i })
    await expect(notesTab).toBeVisible()
  })

  test('displays notes grouped by video when Notes tab is clicked', async ({ page }) => {
    await goToCourseDetail(page)
    await seedNotes(page)
    await page.reload()

    // Click Notes tab
    await page.getByRole('tab', { name: /notes/i }).click()

    // Scope to the notes tab panel to avoid matching sidebar/header elements
    const notesPanel = page.getByRole('tabpanel')

    // Lesson titles as grouping headers
    await expect(notesPanel.getByRole('heading', { name: /introduction/i })).toBeVisible()
    await expect(notesPanel.getByText('Introduction notes about the operative training program')).toBeVisible()
    await expect(notesPanel.getByRole('heading', { name: /pillars of influence/i })).toBeVisible()
    await expect(notesPanel.getByText('Key takeaways from the pillars of influence lesson')).toBeVisible()
  })

  test('shows preview snippet, tags, and last updated date', async ({ page }) => {
    await goToCourseDetail(page)
    await seedNotes(page)
    await page.reload()

    await page.getByRole('tab', { name: /notes/i }).click()
    const notesPanel = page.getByRole('tabpanel')

    // Tags should be visible (scoped to notes panel to avoid sidebar "Overview" link)
    await expect(notesPanel.getByText('overview', { exact: true })).toBeVisible()
    await expect(notesPanel.getByText('training', { exact: true })).toBeVisible()

    // Timestamp link should be visible (0:30 for 30 seconds)
    await expect(notesPanel.getByText('0:30')).toBeVisible()

    // Last updated date should be visible (note 1 updatedAt is set to today)
    await expect(notesPanel.getByText('Today').first()).toBeVisible()
  })

  test('sort controls allow switching between video order and date created', async ({ page }) => {
    await goToCourseDetail(page)
    await seedNotes(page)
    await page.reload()

    await page.getByRole('tab', { name: /notes/i }).click()
    const notesPanel = page.getByRole('tabpanel')

    // Sort button should be present showing "Video Order" initially
    const sortButton = page.getByRole('button', { name: /sort/i })
    await expect(sortButton).toBeVisible()
    await expect(sortButton).toContainText('Video Order')

    // Lesson headings should be visible in video order mode
    await expect(notesPanel.getByRole('heading', { name: /introduction/i })).toBeVisible()

    // Click sort button to switch to date-created mode
    await sortButton.click()
    await expect(sortButton).toContainText('Date Created')

    // Lesson headings should disappear (flat list sorted by date)
    await expect(notesPanel.getByRole('heading', { name: /introduction/i })).not.toBeVisible()
  })
})

test.describe('AC2: Note detail, inline edit, and delete', () => {
  test('clicking a note expands to show full content', async ({ page }) => {
    await goToCourseDetail(page)
    await seedNotes(page)
    await page.reload()

    await page.getByRole('tab', { name: /notes/i }).click()
    const notesPanel = page.getByRole('tabpanel')

    // Click on the first note to expand
    await notesPanel.getByText('Introduction notes about the operative training program').click()

    // Full content should render in a Tiptap read-only viewer (ProseMirror)
    await expect(
      notesPanel.locator('.ProseMirror').filter({ hasText: 'Introduction notes about the operative training program' }),
    ).toBeVisible()

    // Edit and delete buttons should be visible in expanded view
    await expect(notesPanel.getByRole('button', { name: /edit/i })).toBeVisible()
    await expect(notesPanel.getByTestId('delete-note-button')).toBeVisible()
  })

  test('expanded note can be edited inline', async ({ page }) => {
    await goToCourseDetail(page)
    await seedNotes(page)
    await page.reload()

    await page.getByRole('tab', { name: /notes/i }).click()
    const notesPanel = page.getByRole('tabpanel')

    // Expand note
    await notesPanel.getByText('Introduction notes about the operative training program').click()

    // Click edit (scoped to notes panel)
    await notesPanel.getByRole('button', { name: /edit/i }).click()

    // NoteEditor should appear
    await expect(notesPanel.getByTestId('note-editor')).toBeVisible()
  })

  test('timestamp link navigates to lesson with time parameter', async ({ page }) => {
    await goToCourseDetail(page)
    await seedNotes(page)
    await page.reload()

    await page.getByRole('tab', { name: /notes/i }).click()

    // Click timestamp link (0:30 for 30 seconds)
    await page.getByText('0:30').click()

    // URL should contain the lesson path and timestamp parameter
    await expect(page).toHaveURL(/op6-introduction/)
    await expect(page).toHaveURL(/t=30/)
  })

  test('cancel-delete dismisses dialog without deleting', async ({ page }) => {
    await goToCourseDetail(page)
    await seedNotes(page)
    await page.reload()

    await page.getByRole('tab', { name: /notes/i }).click()
    const notesPanel = page.getByRole('tabpanel')

    // Expand note and click delete
    await notesPanel.getByText('Introduction notes about the operative training program').click()
    await notesPanel.getByTestId('delete-note-button').click()

    // Cancel in confirmation dialog
    await page.getByRole('alertdialog').getByRole('button', { name: /cancel/i }).click()

    // Dialog should close and note should still be visible
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    await expect(notesPanel.getByText('Introduction notes about the operative training program').first()).toBeVisible()
  })

  test('note can be deleted with confirmation dialog', async ({ page }) => {
    await goToCourseDetail(page)
    await seedNotes(page)
    await page.reload()

    await page.getByRole('tab', { name: /notes/i }).click()
    const notesPanel = page.getByRole('tabpanel')

    // Expand note first (delete button is in expanded view)
    await notesPanel.getByText('Introduction notes about the operative training program').click()

    // Click delete button
    await notesPanel.getByTestId('delete-note-button').click()

    // Confirmation dialog should appear (NFR23)
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByText(/delete this note/i)).toBeVisible()

    // Confirm deletion
    await page.getByRole('alertdialog').getByRole('button', { name: /delete/i }).click()

    // Note should be removed from the list
    await expect(notesPanel.getByText('Introduction notes about the operative training program')).not.toBeVisible()
  })
})

test.describe('AC3: Empty state', () => {
  test('shows empty state when course has no notes', async ({ page }) => {
    await goToCourseDetail(page)
    await clearNotes(page)
    await page.reload()

    await page.getByRole('tab', { name: /notes/i }).click()

    await expect(
      page.getByText('No notes yet. Start taking notes while watching videos.'),
    ).toBeVisible()
  })
})
