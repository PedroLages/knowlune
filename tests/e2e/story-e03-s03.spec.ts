/**
 * Story 3.3: Timestamp Notes and Video Navigation — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Alt+T or toolbar button inserts [MM:SS](video://lessonId#t=seconds) at cursor
 *   - AC2: Clicking timestamp link in preview seeks video to exact position
 *   - AC3: Timestamps render as blue-600 links with clock icon and tooltip
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

const LESSON_URL = '/courses/operative-six/op6-introduction'

/** Navigate to lesson player with notes panel open, suppress sidebar. */
async function goToLessonWithNotes(page: Parameters<typeof navigateAndWait>[0]) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await navigateAndWait(page, LESSON_URL + '?panel=notes')
}

// ===========================================================================
// AC1: Timestamp insertion via button and Alt+T
// ===========================================================================

test.describe('AC1: Timestamp insertion', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('Add Timestamp button inserts [MM:SS](video://lessonId#t=seconds) format', async ({ page }) => {
    await goToLessonWithNotes(page)

    // Find the note editor textarea in the side panel
    const textarea = page.getByRole('textbox', { name: /lesson notes editor/i })
    await expect(textarea).toBeVisible()

    // Click Add Timestamp button
    const timestampBtn = page.getByRole('button', { name: /add timestamp/i })
    await expect(timestampBtn).toBeVisible()
    await timestampBtn.click()

    // THEN: Textarea should contain a timestamp in the spec format
    const value = await textarea.inputValue()
    // Format: [MM:SS](video://lessonId#t=seconds)
    expect(value).toMatch(/\[\d+:\d{2}\]\(video:\/\/.+#t=\d+\)/)
  })

  test('Alt+T inserts timestamp at cursor position', async ({ page }) => {
    await goToLessonWithNotes(page)

    const textarea = page.getByRole('textbox', { name: /lesson notes editor/i })
    await textarea.fill('Before  After')

    // Move cursor to position between "Before " and " After"
    await textarea.click()
    await textarea.press('Home')
    for (let i = 0; i < 7; i++) await textarea.press('ArrowRight')

    // WHEN: Press Alt+T
    await textarea.press('Alt+t')

    // THEN: Timestamp inserted at cursor position
    const value = await textarea.inputValue()
    expect(value).toContain('Before ')
    expect(value).toMatch(/\[\d+:\d{2}\]\(video:\/\/.+#t=\d+\)/)
    expect(value).toContain(' After')
  })

  test('Add Timestamp button is disabled when video time is 0', async ({ page }) => {
    await goToLessonWithNotes(page)

    const timestampBtn = page.getByRole('button', { name: /add timestamp/i })
    await expect(timestampBtn).toBeDisabled()
  })
})

// ===========================================================================
// AC2: Click timestamp link to seek video
// ===========================================================================

test.describe('AC2: Click timestamp to seek video', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('clicking a timestamp link in preview mode seeks the video', async ({ page }) => {
    await goToLessonWithNotes(page)

    // Type a timestamp link manually in the editor
    const textarea = page.getByRole('textbox', { name: /lesson notes editor/i })
    await textarea.fill('[2:34](video://op6-introduction#t=154)')

    // Switch to Preview tab
    const previewTab = page.getByRole('tab', { name: /preview/i })
    await previewTab.click()

    // WHEN: Click the timestamp link in preview
    const timestampLink = page.getByRole('button', { name: /2:34/i })
    await expect(timestampLink).toBeVisible()
    await timestampLink.click()

    // THEN: Video should seek (verify via the video element's currentTime)
    const video = page.locator('video')
    await expect(async () => {
      const currentTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime)
      expect(currentTime).toBeGreaterThanOrEqual(153) // within 1 second of 154
      expect(currentTime).toBeLessThanOrEqual(155)
    }).toPass({ timeout: 3000 })
  })
})

// ===========================================================================
// AC3: Visual rendering — clock icon, blue styling, tooltip
// ===========================================================================

test.describe('AC3: Timestamp visual rendering', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('timestamp links render with a clock icon', async ({ page }) => {
    await goToLessonWithNotes(page)

    // Type a timestamp link
    const textarea = page.getByRole('textbox', { name: /lesson notes editor/i })
    await textarea.fill('[1:30](video://op6-introduction#t=90)')

    // Switch to Preview
    await page.getByRole('tab', { name: /preview/i }).click()

    // THEN: A clock icon (SVG) should be present within the timestamp link
    const timestampLink = page.getByRole('button', { name: /1:30/i })
    await expect(timestampLink).toBeVisible()
    const clockIcon = timestampLink.locator('svg')
    await expect(clockIcon).toBeVisible()
  })

  test('timestamp links have blue styling', async ({ page }) => {
    await goToLessonWithNotes(page)

    const textarea = page.getByRole('textbox', { name: /lesson notes editor/i })
    await textarea.fill('[0:45](video://op6-introduction#t=45)')

    await page.getByRole('tab', { name: /preview/i }).click()

    // THEN: The link should have brand/blue color styling
    const timestampLink = page.getByRole('button', { name: /0:45/i })
    await expect(timestampLink).toBeVisible()
    // Verify it has the expected class or computed color
    await expect(timestampLink).toHaveClass(/text-brand|text-blue/)
  })

  test('hovering a timestamp link shows a tooltip', async ({ page }) => {
    await goToLessonWithNotes(page)

    const textarea = page.getByRole('textbox', { name: /lesson notes editor/i })
    await textarea.fill('[3:15](video://op6-introduction#t=195)')

    await page.getByRole('tab', { name: /preview/i }).click()

    const timestampLink = page.getByRole('button', { name: /3:15/i })
    await expect(timestampLink).toBeVisible()

    // WHEN: Hover the timestamp link
    await timestampLink.hover()

    // THEN: A tooltip should appear with the formatted time
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText(/3:15|jump/i)
  })
})
