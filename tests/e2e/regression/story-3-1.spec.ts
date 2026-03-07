/**
 * Story 3.1: Markdown Note Editor with Autosave — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: WYSIWYG editor renders with toolbar (bold, italic, lists, headings)
 *   - AC2: Autosave indicator appears after typing (3s debounce, fades after 2s)
 *   - AC3: Existing note persists across navigation
 *   - AC4: Add Timestamp button inserts video link
 *
 * Data seeding:
 *   - Uses static course operative-six with lesson op6-introduction
 *   - Sidebar seeded closed to prevent overlay blocking
 *
 * Reference: TEA knowledge base - test-quality.md, selector-resilience.md
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const LESSON_URL = '/courses/operative-six/op6-introduction'

/** Navigate to lesson and open Notes tab, with sidebar closed. */
async function goToLessonNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await navigateAndWait(page, LESSON_URL)
  await page.getByRole('tab', { name: 'Notes' }).click()
}

// ===========================================================================
// AC1: WYSIWYG editor renders with toolbar
// ===========================================================================

test.describe('AC1: WYSIWYG editor renders with toolbar', () => {
  test('should display Tiptap editor container', async ({ page }) => {
    await goToLessonNotes(page)

    // THEN: Editor container is visible
    await expect(page.getByTestId('note-editor')).toBeVisible()
  })

  test('should show formatting toolbar buttons', async ({ page }) => {
    await goToLessonNotes(page)

    // THEN: Toolbar is visible with formatting buttons
    const toolbar = page.getByTestId('note-editor-toolbar')
    await expect(toolbar).toBeVisible()

    // Core formatting buttons exist
    await expect(toolbar.getByRole('button', { name: /bold/i })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: /italic/i })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: /bullet list/i })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: /ordered list/i })).toBeVisible()
  })

  test('should NOT have Edit/Preview tab switcher', async ({ page }) => {
    await goToLessonNotes(page)

    // THEN: No Edit/Preview tabs within the note editor
    const editor = page.getByTestId('note-editor')
    await expect(editor.getByRole('tab', { name: 'Edit' })).not.toBeVisible()
    await expect(editor.getByRole('tab', { name: 'Preview' })).not.toBeVisible()
  })
})

// ===========================================================================
// AC2: Autosave indicator appears after typing
// ===========================================================================

test.describe('AC2: Autosave indicator after typing', () => {
  test('should show "Saved" indicator after 3s debounce', async ({ page }) => {
    await goToLessonNotes(page)

    // WHEN: User types in the editor
    const editor = page.getByTestId('note-editor').locator('[contenteditable]')
    await editor.click()
    await editor.pressSequentially('Autosave test content')

    // THEN: After ~3.5s, autosave indicator shows "Saved"
    const indicator = page.getByTestId('note-autosave-indicator')
    await expect(indicator).toContainText('Saved', { timeout: 5000 })
  })

  test('should fade out autosave indicator after 2s', async ({ page }) => {
    await goToLessonNotes(page)

    // WHEN: User types and waits for save
    const editor = page.getByTestId('note-editor').locator('[contenteditable]')
    await editor.click()
    await editor.pressSequentially('Fade test')

    // Wait for "Saved" to appear
    const indicator = page.getByTestId('note-autosave-indicator')
    await expect(indicator).toContainText('Saved', { timeout: 5000 })

    // THEN: After ~2s more, indicator should become hidden
    await expect(indicator).toBeHidden({ timeout: 4000 })
  })
})

// ===========================================================================
// AC3: Existing note persists across navigation
// ===========================================================================

test.describe('AC3: Note persistence across navigation', () => {
  test('should preserve note content after navigating away and back', async ({ page }) => {
    await goToLessonNotes(page)

    // WHEN: User types a note
    const editor = page.getByTestId('note-editor').locator('[contenteditable]')
    await editor.click()
    await editor.pressSequentially('Persistent note content')

    // Wait for autosave
    const indicator = page.getByTestId('note-autosave-indicator')
    await expect(indicator).toContainText('Saved', { timeout: 5000 })

    // Navigate away
    await navigateAndWait(page, '/courses')

    // Navigate back to the same lesson and open Notes tab
    await navigateAndWait(page, LESSON_URL)
    await page.getByRole('tab', { name: 'Notes' }).click()

    // THEN: Previously typed content is still present
    const restoredEditor = page.getByTestId('note-editor').locator('[contenteditable]')
    await expect(restoredEditor).toContainText('Persistent note content')
  })
})

// ===========================================================================
// AC4: Add Timestamp button inserts video link
// ===========================================================================

test.describe('AC4: Add Timestamp inserts link', () => {
  test('should have Add Timestamp button in toolbar', async ({ page }) => {
    await goToLessonNotes(page)

    // THEN: Add Timestamp button is visible in editor toolbar
    const toolbar = page.getByTestId('note-editor-toolbar')
    await expect(toolbar.getByRole('button', { name: /add timestamp/i })).toBeVisible()
  })

  test('should insert timestamp link when clicked', async ({ page }) => {
    await goToLessonNotes(page)

    // WHEN: User clicks Add Timestamp
    const toolbar = page.getByTestId('note-editor-toolbar')
    await toolbar.getByRole('button', { name: /add timestamp/i }).click()

    // THEN: Editor content contains a timestamp link (e.g., "Jump to 0:00")
    const editor = page.getByTestId('note-editor').locator('[contenteditable]')
    await expect(editor).toContainText(/Jump to \d+:\d{2}/)
  })

  test('should seek video when timestamp link is clicked', async ({ page }) => {
    await goToLessonNotes(page)

    // WHEN: User inserts a timestamp and clicks the link
    const toolbar = page.getByTestId('note-editor-toolbar')
    await toolbar.getByRole('button', { name: /add timestamp/i }).click()

    // Click the inserted timestamp link
    const editor = page.getByTestId('note-editor').locator('[contenteditable]')
    const timestampLink = editor.locator('a[href^="video://"]')
    await expect(timestampLink).toBeVisible()
    await timestampLink.click()

    // THEN: Video player should still be visible (seek doesn't break anything)
    const videoPlayer = page.getByTestId('video-player-container')
    await expect(videoPlayer).toBeVisible()
  })
})
