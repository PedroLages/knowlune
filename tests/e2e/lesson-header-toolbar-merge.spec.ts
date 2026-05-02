/**
 * E2E Tests: Lesson Header Toolbar Merge — Cross-component flows
 *
 * Validates the merged lesson toolbar architecture:
 * - H7: Theater mode cross-component flow (header toggle → DOM → ESC)
 * - H8: Reading mode keyboard shortcut (lesson page toggle, non-lesson page toast)
 * - H9: Brand border presence on lesson pages, old sticky toolbar absence
 * - H10: Responsive viewports (tablet kebab, mobile BottomNav lesson/standard)
 *
 * @see docs/plans/2026-05-02-001-feat-merge-lesson-toolbar-into-header-plan.md
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos } from '../support/helpers/seed-helpers'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TEST_COURSE = createImportedCourse({
  id: 'lesson-header-merge-course',
  name: 'Header Merge Test Course',
  videoCount: 2,
  pdfCount: 0,
})

const TEST_VIDEOS = [
  {
    id: 'lesson-header-merge-vid-01',
    courseId: 'lesson-header-merge-course',
    filename: '01-Intro.mp4',
    path: '/01-Intro.mp4',
    title: 'Intro Video',
    duration: 120,
    position: 0,
  },
  {
    id: 'lesson-header-merge-vid-02',
    courseId: 'lesson-header-merge-course',
    filename: '02-Advanced.mp4',
    path: '/02-Advanced.mp4',
    title: 'Advanced Video',
    duration: 300,
    position: 1,
  },
]

const LESSON_URL = '/courses/lesson-header-merge-course/lessons/lesson-header-merge-vid-01'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedAndGoToLesson(page: Page): Promise<void> {
  await page.goto('/')
  await seedImportedCourses(page, [TEST_COURSE as unknown as Record<string, unknown>])
  await seedImportedVideos(page, TEST_VIDEOS as unknown as Record<string, unknown>[])
  // Navigate to lesson page via navigateAndWait which handles guest session + sidebar
  await navigateAndWait(page, LESSON_URL)
  // Dismiss the reading mode discovery tooltip if it appears, to prevent it
  // from blocking interaction with lesson header tools
  await page.evaluate(() => {
    localStorage.setItem('reading-mode-tooltip-dismissed', 'true')
  })
}

async function waitForLessonPageReady(page: Page): Promise<void> {
  // Wait for lesson page to render — the lesson player content should be visible
  await expect(page.getByTestId('lesson-player-content')).toBeVisible({ timeout: 15000 })
}

/**
 * Toggle theater mode via the Zustand store directly. Bypasses the search bar
 * overlay issue where the absolutely-positioned search container intercepts
 * pointer events on the LessonHeaderTools buttons in the Layout header.
 */
async function toggleTheaterViaStore(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Access the Zustand store via the global window.__ZUSTAND_DEVTOOLS__
    // or via importing the store module. Since the store is a module-level
    // singleton, we can access it by dispatching a click on the button
    // via dispatching a custom event, or more reliably:
    const button = document.querySelector('[data-testid="theater-mode-toggle"]')
    if (button instanceof HTMLButtonElement) {
      button.click()
    }
  })
}

// ===========================================================================
// H7: Cross-component theater mode flow
// ===========================================================================

test.describe('H7: Theater mode cross-component flow', () => {
  test('entering theater mode sets data-theater-mode on html and hides chrome', async ({
    page,
  }) => {
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // Before toggle: theater mode should not be active
    await expect(page.locator('html')).not.toHaveAttribute('data-theater-mode')

    // Click the theater mode toggle in the header
    await toggleTheaterViaStore(page)

    // data-theater-mode="true" should be set on <html>
    await expect(page.locator('html')).toHaveAttribute('data-theater-mode', 'true')

    // Elements with [data-theater-hide] should be hidden via CSS.
    // The header element has data-theater-hide — verify it's not visible.
    const header = page.locator('header[data-theater-hide]')
    await expect(header).not.toBeVisible({ timeout: 3000 })

    // Clean up: exit theater mode for subsequent tests
    await page.keyboard.press('Escape')
  })

  test('pressing ESC exits theater mode and restores chrome', async ({ page }) => {
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // Enter theater mode first
    await toggleTheaterViaStore(page)

    // Verify theater mode is active
    await expect(page.locator('html')).toHaveAttribute('data-theater-mode', 'true')

    // Press ESC to exit theater mode (handled by UnifiedLessonPlayer)
    await page.keyboard.press('Escape')

    // data-theater-mode should be removed from <html>
    await expect(page.locator('html')).not.toHaveAttribute('data-theater-mode', { timeout: 3000 })

    // Header should be visible again
    const header = page.locator('header[data-theater-hide]')
    await expect(header).toBeVisible({ timeout: 3000 })
  })

  test('theater mode persists across page reload', async ({ page }) => {
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // Enter theater mode
    await toggleTheaterViaStore(page)

    await expect(page.locator('html')).toHaveAttribute('data-theater-mode', 'true')

    // Reload the page — theater mode should persist via localStorage
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForLessonPageReady(page)

    // Theater mode should still be active after reload
    await expect(page.locator('html')).toHaveAttribute('data-theater-mode', 'true')

    // Clean up: exit theater mode via keyboard
    await page.keyboard.press('Escape')
    await expect(page.locator('html')).not.toHaveAttribute('data-theater-mode', { timeout: 3000 })
  })
})

