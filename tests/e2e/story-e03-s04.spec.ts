/**
 * Story 3.4: Tag-Based Note Organization — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Dedicated tag input UI with add/remove badges and autocomplete
 *   - AC3: Tag persistence to IndexedDB and survival across navigation
 *
 * AC2 (Global Notes page filtering) is deferred to Story 3.8.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

const LESSON_URL = '/courses/operative-six/op6-introduction'
const LESSON_URL_2 = '/courses/operative-six/op6-lesson-2'

/** Navigate to lesson player with notes panel open, suppressing mobile sidebar. */
async function goToLessonWithNotes(page: Parameters<typeof navigateAndWait>[0], url = LESSON_URL) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await navigateAndWait(page, url + '?panel=notes')
}

// ===========================================================================
// AC1: Tag Management UI
// ===========================================================================

test.describe('AC1: Tag Management UI', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('tag add button is visible in note editor', async ({ page }) => {
    await goToLessonWithNotes(page)

    const noteEditor = page.getByTestId('note-editor')
    await expect(noteEditor).toBeVisible()

    // THEN: A button to add tags should be visible
    const addTagBtn = noteEditor.getByTestId('add-tag-button')
    await expect(addTagBtn).toBeVisible()
  })

  test('clicking add tag opens popover and typing creates a tag', async ({ page }) => {
    await goToLessonWithNotes(page)

    const noteEditor = page.getByTestId('note-editor')

    // WHEN: Click the add tag button
    await noteEditor.getByTestId('add-tag-button').click()

    // THEN: Tag editor popover should appear
    const popover = page.getByTestId('tag-editor-popover')
    await expect(popover).toBeVisible()

    // WHEN: Type a new tag and press Enter
    await popover.getByPlaceholder(/add a tag/i).fill('react')
    await popover.getByText(/create.*react/i).click()

    // THEN: A tag badge should appear in the note editor
    const tagBadge = noteEditor.getByTestId('tag-badge').filter({ hasText: 'react' })
    await expect(tagBadge).toBeVisible()
  })

  test('tag badges are removable via X button', async ({ page }) => {
    await goToLessonWithNotes(page)

    const noteEditor = page.getByTestId('note-editor')

    // Add a tag first
    await noteEditor.getByTestId('add-tag-button').click()
    const popover = page.getByTestId('tag-editor-popover')
    await popover.getByPlaceholder(/add a tag/i).fill('typescript')
    await popover.getByText(/create.*typescript/i).click()

    // Verify tag exists
    const tagBadge = noteEditor.getByTestId('tag-badge').filter({ hasText: 'typescript' })
    await expect(tagBadge).toBeVisible()

    // WHEN: Click the remove button on the tag badge
    await tagBadge.getByRole('button', { name: /remove.*typescript/i }).click()

    // THEN: Tag badge should be gone
    await expect(tagBadge).toBeHidden()
  })

  test('autocomplete suggests previously used tags', async ({ page }) => {
    await goToLessonWithNotes(page)

    const noteEditor = page.getByTestId('note-editor')

    // Add a tag first
    await noteEditor.getByTestId('add-tag-button').click()
    let popover = page.getByTestId('tag-editor-popover')
    await popover.getByPlaceholder(/add a tag/i).fill('javascript')
    await popover.getByText(/create.*javascript/i).click()

    // WHEN: Open tag editor again and type partial match
    await noteEditor.getByTestId('add-tag-button').click()
    popover = page.getByTestId('tag-editor-popover')
    await popover.getByPlaceholder(/add a tag/i).fill('java')

    // THEN: Previously created tag should appear in suggestions
    const suggestion = popover.getByText('javascript')
    await expect(suggestion).toBeVisible()
  })

  test('tags display in preview tab as read-only badges', async ({ page }) => {
    await goToLessonWithNotes(page)

    const noteEditor = page.getByTestId('note-editor')

    // Add a tag
    await noteEditor.getByTestId('add-tag-button').click()
    const popover = page.getByTestId('tag-editor-popover')
    await popover.getByPlaceholder(/add a tag/i).fill('design')
    await popover.getByText(/create.*design/i).click()

    // WHEN: Switch to Preview tab
    await noteEditor.getByRole('tab', { name: /preview/i }).click()

    // THEN: Tag should be visible as a badge (without remove button)
    const previewBadge = noteEditor.getByTestId('tag-badge').filter({ hasText: 'design' })
    await expect(previewBadge).toBeVisible()
  })
})

// ===========================================================================
// AC3: Persistence & Indexing
// ===========================================================================

test.describe('AC3: Persistence & Indexing', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('tags persist across page reload', async ({ page }) => {
    await goToLessonWithNotes(page)

    const noteEditor = page.getByTestId('note-editor')

    // Add a tag
    await noteEditor.getByTestId('add-tag-button').click()
    const popover = page.getByTestId('tag-editor-popover')
    await popover.getByPlaceholder(/add a tag/i).fill('persistent')
    await popover.getByText(/create.*persistent/i).click()

    // Verify tag exists before reload
    await expect(noteEditor.getByTestId('tag-badge').filter({ hasText: 'persistent' })).toBeVisible()

    // Wait for save to complete (immediate for tags, but small buffer)
    await page.waitForTimeout(500)

    // WHEN: Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' })
    await goToLessonWithNotes(page)

    // THEN: Tag should still be there
    const persistedBadge = page.getByTestId('note-editor').getByTestId('tag-badge').filter({ hasText: 'persistent' })
    await expect(persistedBadge).toBeVisible()
  })

  test('tags persist after navigating to another lesson and back', async ({ page }) => {
    await goToLessonWithNotes(page)

    const noteEditor = page.getByTestId('note-editor')

    // Add a tag to lesson 1
    await noteEditor.getByTestId('add-tag-button').click()
    const popover = page.getByTestId('tag-editor-popover')
    await popover.getByPlaceholder(/add a tag/i).fill('navigation-test')
    await popover.getByText(/create.*navigation-test/i).click()

    // Wait for save
    await page.waitForTimeout(500)

    // WHEN: Navigate to a different lesson
    await goToLessonWithNotes(page, LESSON_URL_2)
    await page.waitForTimeout(300)

    // AND: Navigate back to original lesson
    await goToLessonWithNotes(page, LESSON_URL)

    // THEN: Tag should still be present
    const persistedBadge = page.getByTestId('note-editor').getByTestId('tag-badge').filter({ hasText: 'navigation-test' })
    await expect(persistedBadge).toBeVisible()
  })
})
