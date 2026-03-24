/**
 * Story E21-S02: Enhanced Video Keyboard Shortcuts — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: < / > keys step playback speed with boundary announcements
 *   - AC2: N key opens notes panel and focuses TipTap editor
 *   - AC3: Shortcuts overlay shows updated entries
 *   - AC4: Accessibility — ARIA announcements, no focus traps
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import { TIMEOUTS } from '../utils/constants'

const LESSON_URL = '/courses/operative-six/op6-introduction'

async function goToLessonPlayer(page: Parameters<typeof navigateAndWait>[0]) {
  await page.addInitScript(() => {
    localStorage.removeItem('video-playback-speed') // start at 1x every time
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await navigateAndWait(page, LESSON_URL)
  await page.locator('video').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })
}

// ===========================================================================
// AC1: Speed keyboard controls  (< and >)
// ===========================================================================

test.describe('E21-S02 AC1: Speed keyboard controls', () => {
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'Keyboard events not reliable on webkit in CI'
  )

  test('> key increases playback speed to the next step', async ({ page }) => {
    await goToLessonPlayer(page)

    // Speed starts at 1x — pressing > should increase to 1.25x
    await page.keyboard.press('Shift+.')
    await expect(page.getByTestId('speed-menu-trigger')).toContainText('1.25x', {
      timeout: TIMEOUTS.SHORT,
    })
  })

  test('pressing > multiple times steps through the list to 2x', async ({ page }) => {
    await goToLessonPlayer(page)

    // From 1x: 1.25 → 1.5 → 2
    await page.keyboard.press('Shift+.')
    await page.keyboard.press('Shift+.')
    await page.keyboard.press('Shift+.')

    await expect(page.getByTestId('speed-menu-trigger')).toContainText('2x', {
      timeout: TIMEOUTS.SHORT,
    })
  })

  test('> at maximum speed announces "Already at maximum speed"', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('video-playback-speed', '2')
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, LESSON_URL)
    await page.locator('video').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })

    const liveRegion = page.locator('[role="status"]')

    await page.keyboard.press('Shift+.')
    await expect(liveRegion).toContainText('Already at maximum speed', {
      timeout: TIMEOUTS.SHORT,
    })
    // Speed remains at 2x
    await expect(page.getByTestId('speed-menu-trigger')).toContainText('2x')
  })

  test('< key decreases playback speed to the previous step', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('video-playback-speed', '1.25')
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, LESSON_URL)
    await page.locator('video').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })

    await page.keyboard.press('Shift+,')
    await expect(page.getByTestId('speed-menu-trigger')).toContainText('1x', {
      timeout: TIMEOUTS.SHORT,
    })
  })

  test('< at minimum speed announces "Already at minimum speed"', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('video-playback-speed', '0.5')
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, LESSON_URL)
    await page.locator('video').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })

    const liveRegion = page.locator('[role="status"]')

    await page.keyboard.press('Shift+,')
    await expect(liveRegion).toContainText('Already at minimum speed', {
      timeout: TIMEOUTS.SHORT,
    })
    // Speed stays at 0.5x
    await expect(page.getByTestId('speed-menu-trigger')).toContainText('0.5x')
  })

  test('speed change is persisted to localStorage', async ({ page }) => {
    await goToLessonPlayer(page)

    await page.keyboard.press('Shift+.')

    const storedSpeed = await page.evaluate(() => localStorage.getItem('video-playback-speed'))
    expect(storedSpeed).toBe('1.25')
  })
})

// ===========================================================================
// AC2: Focus note editor (N key)
// ===========================================================================

test.describe('E21-S02 AC2: Focus note editor (N key)', () => {
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'Keyboard events not reliable on webkit in CI'
  )

  test('N key opens notes panel when closed', async ({ page }) => {
    await goToLessonPlayer(page)

    // Notes panel should be closed by default
    await expect(page.locator('[data-testid="lesson-content-scroll"]')).toBeVisible()

    await page.keyboard.press('n')

    // Notes panel should now be open — the ScrollArea with Notes heading appears
    await expect(page.getByText('Notes').first()).toBeVisible({ timeout: TIMEOUTS.SHORT })
  })

  test('N key focuses contenteditable editor after panel opens', async ({ page }) => {
    await goToLessonPlayer(page)

    await page.keyboard.press('n')

    // Wait for editor to mount and receive focus
    await expect(page.locator('[contenteditable="true"]').first()).toBeFocused({
      timeout: TIMEOUTS.STANDARD,
    })
  })

  test('N key focuses editor when notes panel is already open', async ({ page }) => {
    await goToLessonPlayer(page)

    // Open notes panel via N
    await page.keyboard.press('n')
    await page.locator('[contenteditable="true"]').first().waitFor({ timeout: TIMEOUTS.STANDARD })

    // Click elsewhere to lose focus
    await page.locator('video').click()
    await expect(page.locator('[contenteditable="true"]').first()).not.toBeFocused()

    // Press N again
    await page.keyboard.press('n')
    await expect(page.locator('[contenteditable="true"]').first()).toBeFocused({
      timeout: TIMEOUTS.SHORT,
    })
  })

  test('N shortcut is suppressed when typing in a search input', async ({ page }) => {
    await goToLessonPlayer(page)

    // Focus the header search box (input field)
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first()
    await searchInput.focus()

    // Type N — should insert character, NOT trigger the shortcut
    await page.keyboard.press('n')
    await expect(searchInput).toHaveValue('n')

    // Notes panel should NOT have opened
    await expect(
      page.locator('[contenteditable="true"]').first()
    ).not.toBeFocused()
  })
})

// ===========================================================================
// AC3: Updated shortcuts overlay
// ===========================================================================

test.describe('E21-S02 AC3: Updated shortcuts overlay', () => {
  test('shortcuts overlay shows Speed down/up entry', async ({ page }) => {
    await goToLessonPlayer(page)

    // Open shortcuts overlay via ? key
    await page.keyboard.press('Shift+/')
    await expect(page.getByTestId('video-shortcuts-overlay')).toBeVisible({
      timeout: TIMEOUTS.SHORT,
    })

    await expect(page.getByTestId('video-shortcuts-overlay')).toContainText('Speed down/up')
  })

  test('shortcuts overlay shows Focus note editor entry', async ({ page }) => {
    await goToLessonPlayer(page)

    await page.keyboard.press('Shift+/')
    await expect(page.getByTestId('video-shortcuts-overlay')).toBeVisible({
      timeout: TIMEOUTS.SHORT,
    })

    await expect(page.getByTestId('video-shortcuts-overlay')).toContainText('Focus note editor')
  })

  test('shortcuts overlay shows < and > key badges', async ({ page }) => {
    await goToLessonPlayer(page)

    await page.keyboard.press('Shift+/')
    const overlay = page.getByTestId('video-shortcuts-overlay')
    await expect(overlay).toBeVisible({ timeout: TIMEOUTS.SHORT })

    // Both < and > should appear as kbd elements
    await expect(overlay.locator('kbd').filter({ hasText: '<' })).toBeVisible()
    await expect(overlay.locator('kbd').filter({ hasText: '>' })).toBeVisible()
  })

  test('shortcuts overlay shows N key badge in notes section', async ({ page }) => {
    await goToLessonPlayer(page)

    await page.keyboard.press('Shift+/')
    const overlay = page.getByTestId('video-shortcuts-overlay')
    await expect(overlay).toBeVisible({ timeout: TIMEOUTS.SHORT })

    await expect(overlay.locator('kbd').filter({ hasText: 'N' })).toBeVisible()
  })
})

// ===========================================================================
// AC4: Accessibility
// ===========================================================================

test.describe('E21-S02 AC4: Accessibility', () => {
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'Keyboard events not reliable on webkit in CI'
  )

  test('> key announces speed change in ARIA live region', async ({ page }) => {
    await goToLessonPlayer(page)

    const liveRegion = page.locator('[role="status"]')
    await page.keyboard.press('Shift+.')

    await expect(liveRegion).toContainText('Speed changed to 1.25x', {
      timeout: TIMEOUTS.SHORT,
    })
  })

  test('< key announces speed change in ARIA live region', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('video-playback-speed', '1.25')
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await navigateAndWait(page, LESSON_URL)
    await page.locator('video').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })

    const liveRegion = page.locator('[role="status"]')
    await page.keyboard.press('Shift+,')

    await expect(liveRegion).toContainText('Speed changed to 1x', { timeout: TIMEOUTS.SHORT })
  })

  test('N key does not trap focus after editor receives it', async ({ page }) => {
    await goToLessonPlayer(page)

    await page.keyboard.press('n')
    await page.locator('[contenteditable="true"]').first().waitFor({ timeout: TIMEOUTS.STANDARD })

    // User should be able to Tab away from the editor
    await page.keyboard.press('Tab')
    // Focus should have moved — the editor is no longer focused
    await expect(page.locator('[contenteditable="true"]').first()).not.toBeFocused()
  })
})