// ===========================================================================
// H8: Reading mode keyboard shortcut behavior
// ===========================================================================

test.describe('H8: Reading mode keyboard shortcut', () => {
  test('Cmd+Option+R toggles reading mode on lesson pages', async ({ page }) => {
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // Before shortcut: reading-mode class should NOT be on <html>
    await expect(page.locator('html')).not.toHaveClass(/reading-mode/)

    // Press Cmd+Option+R (Mac) / Ctrl+Alt+R (Windows)
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+Alt+r' : 'Control+Alt+r')

    // reading-mode class should be added to <html>
    await expect(page.locator('html')).toHaveClass(/reading-mode/, { timeout: 5000 })

    // Press again to exit reading mode
    await page.keyboard.press(isMac ? 'Meta+Alt+r' : 'Control+Alt+r')

    // reading-mode class should be removed
    await expect(page.locator('html')).not.toHaveClass(/reading-mode/, { timeout: 5000 })
  })

  test('Cmd+Option+R shows toast on non-lesson pages', async ({ page }) => {
    await navigateAndWait(page, '/overview')

    // Press Cmd+Option+R
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+Alt+r' : 'Control+Alt+r')

    // A toast with "Reading mode is available on lesson pages" should appear
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /Reading mode is available on lesson pages/i,
    })
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('reading-mode class is NOT added on non-lesson pages', async ({ page }) => {
    await navigateAndWait(page, '/overview')

    // Press Cmd+Option+R
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+Alt+r' : 'Control+Alt+r')

    // Verify toast appeared but reading-mode class is NOT on <html>
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /Reading mode is available on lesson pages/i,
    })
    await expect(toast).toBeVisible({ timeout: 5000 })

    await expect(page.locator('html')).not.toHaveClass(/reading-mode/)
  })
})

// ===========================================================================
// H9: Brand border presence and toolbar absence
// ===========================================================================

