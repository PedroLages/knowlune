/**
 * E2E tests for Story E04-S03: Study Session Persistence
 *
 * Tests for idle detection and session state persistence:
 *   AC3: Auto-pause after 5min idle, resume on activity
 */
import { test, expect } from '../../support/fixtures'
import {
  seedCourseAndReload,
  goToLessonPlayer,
  waitForIdleTimeRecorded,
  getLatestSession,
} from '../../support/helpers/study-session-test-helpers'

test.describe('Story E04-S03: Study Session Persistence', () => {
  test.beforeEach(async ({ page, localStorage }) => {
    // Seed localStorage to prevent sidebar overlay
    await page.goto('/')
    await localStorage.seed('knowlune-sidebar-v1', 'false')
    await page.reload()
  })

  test('AC3: auto-pauses session after 5 minutes of inactivity', async ({ page, indexedDB }) => {
    // Install clock BEFORE page loads (so React timers are mocked)
    const startTime = performance.now()
    await page.clock.install({ time: startTime })

    // GIVEN an active study session is in progress
    await seedCourseAndReload(page, indexedDB)
    await goToLessonPlayer(page, 'course-study-tracking', 'video-lesson-1')

    // Use real timeout for page load, then fast-forward for idle detection
    await page.clock.runFor(500)

    // WHEN the user is idle for more than 5 minutes
    await page.clock.fastForward(5 * 60 * 1000 + 1000) // 5 minutes 1 second

    // Wait for idle detection to trigger pauseSession
    await page.clock.runFor(2000)

    // THEN idle time should be recorded in the session
    const idleTimeRecorded = await waitForIdleTimeRecorded(page, 300)

    expect(idleTimeRecorded.success).toBe(true)
    expect(idleTimeRecorded.idleTime).toBeGreaterThanOrEqual(300) // 5 minutes in seconds

    // Simulate activity to resume
    await page.mouse.move(100, 100)

    // AND session resumes correctly (still exists, endTime is undefined = still active)
    const session = await getLatestSession(page)
    expect(session).toBeDefined()
    expect(session?.endTime).toBeUndefined() // Active if no endTime
    expect(session?.idleTime).toBeGreaterThanOrEqual(300) // Idle time should be preserved
  })
})
