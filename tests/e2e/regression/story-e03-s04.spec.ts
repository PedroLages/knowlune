/**
 * Story 3.4: Tag-Based Note Organization — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Dedicated tag input UI with add/remove badges and autocomplete
 *   - AC3: Tag persistence to IndexedDB and survival across navigation
 *
 * AC2 (Global Notes page filtering) is deferred to Story 3.8.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { TIMEOUTS } from '../../utils/constants'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

const LESSON_URL = '/courses/operative-six/op6-introduction'
const LESSON_URL_2 = '/courses/operative-six/op6-pillars-of-influence'

/** Navigate to lesson player with notes panel open, suppressing mobile sidebar. */
async function goToLessonWithNotes(page: Parameters<typeof navigateAndWait>[0], url = LESSON_URL) {
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  await navigateAndWait(page, url + '?panel=notes')
  // Wait for NoteEditor to be fully rendered (handles slow dev server under parallel load)
  await page.getByTestId('note-editor').waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD })
}

/** Add a tag via the TagEditor popover. */
async function addTag(page: Parameters<typeof navigateAndWait>[0], tagName: string) {
  const noteEditor = page.getByTestId('note-editor')
  await noteEditor.getByTestId('add-tag-button').click()
  const popover = page.getByTestId('tag-editor-popover')
  await expect(popover).toBeVisible()
  await popover.getByPlaceholder(/add a tag/i).fill(tagName)
  await popover.getByText(new RegExp(`create.*${tagName}`, 'i')).click()
  // Wait for tag badge to appear (confirms state + save completed)
  await expect(noteEditor.getByTestId('tag-badge').filter({ hasText: tagName })).toBeVisible()
}

/** Wait for a tag to be persisted to IndexedDB. */
async function waitForTagInDB(page: Parameters<typeof navigateAndWait>[0], tagName: string) {
  await page.waitForFunction(
    tag => {
      return new Promise<boolean>(resolve => {
        const request = indexedDB.open('ElearningDB')
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('notes')) {
            db.close()
            resolve(false)
            return
          }
          const tx = db.transaction('notes', 'readonly')
          const store = tx.objectStore('notes')
          const getAll = store.getAll()
          getAll.onsuccess = () => {
            const notes = getAll.result as Array<{ tags: string[] }>
            const found = notes.some(n => n.tags.includes(tag))
            db.close()
            resolve(found)
          }
          getAll.onerror = () => {
            db.close()
            resolve(false)
          }
        }
        request.onerror = () => resolve(false)
      })
    },
    tagName,
    { timeout: TIMEOUTS.LONG }
  )
}

// ===========================================================================
// AC1: Tag Management UI
// ===========================================================================