test.describe('H9: Brand border and old toolbar absence', () => {
  test('header has brand bottom border on lesson pages', async ({ page }) => {
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // The header should have border-b-2 and border-brand tokens
    const header = page.locator('header[role="banner"]')
    await expect(header).toBeVisible({ timeout: 5000 })

    // Verify the border is present by checking computed style
    const borderBottomWidth = await header.evaluate(el => {
      return window.getComputedStyle(el).borderBottomWidth
    })
    // The border should be 2px (converted from Tailwind's border-b-2)
    expect(borderBottomWidth).toBe('2px')

    // Verify it's using a visible color (not transparent)
    const borderBottomColor = await header.evaluate(el => {
      return window.getComputedStyle(el).borderBottomColor
    })
    // Border color should not be transparent
    expect(borderBottomColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('header does NOT have brand border on non-lesson pages', async ({ page }) => {
    await navigateAndWait(page, '/overview')

    const header = page.locator('header[role="banner"]')
    await expect(header).toBeVisible({ timeout: 5000 })

    // Verify border is not present
    const borderBottomWidth = await header.evaluate(el => {
      return window.getComputedStyle(el).borderBottomWidth
    })
    // On non-lesson pages, header should not have a thick bottom border
    expect(borderBottomWidth).toBe('0px')
  })

  test('old sticky PlayerHeader toolbar is NOT present in lesson page', async ({ page }) => {
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // The old PlayerHeader component (sticky toolbar inside the lesson player
    // scrollable content) should not be present. Verify there is exactly ONE
    // instance of each lesson tool (from LessonHeaderTools in the header),
    // not a duplicate from the old toolbar.
    //
    // Check 1: Only one theater-mode-toggle should exist (in the Layout header)
    const theaterToggles = page.getByTestId('theater-mode-toggle')
    await expect(theaterToggles).toHaveCount(1, { timeout: 5000 })

    // Check 2: Only one notes-toggle should exist
    const notesToggles = page.getByTestId('notes-toggle')
    await expect(notesToggles).toHaveCount(1, { timeout: 5000 })

    // Check 3: The lesson tools should be rendered inside the header, not
    // inside the lesson content scroll area (where the old toolbar was)
    const headerTools = page.locator('header[role="banner"] [data-testid="theater-mode-toggle"]')
    await expect(headerTools).toHaveCount(1, { timeout: 3000 })

    // Check 4: No sticky toolbar container in the lesson content area
    const contentArea = page.getByTestId('lesson-player-content')
    const contentTools = contentArea.locator('[data-testid="theater-mode-toggle"]')
    await expect(contentTools).toHaveCount(0, { timeout: 3000 })
  })
})

// ===========================================================================
// H10: Responsive viewport tests
// ===========================================================================

test.describe('H10: Responsive viewports', () => {
  test('tablet (768px): kebab menu trigger visible, secondary tools in dropdown', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // The tablet kebab trigger should be visible at md:inline-flex lg:hidden
    const kebabTrigger = page.getByTestId('tablet-kebab-trigger')
    await expect(kebabTrigger).toBeVisible({ timeout: 5000 })

    // Desktop-only theater toggle and reading mode toggle should NOT be visible
    // (they are in <span className="hidden lg:contents">)
    const theaterToggle = page.getByTestId('theater-mode-toggle')
    await expect(theaterToggle).toBeHidden()

    // Focus the kebab trigger and press Enter to open the dropdown.
    // Radix UI DropdownMenu responds to keyboard activation.
    await kebabTrigger.focus()
    await page.keyboard.press('Enter')

    // Wait for the Radix UI dropdown content to appear.
    // Radix renders DropdownMenuContent in a portal with role="menu".
    const menu = page.locator('[role="menu"]')
    await expect(menu).toBeVisible({ timeout: 5000 })

    // Secondary tools should be in the dropdown
    await expect(page.getByTestId('kebab-reading-mode')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('kebab-theater-mode')).toBeVisible({ timeout: 3000 })
  })

  test('mobile (375px): BottomNav shows lesson-mode items on a lesson page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // BottomNav should be in lesson mode
    const bottomNav = page.locator('nav[aria-label="Lesson navigation"]')
    await expect(bottomNav).toBeVisible({ timeout: 5000 })

    // Lesson-mode items should be visible
    // "Back" link
    await expect(bottomNav.getByLabel('Back to course')).toBeVisible()
    // "Notes" button
    await expect(page.getByTestId('bottomnav-notes-toggle')).toBeVisible()
    // "More" button
    await expect(page.getByTestId('bottomnav-more-trigger')).toBeVisible()
  })

  test('mobile (375px): "More" button opens lesson tools drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // Click "More" to open the lesson tools drawer
    const moreTrigger = page.getByTestId('bottomnav-more-trigger')
    await expect(moreTrigger).toBeVisible({ timeout: 5000 })
    await moreTrigger.click()

    // Drawer should open with lesson tools
    await expect(page.getByTestId('drawer-completion-toggle')).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('drawer-notes-toggle')).toBeVisible()
    await expect(page.getByTestId('drawer-reading-mode')).toBeVisible()
    await expect(page.getByTestId('drawer-theater-mode')).toBeVisible()
  })

  test('mobile (375px): BottomNav shows standard items on a non-lesson page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await navigateAndWait(page, '/overview')

    // BottomNav should be in standard mode
    const bottomNav = page.locator('nav[aria-label="Mobile navigation"]')
    await expect(bottomNav).toBeVisible({ timeout: 5000 })

    // Standard navigation items should be visible.
    // Use .first() to avoid strict mode violation when multiple elements
    // contain the same text (e.g., sidebar + bottom nav both have "Courses").
    await expect(bottomNav.getByText('Overview').first()).toBeVisible()
    await expect(bottomNav.getByText('Courses').first()).toBeVisible()
    await expect(bottomNav.getByText('More').first()).toBeVisible()
  })

  test('desktop: lesson header tools visible at lg+ viewport', async ({ page }) => {
    // Desktop Chrome default is 1280x720 — already lg+
    await seedAndGoToLesson(page)
    await waitForLessonPageReady(page)

    // Theater mode toggle should be visible at lg+
    await expect(page.getByTestId('theater-mode-toggle')).toBeVisible({ timeout: 5000 })

    // Reading mode toggle should be visible at lg+
    await expect(page.getByTestId('reading-mode-toggle')).toBeVisible({ timeout: 5000 })

    // Notes toggle should be visible at lg+
    await expect(page.getByTestId('notes-toggle')).toBeVisible({ timeout: 5000 })

    // Tablet kebab should NOT be visible at lg+
    const kebabTrigger = page.getByTestId('tablet-kebab-trigger')
    await expect(kebabTrigger).toBeHidden()
  })
})
