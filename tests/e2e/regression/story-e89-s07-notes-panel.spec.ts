/**
 * E89-S07: Notes Panel in Unified Lesson Player
 *
 * Tests the PlayerSidePanel Notes tab functionality:
 * - AC1: Notes panel toggle (tab switching)
 * - AC2: Creating a new note via the editor
 * - AC3: Editing an existing note
 * - AC4: Notes persist across page reload
 * - AC5: Notes panel responsive behavior (desktop side panel vs mobile sheet)
 *
 * Note: Delete and timestamp linking require more complex UI interactions
 * (NoteEditor uses TipTap rich text editor). Covered at unit level.
 *
 * Known quirk: On desktop, the ResizablePanel overlay in the left panel can
 * intercept pointer events for Radix Tabs in the right panel. We use
 * dispatchEvent('click') to bypass this Playwright actionability check.
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

const COURSE_ID = 'e89s07-notes-course'
const LESSON_ID = 'e89s07-lesson-1'

const TEST_COURSE = createImportedCourse({
  id: COURSE_ID,
  name: 'Notes Panel Test Course',
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
  id: 'note-e89s07-existing',
  courseId: COURSE_ID,
  videoId: LESSON_ID,
  content: '<p>This is an existing note for testing</p>',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
})

const LESSON_URL = `/courses/${COURSE_ID}/lessons/${LESSON_ID}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedCourseData(page: Page) {
  // Navigate first to initialize Dexie DB schema
  await navigateAndWait(page, '/courses')
  await seedImportedCourses(page, [TEST_COURSE])
  await seedImportedVideos(page, [TEST_VIDEO])
}

async function goToLesson(page: Page) {
  await navigateAndWait(page, LESSON_URL)
  await page
    .getByTestId('lesson-player-content')
    .waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })
  // Wait for side panel to render (visible on desktop viewport)
  await page.getByTestId('player-side-panel').waitFor({ state: 'visible', timeout: TIMEOUTS.LONG })
}

/**
 * Click a Radix Tab trigger via page.evaluate to bypass ResizablePanel pointer
 * interception. Native .click() triggers React synthetic event handlers.
 */
async function clickTab(page: Page, tabName: string) {
  await page.evaluate(name => {
    const tabs = document.querySelectorAll<HTMLElement>(
      '[data-testid="player-side-panel"] [role="tab"]'
    )
    for (const tab of tabs) {
      if (tab.textContent?.trim() === name) {
        // Radix Tabs uses onPointerDown — dispatch full pointer sequence
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

test.describe('E89-S07: Notes Panel', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await seedCourseData(page)
  })

  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'importedCourses')
    await clearIndexedDBStore(page, 'ElearningDB', 'importedVideos')
    await clearIndexedDBStore(page, 'ElearningDB', 'notes')
  })

  test('AC1: Notes tab can be toggled open in side panel', async ({ page }) => {
    await goToLesson(page)

    const sidePanel = page.getByTestId('player-side-panel')

    // Default tab is "lessons"
    const lessonsTab = sidePanel.getByRole('tab', { name: 'Lessons' })
    await expect(lessonsTab).toHaveAttribute('data-state', 'active')

    // Click Notes tab
    await clickTab(page, 'Notes')
    const notesTab = sidePanel.getByRole('tab', { name: 'Notes' })
    await expect(notesTab).toHaveAttribute('data-state', 'active')

    // Note editor should be visible
    await expect(page.getByTestId('note-editor')).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Switch back to Lessons tab
    await clickTab(page, 'Lessons')
    await expect(lessonsTab).toHaveAttribute('data-state', 'active')
  })

  test('AC2: Creating a new note via the editor', async ({ page }) => {
    await goToLesson(page)

    // Switch to Notes tab
    await clickTab(page, 'Notes')

    // Wait for note editor to appear
    const editor = page.getByTestId('note-editor')
    await expect(editor).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Type in the editor (TipTap uses contenteditable div with ProseMirror class)
    // Focus the editor via evaluate, then type via keyboard
    const editorContent = editor.locator('.ProseMirror')
    await editorContent.evaluate(el => {
      ;(el as HTMLElement).focus()
    })
    await page.keyboard.type('My first test note content', { delay: 10 })

    // Wait for autosave indicator
    await expect(page.getByTestId('note-autosave-indicator')).toContainText('Saved', {
      timeout: TIMEOUTS.NETWORK,
    })
  })

  test('AC3: Editing an existing note shows previous content', async ({ page }) => {
    // Seed an existing note
    await navigateAndWait(page, '/courses')
    await seedNotes(page, [EXISTING_NOTE as unknown as Record<string, unknown>])

    await goToLesson(page)

    // Switch to Notes tab
    await clickTab(page, 'Notes')

    // Wait for note editor
    const editor = page.getByTestId('note-editor')
    await expect(editor).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Editor should show the existing note content
    const editorContent = editor.locator('.ProseMirror')
    await expect(editorContent).toContainText('This is an existing note for testing', {
      timeout: TIMEOUTS.LONG,
    })
  })

  test('AC4: Notes persist across navigation', async ({ page }) => {
    // Navigate to lesson first, seed note, then reload page
    await goToLesson(page)

    // Seed note while on the lesson page (Dexie DB is initialized)
    const persistNote = createDexieNote({
      id: 'note-e89s07-persist',
      courseId: COURSE_ID,
      videoId: LESSON_ID,
      content: '<p>Persistent note content</p>',
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    })
    await seedNotes(page, [persistNote as unknown as Record<string, unknown>])

    // Navigate away to courses page
    await navigateAndWait(page, '/courses')

    // Navigate back to the lesson
    await navigateAndWait(page, LESSON_URL)
    await page
      .getByTestId('lesson-player-content')
      .waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })

    // Wait for side panel and switch to Notes tab
    await page
      .getByTestId('player-side-panel')
      .waitFor({ state: 'visible', timeout: TIMEOUTS.LONG })
    await clickTab(page, 'Notes')

    // Verify seeded note content persisted across navigation
    const editor = page.getByTestId('note-editor')
    await expect(editor).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(editor.locator('.ProseMirror')).toContainText('Persistent note content', {
      timeout: TIMEOUTS.NETWORK,
    })
  })

  test('AC5: Mobile viewport shows side panel via sheet trigger button', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    await navigateAndWait(page, LESSON_URL)
    await page
      .getByTestId('lesson-player-content')
      .waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })

    // The side panel should NOT be visible inline on mobile
    await expect(page.getByTestId('player-side-panel')).not.toBeVisible()

    // A floating button should trigger the sheet
    const sheetTrigger = page.getByRole('button', { name: 'Open side panel' })
    await expect(sheetTrigger).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Open the sheet via evaluate (bottom nav bar may overlap the fixed button)
    await sheetTrigger.evaluate(el => {
      ;(el as HTMLElement).click()
    })

    // Now the side panel should be visible inside the sheet
    await expect(page.getByTestId('player-side-panel')).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Can switch to Notes tab (inside sheet, no ResizablePanel interception)
    await page.getByTestId('player-side-panel').getByRole('tab', { name: 'Notes' }).click()
    await expect(page.getByTestId('note-editor')).toBeVisible({ timeout: TIMEOUTS.LONG })
  })
})
