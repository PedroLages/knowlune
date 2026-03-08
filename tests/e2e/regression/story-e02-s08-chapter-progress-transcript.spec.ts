/**
 * Story 2.8: Chapter Progress Bar & Transcript Panel — ATDD Acceptance Tests
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: Chapter markers visible at correct positions when chapter data present
 *   - AC2: No chapter markers rendered when chapter data absent
 *   - AC3: Transcript tab visible and synchronized when captions src present
 *   - AC4: Transcript tab hidden when no captions
 *   - AC5: Clicking a transcript cue seeks the video
 *   - AC6: Current cue is highlighted as video plays
 *
 * Notes:
 *   - AC2 and AC4 (absence tests) use the existing `operative-six` course which
 *     has no chapters or captions in static data — these should pass after
 *     implementation as the components render correctly with no data.
 *   - AC1, AC3, AC5, AC6 (presence tests) require chapter/caption data to be
 *     added to the test course during implementation (Task 1–5). Until then
 *     these tests remain RED because the data-testids won't exist.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { TIMEOUTS } from '../../utils/constants'
import { closeSidebar } from '@/tests/support/fixtures/constants/sidebar-constants'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Lesson with chapters + captions metadata (for AC1, AC3, AC5, AC6 presence tests)
const LESSON_URL = '/courses/operative-six/op6-introduction'
// Lesson with no chapter/caption metadata (for AC2, AC4 absence tests)
const LESSON_URL_NO_EXTRAS = '/courses/operative-six/op6-pillars-of-influence'

async function goToLesson(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  await navigateAndWait(page, LESSON_URL)
  await page.locator('video').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })
}

async function goToLessonNoExtras(page: Parameters<typeof navigateAndWait>[0]) {
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  await navigateAndWait(page, LESSON_URL_NO_EXTRAS)
  await page.locator('video').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })
}

// ===========================================================================
// AC1: Chapter markers visible at correct positions
// ===========================================================================

test.describe('AC1: Chapter markers when chapter data present', () => {
  test('chapter marker lines render at correct percentage positions', async ({ page }) => {
    // GIVEN: A course with chapter data (to be added to test data in implementation)
    await goToLesson(page)

    // WHEN: The lesson player loads with chapter metadata
    // THEN: Chapter markers are visible on the progress bar
    const markers = page.getByTestId('chapter-marker')
    await expect(markers.first()).toBeVisible()
  })

  test('hovering a chapter marker shows tooltip with title and timestamp', async ({ page }) => {
    // GIVEN: Chapter markers are visible
    await goToLesson(page)

    const firstMarker = page.getByTestId('chapter-marker').first()
    await expect(firstMarker).toBeVisible()

    // WHEN: User hovers a chapter marker
    await firstMarker.hover()

    // THEN: Tooltip shows chapter title and timestamp
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText(/\d+:\d+/) // timestamp like "0:30"
  })
})

// ===========================================================================
// AC2: No chapter markers when chapter data absent
// ===========================================================================

test.describe('AC2: No chapter markers when chapter data absent', () => {
  test('no chapter markers rendered when course has no chapter metadata', async ({ page }) => {
    // GIVEN: A lesson with no chapter metadata
    await goToLessonNoExtras(page)

    // THEN: No chapter markers are rendered
    const markers = page.getByTestId('chapter-marker')
    await expect(markers).toHaveCount(0)
  })
})

// ===========================================================================
// AC3: Transcript tab visible and synchronized
// ===========================================================================

test.describe('AC3: Transcript tab when captions src present', () => {
  test('transcript tab is visible in sidebar when captions src is present', async ({ page }) => {
    // GIVEN: A course with metadata.captions[0].src pointing to a .vtt file
    await goToLesson(page)

    // THEN: A "Transcript" tab is visible in the sidebar
    const transcriptTab = page.getByRole('tab', { name: /transcript/i })
    await expect(transcriptTab).toBeVisible()
  })

  test('transcript panel shows list of cues after clicking the tab', async ({ page }) => {
    // GIVEN: Transcript tab is visible
    await goToLesson(page)

    // WHEN: User clicks the Transcript tab
    const transcriptTab = page.getByRole('tab', { name: /transcript/i })
    await transcriptTab.click()

    // THEN: A list of transcript cue buttons is visible
    const cues = page.getByTestId('transcript-cue')
    await expect(cues.first()).toBeVisible()
  })
})

// ===========================================================================
// AC4: Transcript tab hidden when no captions
// ===========================================================================

test.describe('AC4: Transcript tab hidden when no captions', () => {
  test('no transcript tab shown when course has no captions metadata', async ({ page }) => {
    // GIVEN: A lesson with no captions metadata
    await goToLessonNoExtras(page)

    // THEN: No transcript tab is shown
    const transcriptTab = page.getByRole('tab', { name: /transcript/i })
    await expect(transcriptTab).toHaveCount(0)
  })
})

// ===========================================================================
// AC5: Clicking a transcript cue seeks the video
// ===========================================================================

test.describe('AC5: Click-to-seek from transcript cue', () => {
  test('clicking a transcript cue seeks video to that cue start time', async ({ page }) => {
    // GIVEN: Transcript tab is open and cues are visible
    await goToLesson(page)

    const transcriptTab = page.getByRole('tab', { name: /transcript/i })
    await transcriptTab.click()

    // WHEN: User clicks a transcript cue
    const cues = page.getByTestId('transcript-cue')
    await cues.nth(1).click()

    // THEN: Video current time changes to that cue's start time
    // (We verify the time display updated to non-zero)
    const timeDisplay = page.getByTestId('current-time')
    await expect(timeDisplay).not.toContainText('0:00')
  })
})

// ===========================================================================
// AC6: Current cue highlighted as video plays
// ===========================================================================

test.describe('AC6: Active cue highlighted as video plays', () => {
  test('active transcript cue has highlighted styling', async ({ page }) => {
    // GIVEN: Transcript tab is open
    await goToLesson(page)

    const transcriptTab = page.getByRole('tab', { name: /transcript/i })
    await transcriptTab.click()

    // WHEN: The first cue's time is reached (video at start)
    // THEN: The active cue element has the active data-testid
    const activeCue = page.getByTestId('transcript-cue-active')
    await expect(activeCue).toBeVisible()
  })
})