test.describe('AC1: Tag Management UI', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page, indexedDB }) => {
    // Clear notes between tests for isolation
    await goToLessonWithNotes(page)
    await indexedDB.clearStore('notes')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('note-editor').waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD })
  })

  test('tag add button is visible in note editor', async ({ page }) => {
    const noteEditor = page.getByTestId('note-editor')
    await expect(noteEditor).toBeVisible()

    // THEN: A button to add tags should be visible
    const addTagBtn = noteEditor.getByTestId('add-tag-button')
    await expect(addTagBtn).toBeVisible()
  })

  test('clicking add tag opens popover and typing creates a tag', async ({ page }) => {
    const noteEditor = page.getByTestId('note-editor')

    // WHEN: Click the add tag button
    await noteEditor.getByTestId('add-tag-button').click()

    // THEN: Tag editor popover should appear
    const popover = page.getByTestId('tag-editor-popover')
    await expect(popover).toBeVisible()

    // WHEN: Type a new tag and click Create
    await popover.getByPlaceholder(/add a tag/i).fill('react')
    await popover.getByText(/create.*react/i).click()

    // THEN: A tag badge should appear in the note editor
    const tagBadge = noteEditor.getByTestId('tag-badge').filter({ hasText: 'react' })
    await expect(tagBadge).toBeVisible()
  })

  test('comma key creates a tag', async ({ page }) => {
    const noteEditor = page.getByTestId('note-editor')

    // WHEN: Open tag editor and type a tag followed by comma
    await noteEditor.getByTestId('add-tag-button').click()
    const popover = page.getByTestId('tag-editor-popover')
    await popover.getByPlaceholder(/add a tag/i).fill('hooks')
    await popover.getByPlaceholder(/add a tag/i).press(',')

    // THEN: A tag badge should appear
    await expect(noteEditor.getByTestId('tag-badge').filter({ hasText: 'hooks' })).toBeVisible()
  })

  test('tag badges are removable via X button', async ({ page }) => {
    // Add a tag
    await addTag(page, 'typescript')

    const noteEditor = page.getByTestId('note-editor')
    const tagBadge = noteEditor.getByTestId('tag-badge').filter({ hasText: 'typescript' })

    // WHEN: Click the remove button on the tag badge
    await tagBadge.getByRole('button', { name: /remove.*typescript/i }).click()

    // THEN: Tag badge should be gone
    await expect(tagBadge).toBeHidden()
  })

  test('autocomplete suggests previously used tags from other notes', async ({ page }) => {
    // Add a tag on lesson 1
    await addTag(page, 'javascript')

    // Wait for tag to persist to IndexedDB
    await waitForTagInDB(page, 'javascript')

    // WHEN: Navigate to lesson 2 and open tag editor
    await goToLessonWithNotes(page, LESSON_URL_2)

    const noteEditor = page.getByTestId('note-editor')
    await noteEditor.getByTestId('add-tag-button').click()
    const popover = page.getByTestId('tag-editor-popover')
    await popover.getByPlaceholder(/add a tag/i).fill('java')

    // THEN: Tag from lesson 1 should appear in suggestions (cross-note autocomplete)
    const suggestion = popover.getByText('javascript')
    await expect(suggestion).toBeVisible()
  })

  test('tags display in preview tab as badges', async ({ page }) => {
    // Add a tag
    await addTag(page, 'design')

    const noteEditor = page.getByTestId('note-editor')

    // Type some content so preview has something to show
    await noteEditor.getByRole('textbox', { name: /notes editor/i }).fill('Some note content')

    // WHEN: Switch to Preview tab
    await noteEditor.getByRole('tab', { name: /preview/i }).click()

    // THEN: Tag should be visible as a badge
    const previewBadge = noteEditor.getByTestId('tag-badge').filter({ hasText: 'design' })
    await expect(previewBadge).toBeVisible()
  })
})

// ===========================================================================
// AC3: Persistence & Indexing
// ===========================================================================

test.describe('AC3: Persistence & Indexing', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page, indexedDB }) => {
    // Clear notes between tests for isolation
    await goToLessonWithNotes(page)
    await indexedDB.clearStore('notes')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('note-editor').waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD })
  })

  test('tags persist across page reload', async ({ page }) => {
    // Add a tag (addTag waits for badge to appear, confirming save)
    await addTag(page, 'persistent')

    // Wait for IndexedDB write to fully commit
    await waitForTagInDB(page, 'persistent')

    // WHEN: Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' })
    // Re-navigate to ensure notes panel is open
    await goToLessonWithNotes(page)

    // THEN: Tag should still be there
    const persistedBadge = page
      .getByTestId('note-editor')
      .getByTestId('tag-badge')
      .filter({ hasText: 'persistent' })
    await expect(persistedBadge).toBeVisible({ timeout: TIMEOUTS.MEDIA })
  })

  test('tags persist after navigating to another lesson and back', async ({ page }) => {
    // Add a tag to lesson 1
    await addTag(page, 'navigation-test')

    // Wait for IndexedDB write to fully commit
    await waitForTagInDB(page, 'navigation-test')

    // WHEN: Navigate to a different lesson
    await goToLessonWithNotes(page, LESSON_URL_2)

    // AND: Navigate back to original lesson
    await goToLessonWithNotes(page, LESSON_URL)

    // THEN: Tag should still be present
    const persistedBadge = page
      .getByTestId('note-editor')
      .getByTestId('tag-badge')
      .filter({ hasText: 'navigation-test' })
    await expect(persistedBadge).toBeVisible({ timeout: TIMEOUTS.MEDIA })
  })
})
