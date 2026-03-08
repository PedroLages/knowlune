/**
 * E2E tests for Story E04-S03: Study Session Recording
 *
 * Tests for session creation and end timestamp recording:
 *   AC1: Create session on content mount with course/content metadata
 *   AC2: Record session end on navigation/visibility change
 */
import { test, expect } from '../../support/fixtures'
import {
  seedCourseAndReload,
  goToLessonPlayer,
  waitForSessionExists,
  getLatestSession,
  waitForSessionEnd,
} from '../../support/helpers/study-session-test-helpers'
import { navigateAndWait } from '../../support/helpers/navigation'

test.describe('Story E04-S03: Study Session Recording', () => {
  test.beforeEach(async ({ page, localStorage }) => {
    // Seed localStorage to prevent sidebar overlay
    await page.goto('/')
    await localStorage.seed('eduvi-sidebar-v1', 'false')
    await page.reload()
  })

  test('AC1: creates session record when user enters lesson player', async ({ page, indexedDB }) => {
    // GIVEN a user has imported courses available
    await seedCourseAndReload(page, indexedDB)

    // WHEN the user navigates to the lesson player
    await goToLessonPlayer(page, 'course-study-tracking', 'video-lesson-1')

    // THEN a new study session record is created
    const sessionExists = await waitForSessionExists(page)
    expect(sessionExists).toBe(true)

    // AND session has required metadata fields
    const session = await getLatestSession(page)
    expect(session).toBeDefined()
    expect(session).toHaveProperty('startTime')
    expect(session).toHaveProperty('courseId')
    expect(session).toHaveProperty('contentItemId')
    expect(session?.courseId).toBe('course-study-tracking')
    expect(session?.contentItemId).toBe('video-lesson-1')
  })

  test('AC2: records session end timestamp on navigation away', async ({ page, indexedDB }) => {
    // GIVEN an active study session is in progress
    await seedCourseAndReload(page, indexedDB)
    await goToLessonPlayer(page, 'course-study-tracking', 'video-lesson-1')

    // WHEN the user navigates away
    await navigateAndWait(page, '/courses')

    // THEN session end timestamp is recorded
    const sessionHasEndTime = await waitForSessionEnd(page)
    expect(sessionHasEndTime).toBe(true)

    // AND duration is calculated
    const session = await getLatestSession(page)
    expect(session).toBeDefined()
    expect(typeof session?.duration).toBe('number')
    expect(session?.duration).toBeGreaterThanOrEqual(0)
  })
})
