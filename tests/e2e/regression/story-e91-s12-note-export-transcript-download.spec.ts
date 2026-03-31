/**
 * E91-S12: Single-Note Export + Transcript Download
 *
 * Tests:
 * - AC1/AC6: Download button visible when note has content, disabled when empty
 * - AC2/AC3: Click Download triggers .md file download
 * - AC4/AC5: Transcript Download button visible and triggers .txt download
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

const COURSE_ID = 'e91s12-export-course'
const LESSON_ID = 'e91s12-lesson-1'

const TEST_COURSE = createImportedCourse({
  id: COURSE_ID,
  name: 'Export Test Course',
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

const EXISTING_NOTE = createDexieNote({
  id: 'note-e91s12-existing',
  courseId: COURSE_ID,
  videoId: LESSON_ID,
  content: '<h2>My Study Notes</h2><p>This is a test note with content.</p>',
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
}

async function goToLesson(page: Page) {
  await navigateAndWait(page, LESSON_URL)
  await page
    .getByTestId('lesson-player-content')
    .waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })
  await page.getByTestId('player-side-panel').waitFor({ state: 'visible', timeout: TIMEOUTS.LONG })
}

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

test.describe('E91-S12: Single-Note Export + Transcript Download', () => {
  test.beforeEach(async ({ page }) => {
    await seedCourseData(page)
  })

  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'importedCourses')
    await clearIndexedDBStore(page, 'ElearningDB', 'importedVideos')
    await clearIndexedDBStore(page, 'ElearningDB', 'notes')
  })

  test('AC1+AC6: Download button visible when note has content, disabled when empty', async ({
    page,
  }) => {
    await goToLesson(page)
    await clickTab(page, 'Notes')

    const editor = page.getByTestId('note-editor')
    await expect(editor).toBeVisible({ timeout: TIMEOUTS.LONG })

    // With empty editor, download button should be disabled
    const downloadBtn = page.getByRole('button', { name: 'Download note as Markdown' })
    await expect(downloadBtn).toBeVisible()
    await expect(downloadBtn).toBeDisabled()
  })

  test('AC2+AC3: Download note triggers .md file download', async ({ page }) => {
    // Seed a note with content
    await seedNotes(page, [EXISTING_NOTE])
    await goToLesson(page)
    await clickTab(page, 'Notes')

    const editor = page.getByTestId('note-editor')
    await expect(editor).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Wait for editor content to load
    await expect(async () => {
      const downloadBtn = page.getByRole('button', { name: 'Download note as Markdown' })
      await expect(downloadBtn).toBeEnabled()
    }).toPass({ timeout: TIMEOUTS.LONG })

    const downloadBtn = page.getByRole('button', { name: 'Download note as Markdown' })

    // Click and wait for download
    const [download] = await Promise.all([page.waitForEvent('download'), downloadBtn.click()])

    // Verify the downloaded file
    expect(download.suggestedFilename()).toMatch(/\.md$/)
  })

  // Skip reason: No seeding infrastructure exists for transcript cues (VTT/YouTube data).
  // IndexedDB seed helpers cover courses, progress, and sessions but not transcript cues.
  // Until a transcript cue seeding helper is added, this test cannot run deterministically.
  // Tracked in lessons learned below and in the story file.
  test('AC4+AC5: Download Transcript button triggers .txt download', async () => {
    test.skip(true, 'Transcript download requires seeded transcript cues — covered by manual QA')
  })
})
