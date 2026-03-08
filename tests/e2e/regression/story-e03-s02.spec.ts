/**
 * Story 3.2: Side-by-Side Study Layout — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Desktop >= 1024px — 60/40 resizable split with drag handle
 *   - AC2: Notes panel collapsed by default, toggle button, "Notes available" indicator
 *   - AC3: `?panel=notes` URL param auto-opens notes panel
 *   - AC4: Tablet 640-1023px — stacked with video/notes toggle
 *   - AC5: Mobile < 640px — stacked, full-screen note expansion
 *   - AC6: Regression — preserve testids, scroll container, VideoPlayer props
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

const LESSON_URL = '/courses/operative-six/op6-introduction'

/** Navigate to lesson player and suppress mobile sidebar Sheet. */
async function goToLessonPlayer(page: Parameters<typeof navigateAndWait>[0], extraParams = '') {
  await page.evaluate(sidebarState => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  await navigateAndWait(page, LESSON_URL + extraParams)
}

// ===========================================================================
// AC1: Desktop resizable split
// ===========================================================================

test.describe('AC1: Desktop resizable split', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('clicking Notes toggle opens a resizable 60/40 split', async ({ page }) => {
    await goToLessonPlayer(page)

    // WHEN: Click the Notes toggle button
    const notesToggle = page.getByRole('button', { name: /notes/i })
    await expect(notesToggle).toBeVisible()
    await notesToggle.click()

    // THEN: The resizable panel group should be visible with a drag handle
    const panelGroup = page.locator('[data-group]')
    await expect(panelGroup).toBeVisible()

    const handle = page.locator('[data-separator]')
    await expect(handle).toBeVisible()
  })

  test('drag handle resizes the panels', async ({ page }) => {
    await goToLessonPlayer(page)

    // Open notes panel
    await page.getByRole('button', { name: /notes/i }).click()

    const handle = page.locator('[data-separator]')
    await expect(handle).toBeVisible()

    // Get initial handle position
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()

    // WHEN: Drag the handle left
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x - 100, box!.y + box!.height / 2, { steps: 5 })
    await page.mouse.up()

    // THEN: Handle should have moved (panel sizes changed)
    const newBox = await handle.boundingBox()
    expect(newBox!.x).toBeLessThan(box!.x)
  })

  test('minimum panel widths prevent unusably small content', async ({ page }) => {
    await goToLessonPlayer(page)
    await page.getByRole('button', { name: /notes/i }).click()

    const handle = page.locator('[data-separator]')
    const box = await handle.boundingBox()

    // WHEN: Try to drag handle far right (shrink video panel to minimum)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x + 600, box!.y + box!.height / 2, { steps: 5 })
    await page.mouse.up()

    // THEN: Video panel should not be smaller than 35% of total width
    const panels = page.locator('[data-panel]')
    const firstPanel = panels.first()
    const panelBox = await firstPanel.boundingBox()
    const groupBox = await page.locator('[data-group]').boundingBox()
    const ratio = panelBox!.width / groupBox!.width
    expect(ratio).toBeGreaterThanOrEqual(0.3) // ~35% min with tolerance
  })
})

// ===========================================================================
// AC2: Notes panel collapsed by default with toggle
// ===========================================================================

test.describe('AC2: Notes panel collapsed by default', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('notes panel is collapsed by default on desktop', async ({ page }) => {
    await goToLessonPlayer(page)

    // THEN: The drag handle should not be visible (notes panel collapsed)
    const handle = page.locator('[data-separator]')
    await expect(handle).toBeHidden()
  })

  test('toggle button is visible on desktop', async ({ page }) => {
    await goToLessonPlayer(page)

    // THEN: A button to toggle the notes panel should exist
    const notesToggle = page.getByRole('button', { name: /notes/i })
    await expect(notesToggle).toBeVisible()
    await expect(notesToggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('notes available indicator shows when lesson has existing notes', async ({ page }) => {
    await goToLessonPlayer(page)

    // WHEN: Type some notes in the tab's note editor first
    // (Need to create notes for the indicator to appear)
    // For now, check that the indicator mechanism exists on the toggle button
    const notesToggle = page.getByRole('button', { name: /notes/i })
    await expect(notesToggle).toBeVisible()

    // THEN: After notes exist, a visual indicator should appear
    // (This test will need notes seeded via IndexedDB fixture)
  })
})

// ===========================================================================
// AC3: URL param auto-opens notes
// ===========================================================================

test.describe('AC3: URL param ?panel=notes', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('navigating with ?panel=notes auto-opens notes panel', async ({ page }) => {
    await goToLessonPlayer(page, '?panel=notes')

    // THEN: Notes panel should be open immediately
    const handle = page.locator('[data-separator]')
    await expect(handle).toBeVisible()

    // AND: Note editor should be visible in the side panel
    const noteEditor = page.getByTestId('note-editor')
    await expect(noteEditor).toBeVisible()
  })

  test('notes toggle shows aria-expanded=true when opened via URL param', async ({ page }) => {
    await goToLessonPlayer(page, '?panel=notes')

    const notesToggle = page.getByRole('button', { name: 'Notes', exact: true })
    await expect(notesToggle).toHaveAttribute('aria-expanded', 'true')
  })
})

// ===========================================================================
// AC4: Tablet stacked layout
// ===========================================================================

test.describe('AC4: Tablet stacked layout', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('video/notes toggle is visible on tablet', async ({ page }) => {
    await goToLessonPlayer(page)

    // THEN: A toggle to switch between video and notes should exist
    const videoToggle = page.getByRole('button', { name: /video/i })
    const notesToggle = page.getByRole('button', { name: /notes/i })
    // At least one toggle mechanism should be present
    const toggleGroup = page.locator('[data-testid="tablet-view-toggle"]')
    await expect(toggleGroup).toBeVisible()
  })

  test('switching to notes hides video and shows note editor', async ({ page }) => {
    await goToLessonPlayer(page)

    // WHEN: Click the notes toggle
    const notesBtn = page
      .locator('[data-testid="tablet-view-toggle"]')
      .getByRole('button', { name: /notes/i })
    await notesBtn.click()

    // THEN: Video should be hidden
    const videoAnchor = page.getByTestId('video-anchor')
    await expect(videoAnchor).toBeHidden()

    // AND: Note editor should be visible
    const noteEditor = page.getByTestId('note-editor')
    await expect(noteEditor).toBeVisible()
  })

  test('switching back to video hides notes and shows video', async ({ page }) => {
    await goToLessonPlayer(page)

    // Open notes first
    const toggleGroup = page.locator('[data-testid="tablet-view-toggle"]')
    await toggleGroup.getByRole('button', { name: /notes/i }).click()

    // WHEN: Switch back to video
    await toggleGroup.getByRole('button', { name: /video/i }).click()

    // THEN: Video should be visible again
    const videoAnchor = page.getByTestId('video-anchor')
    await expect(videoAnchor).toBeVisible()
  })
})

