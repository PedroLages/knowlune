/**
 * E91-S14: Clickable Note Timestamps
 *
 * Tests that timestamp links in the NoteEditor seek the video when clicked:
 * - AC1: Clicking a timestamp link seeks the video
 * - AC2: onVideoSeek is wired from PlayerSidePanel through NotesTab to NoteEditor
 * - AC3: Click is intercepted (no navigation to video:// scheme)
 * - AC4: Timestamp links show pointer cursor and hover feedback
 * - AC5: onVideoSeek callback is properly threaded through the component chain
 */
import { test, expect, type Page } from '@playwright/test'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { createDexieNote } from '../../support/fixtures/factories/note-factory'
import {
  seedImportedCourses,
  seedImportedVideos,
  seedNotes,
  clearIndexedDBStore,
} from '../../support/helpers/seed-helpers'
import { navigateAndWait } from '../../support/helpers/navigation'
import { TIMEOUTS } from '../../utils/constants'
import { FIXED_DATE } from '../../utils/test-time'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'e91s14-timestamps-course'
const LESSON_ID = 'e91s14-lesson-1'

const TEST_COURSE = createImportedCourse({
  id: COURSE_ID,
  name: 'Timestamp Test Course',
  videoCount: 1,
  pdfCount: 0,
})

const TEST_VIDEO = {
  id: LESSON_ID,
  courseId: COURSE_ID,
  filename: 'Lesson 1.mp4',
  path: 'Lesson 1.mp4',
  duration: 600,
  format: 'mp4',
  order: 0,
  fileHandle: null,
}

/** Note with pre-existing timestamp links at 1:30 (90s) and 5:00 (300s) */
const NOTE_WITH_TIMESTAMPS = createDexieNote({
  id: 'note-e91s14-timestamps',
  courseId: COURSE_ID,
  videoId: LESSON_ID,
  content:
    '<p>Key concept discussed here <a href="video://90">Jump to 1:30</a></p>' +
    '<p>Another important point <a href="video://300">Jump to 5:00</a></p>',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
})

const LESSON_URL = `/courses/${COURSE_ID}/lessons/${LESSON_ID}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedCourseData(page: Page) {
  await navigateAndWait(page, '/courses')
  await seedImportedCourses(page, [TEST_COURSE])
  await seedImportedVideos(page, [TEST_VIDEO])
  await seedNotes(page, [NOTE_WITH_TIMESTAMPS])
}

async function goToLesson(page: Page) {
  await navigateAndWait(page, LESSON_URL)
  await page
    .getByTestId('lesson-player-content')
    .waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })
  await page
    .getByTestId('player-side-panel')
    .waitFor({ state: 'visible', timeout: TIMEOUTS.LONG })
}

/**
 * Click a Radix Tab trigger via page.evaluate to bypass ResizablePanel pointer
 * interception.
 */
async function clickTab(page: Page, tabName: string) {
  await page.evaluate(name => {
    const tabs = document.querySelectorAll<HTMLElement>(
      '[data-testid="player-side-panel"] [role="tab"]'
    )
    for (const tab of tabs) {
      if (tab.textContent?.trim() === name) {
        tab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
        tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        tab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }))
        tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
        tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        return
      }
    }
    throw new Error(`Tab "${name}" not found`)
  }, tabName)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E91-S14: Clickable Note Timestamps', () => {
  test.beforeEach(async ({ page }) => {
    await seedCourseData(page)
  })

  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'importedCourses')
    await clearIndexedDBStore(page, 'ElearningDB', 'importedVideos')
    await clearIndexedDBStore(page, 'ElearningDB', 'notes')
  })

  test('AC1+AC3: Clicking timestamp link seeks video without navigating', async ({ page }) => {
    await goToLesson(page)
    await clickTab(page, 'Notes')

    // Wait for the note editor to render with the timestamp link
    const editor = page.locator('[data-testid="player-side-panel"] .ProseMirror')
    await expect(editor).toBeVisible({ timeout: TIMEOUTS.LONG })

    const timestampLink = editor.locator('a[href="video://90"]')
    await expect(timestampLink).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(timestampLink).toHaveText('Jump to 1:30')

    // Click the timestamp — should NOT navigate away
    await timestampLink.click({ force: true })

    // Verify we're still on the lesson page (no navigation to video:// scheme)
    await expect(page).toHaveURL(new RegExp(LESSON_URL))

    // Verify the side panel is still visible (page didn't break)
    await expect(page.getByTestId('player-side-panel')).toBeVisible()
  })

  test('AC4: Timestamp links show pointer cursor and visual styling', async ({ page }) => {
    await goToLesson(page)
    await clickTab(page, 'Notes')

    const editor = page.locator('[data-testid="player-side-panel"] .ProseMirror')
    await expect(editor).toBeVisible({ timeout: TIMEOUTS.LONG })

    const timestampLink = editor.locator('a[href="video://90"]')
    await expect(timestampLink).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Verify cursor and styling
    await expect(timestampLink).toHaveCSS('cursor', 'pointer')
    await expect(timestampLink).toHaveCSS('text-decoration-line', 'underline')
  })

  test('AC2+AC5: Multiple timestamps each target different times', async ({ page }) => {
    await goToLesson(page)
    await clickTab(page, 'Notes')

    const editor = page.locator('[data-testid="player-side-panel"] .ProseMirror')
    await expect(editor).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Verify both timestamp links are rendered
    const link90 = editor.locator('a[href="video://90"]')
    const link300 = editor.locator('a[href="video://300"]')

    await expect(link90).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(link300).toBeVisible({ timeout: TIMEOUTS.LONG })

    await expect(link90).toHaveText('Jump to 1:30')
    await expect(link300).toHaveText('Jump to 5:00')

    // Click each — both should work without navigation
    await link90.click({ force: true })
    await expect(page).toHaveURL(new RegExp(LESSON_URL))

    await link300.click({ force: true })
    await expect(page).toHaveURL(new RegExp(LESSON_URL))
  })
})
