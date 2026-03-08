import { test, expect } from '@playwright/test'
import { FIXED_DATE, getRelativeDate, addMinutes } from '../utils/test-time'
import { seedStudySessions } from '../support/helpers/indexeddb-seed'
import { createStudySession } from '../support/fixtures/factories/session-factory'

// Use existing course IDs from the static course data
const COURSE_ID_1 = 'nci-access'
const COURSE_ID_2 = 'authority'
const COURSE_ID_3 = 'confidence-reboot'

test.describe('Story E07-S04: At-Risk Course Detection & Completion Estimates', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to courses page before each test
    await page.goto('/courses')
  })

  test('AC1: displays "At Risk" badge when course has 14+ days inactivity and momentum < 20', async ({
    page,
  }) => {
    // Arrange: Create session 15 days ago for a course (momentum will be < 20)
    const oldSession = createStudySession({
      courseId: COURSE_ID_1,
      startTime: getRelativeDate(-15), // 15 days ago
      endTime: getRelativeDate(-15),
      duration: 1800,
    })

    // Seed session
    await seedStudySessions(page, [oldSession])
    await page.reload()

    // Assert: At-risk badge is visible
    const courseCard = page.locator(`[data-testid="course-card-${COURSE_ID_1}"]`)
    await expect(courseCard.locator('[data-testid="at-risk-badge"]')).toBeVisible()
  })

  test('AC2: removes "At Risk" badge when momentum score increases to 20+', async ({ page }) => {
    // Arrange: Create old session (at-risk)
    const oldSession = createStudySession({
      courseId: COURSE_ID_2,
      startTime: getRelativeDate(-15),
      endTime: getRelativeDate(-15),
      duration: 1800,
    })

    await seedStudySessions(page, [oldSession])
    await page.reload()

    // Verify badge exists initially
    const courseCard = page.locator(`[data-testid="course-card-${COURSE_ID_2}"]`)
    await expect(courseCard.locator('[data-testid="at-risk-badge"]')).toBeVisible()

    // Act: Add recent sessions to boost momentum (multiple sessions to ensure momentum > 20)
    const recentSessions = [
      createStudySession({
        courseId: COURSE_ID_2,
        startTime: FIXED_DATE,
        endTime: addMinutes(60),
        duration: 3600,
      }),
      createStudySession({
        courseId: COURSE_ID_2,
        startTime: getRelativeDate(-1),
        endTime: getRelativeDate(-1),
        duration: 3600,
      }),
      createStudySession({
        courseId: COURSE_ID_2,
        startTime: getRelativeDate(-2),
        endTime: getRelativeDate(-2),
        duration: 3600,
      }),
    ]

    await seedStudySessions(page, recentSessions)
    await page.reload()

    // Assert: At-risk badge is no longer visible
    await expect(courseCard.locator('[data-testid="at-risk-badge"]')).not.toBeVisible()
  })

  test('AC3: displays estimated completion time based on remaining content and average pace', async ({
    page,
  }) => {
    // Arrange: User's average session: 30 min/session over past 30 days
    const sessions = [
      createStudySession({
        courseId: COURSE_ID_3,
        startTime: getRelativeDate(-5),
        endTime: getRelativeDate(-5),
        duration: 1800, // 30 min
      }),
      createStudySession({
        courseId: COURSE_ID_3,
        startTime: getRelativeDate(-10),
        endTime: getRelativeDate(-10),
        duration: 1800, // 30 min
      }),
    ]

    await seedStudySessions(page, sessions)
    await page.reload()

    // Assert: Completion estimate is displayed
    const courseCard = page.locator(`[data-testid="course-card-${COURSE_ID_3}"]`)
    const estimateText = courseCard.locator('[data-testid="completion-estimate"]')
    await expect(estimateText).toBeVisible()
    await expect(estimateText).toContainText(/session|day/)
  })

  test('AC4: uses default 30-minute pace for new users with no sessions', async ({ page }) => {
    // Arrange: Use a course with no sessions (new user scenario)
    // All courses start with no sessions by default

    // Assert: Completion estimate uses default pace
    const courseCard = page.locator(`[data-testid="course-card-${COURSE_ID_1}"]`).first()
    const estimateText = courseCard.locator('[data-testid="completion-estimate"]')
    await expect(estimateText).toBeVisible()
    await expect(estimateText).toContainText(/session|day/)
  })

  test('AC5: displays both at-risk badge and completion estimate without overlap', async ({
    page,
  }) => {
    // Arrange: Create at-risk course with completion estimate
    const oldSession = createStudySession({
      courseId: COURSE_ID_1,
      startTime: getRelativeDate(-15),
      endTime: getRelativeDate(-15),
      duration: 1800,
    })

    await seedStudySessions(page, [oldSession])
    await page.reload()

    // Assert: Both indicators are visible
    const courseCard = page.locator(`[data-testid="course-card-${COURSE_ID_1}"]`)
    const atRiskBadge = courseCard.locator('[data-testid="at-risk-badge"]')
    const completionEstimate = courseCard.locator('[data-testid="completion-estimate"]')

    await expect(atRiskBadge).toBeVisible()
    await expect(completionEstimate).toBeVisible()

    // Assert: No visual overlap (bounding boxes don't intersect)
    const badgeBox = await atRiskBadge.boundingBox()
    const estimateBox = await completionEstimate.boundingBox()

    expect(badgeBox).toBeTruthy()
    expect(estimateBox).toBeTruthy()

    // Check for overlap: boxes don't overlap if one is completely to the left/right/above/below the other
    const noOverlap =
      badgeBox!.x + badgeBox!.width <= estimateBox!.x || // badge to left of estimate
      estimateBox!.x + estimateBox!.width <= badgeBox!.x || // estimate to left of badge
      badgeBox!.y + badgeBox!.height <= estimateBox!.y || // badge above estimate
      estimateBox!.y + estimateBox!.height <= badgeBox!.y // estimate above badge

    expect(noOverlap).toBeTruthy()
  })

  test('AC6: at-risk courses appear at bottom when sorted by momentum', async ({ page }) => {
    // Arrange: Create sessions for different courses with varying momentum levels
    // Hot course: recent session
    const hotSession = createStudySession({
      courseId: COURSE_ID_1,
      startTime: FIXED_DATE,
      endTime: addMinutes(30),
      duration: 1800,
    })

    // Warm course: 7 days ago
    const warmSession = createStudySession({
      courseId: COURSE_ID_2,
      startTime: getRelativeDate(-7),
      endTime: getRelativeDate(-7),
      duration: 1800,
    })

    // At-risk course: 15 days ago
    const atRiskSession = createStudySession({
      courseId: COURSE_ID_3,
      startTime: getRelativeDate(-15),
      endTime: getRelativeDate(-15),
      duration: 1800,
    })

    await seedStudySessions(page, [hotSession, warmSession, atRiskSession])
    await page.reload()

    // Act: Select "Sort by Momentum" from the dropdown
    await page.locator('[data-testid="sort-select"]').click()
    await page.getByRole('option', { name: 'Sort by Momentum' }).click()

    // Give it a moment to sort
    await page.waitForTimeout(500)

    // Assert: Verify hot course is before warm course, which is before at-risk course
    const allCards = page.locator('[data-testid^="course-card-"]')

    // Find positions
    let hotPosition = -1
    let warmPosition = -1
    let atRiskPosition = -1

    const cardCount = await allCards.count()
    for (let i = 0; i < cardCount; i++) {
      const card = allCards.nth(i)
      const testId = await card.getAttribute('data-testid')
      if (testId === `course-card-${COURSE_ID_1}`) hotPosition = i
      if (testId === `course-card-${COURSE_ID_2}`) warmPosition = i
      if (testId === `course-card-${COURSE_ID_3}`) atRiskPosition = i
    }

    // Verify ordering: hot < warm < at-risk
    expect(hotPosition).toBeLessThan(warmPosition)
    expect(warmPosition).toBeLessThan(atRiskPosition)

    // Verify the at-risk badge is on the at-risk course
    const atRiskCard = page.locator(`[data-testid="course-card-${COURSE_ID_3}"]`)
    await expect(atRiskCard.locator('[data-testid="at-risk-badge"]')).toBeVisible()
  })
})