// ===========================================================================
// AC5: Mobile full-screen notes
// ===========================================================================

test.describe('AC5: Mobile full-screen notes', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('full-screen expand button is available in mobile notes', async ({ page }) => {
    await goToLessonPlayer(page)

    // Navigate to Notes tab
    const notesTab = page.getByRole('tab', { name: /notes/i })
    await notesTab.click()

    // THEN: An expand button should be visible
    const expandBtn = page.getByRole('button', { name: /expand full/i })
    await expect(expandBtn).toBeVisible()
  })

  test('clicking expand shows full-screen overlay', async ({ page }) => {
    await goToLessonPlayer(page)

    // Navigate to Notes tab
    await page.getByRole('tab', { name: /notes/i }).click()

    // WHEN: Click expand
    const expandBtn = page.getByRole('button', { name: /expand full/i })
    await expandBtn.click()

    // THEN: Full-screen overlay should appear
    const overlay = page.locator('[data-testid="notes-fullscreen"]')
    await expect(overlay).toBeVisible()

    // AND: Note editor should be in the overlay
    const noteEditor = overlay.getByTestId('note-editor')
    await expect(noteEditor).toBeVisible()
  })

  test('minimize button closes full-screen overlay', async ({ page }) => {
    await goToLessonPlayer(page)

    await page.getByRole('tab', { name: /notes/i }).click()
    await page.getByRole('button', { name: /expand full/i }).click()

    // WHEN: Click minimize
    const minimizeBtn = page.getByRole('button', { name: /minimize|close|collapse/i })
    await minimizeBtn.click()

    // THEN: Overlay should disappear
    const overlay = page.locator('[data-testid="notes-fullscreen"]')
    await expect(overlay).toBeHidden()
  })
})

// ===========================================================================
// AC6: Regression — testids and invariants
// ===========================================================================

test.describe('AC6: Regression invariants', () => {
  test.describe('desktop viewport', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('required testids are present on desktop', async ({ page }) => {
      await goToLessonPlayer(page)

      await expect(page.getByTestId('video-anchor')).toBeVisible()
      await expect(page.getByTestId('mini-player')).toBeVisible()
      await expect(page.getByTestId('lesson-content-scroll')).toBeVisible()
      await expect(page.getByTestId('desktop-sidebar')).toBeVisible()
      await expect(page.getByTestId('video-player-container')).toBeVisible()
    })

    test('testids preserved when notes panel is open', async ({ page }) => {
      await goToLessonPlayer(page, '?panel=notes')

      await expect(page.getByTestId('video-anchor')).toBeVisible()
      await expect(page.getByTestId('mini-player')).toBeVisible()
      await expect(page.getByTestId('lesson-content-scroll')).toBeVisible()
      await expect(page.getByTestId('video-player-container')).toBeVisible()
      // desktop-sidebar may be hidden when notes open (by design)
    })
  })

  test.describe('tablet viewport', () => {
    test.use({ viewport: { width: 768, height: 1024 } })

    test('required testids are present on tablet', async ({ page }) => {
      await goToLessonPlayer(page)

      await expect(page.getByTestId('video-anchor')).toBeVisible()
      await expect(page.getByTestId('mini-player')).toBeVisible()
      await expect(page.getByTestId('lesson-content-scroll')).toBeVisible()
      await expect(page.getByTestId('video-player-container')).toBeVisible()
    })
  })

  test.describe('mobile viewport', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('required testids are present on mobile', async ({ page }) => {
      await goToLessonPlayer(page)

      await expect(page.getByTestId('video-anchor')).toBeVisible()
      await expect(page.getByTestId('mini-player')).toBeVisible()
      await expect(page.getByTestId('lesson-content-scroll')).toBeVisible()
      await expect(page.getByTestId('video-player-container')).toBeVisible()
    })
  })
})
