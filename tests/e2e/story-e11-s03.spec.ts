import { test, expect } from '../support/fixtures'

/**
 * E11-S03: Study Session Quality Scoring
 *
 * Tests quality scoring system for study sessions.
 *
 * Acceptance Criteria:
 * - AC1: Quality score (0-100) calculated from active time (40%), interaction density (30%),
 *         session length (15%), breaks (15%) — displayed with breakdown
 * - AC2: High active time + frequent interactions → upper range score
 * - AC3: Short session + minimal interaction → low score, clear breakdown
 * - AC4: Session history shows quality scores with trend indicator
 * - AC5: Real-time tracking without displaying score until session ends
 */

test.describe('E11-S03: Study Session Quality Scoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Prevent sidebar overlay in tablet viewports
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
  })

  test('AC1: displays quality score with factor breakdown after session ends', async ({
    page,
  }) => {
    // GIVEN a learner completes a study session
    // WHEN the session ends
    // THEN the system calculates a quality score from 0 to 100
    // AND the score is displayed with a breakdown of each factor's contribution

    // TODO: Seed a completed session with known metrics, navigate to score display
    const scoreDisplay = page.getByTestId('quality-score-display')
    await expect(scoreDisplay).toBeVisible()

    // Verify score is 0-100
    const scoreValue = page.getByTestId('quality-score-value')
    await expect(scoreValue).toBeVisible()
    const scoreText = await scoreValue.textContent()
    const score = parseInt(scoreText || '0', 10)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)

    // Verify breakdown shows all 4 factors
    await expect(page.getByTestId('factor-active-time')).toBeVisible()
    await expect(page.getByTestId('factor-interaction-density')).toBeVisible()
    await expect(page.getByTestId('factor-session-length')).toBeVisible()
    await expect(page.getByTestId('factor-breaks')).toBeVisible()
  })

  test('AC2: high engagement session scores in upper range', async ({ page }) => {
    // GIVEN a study session has a high active time ratio and frequent interactions
    // WHEN the score is calculated
    // THEN the score reflects strong engagement with values in the upper range

    // TODO: Seed a session with high active time ratio and frequent interactions
    const scoreValue = page.getByTestId('quality-score-value')
    await expect(scoreValue).toBeVisible()
    const scoreText = await scoreValue.textContent()
    const score = parseInt(scoreText || '0', 10)
    expect(score).toBeGreaterThanOrEqual(70) // Upper range

    // Active time and interaction density factors show high individual scores
    const activeTimeFactor = page.getByTestId('factor-active-time')
    await expect(activeTimeFactor).toContainText(/[7-9]\d|100/)
    const interactionFactor = page.getByTestId('factor-interaction-density')
    await expect(interactionFactor).toContainText(/[7-9]\d|100/)
  })

  test('AC3: short session with minimal interaction scores low', async ({ page }) => {
    // GIVEN a study session is very short with minimal interaction
    // WHEN the score is calculated
    // THEN the score reflects low engagement
    // AND the breakdown clearly shows which factors contributed to the low score

    // TODO: Seed a very short session with minimal interactions
    const scoreValue = page.getByTestId('quality-score-value')
    await expect(scoreValue).toBeVisible()
    const scoreText = await scoreValue.textContent()
    const score = parseInt(scoreText || '0', 10)
    expect(score).toBeLessThanOrEqual(40) // Low range

    // Breakdown should show low scores for contributing factors
    const sessionLengthFactor = page.getByTestId('factor-session-length')
    await expect(sessionLengthFactor).toBeVisible()
  })

  test('AC4: session history shows quality scores with trend indicator', async ({
    page,
  }) => {
    // GIVEN a learner has completed multiple sessions
    // WHEN they view their session history
    // THEN each session displays its quality score alongside date, duration, and course name
    // AND a trend indicator shows whether session quality is improving, stable, or declining

    // TODO: Seed multiple completed sessions with quality scores
    // Navigate to session history
    const sessionHistory = page.getByTestId('session-history')
    await expect(sessionHistory).toBeVisible()

    // Each session row should show quality score
    const sessionRows = page.getByTestId('session-row')
    const count = await sessionRows.count()
    expect(count).toBeGreaterThan(0)

    // First row should have quality score, date, duration, course name
    const firstRow = sessionRows.first()
    await expect(firstRow.getByTestId('session-quality-score')).toBeVisible()
    await expect(firstRow.getByTestId('session-date')).toBeVisible()
    await expect(firstRow.getByTestId('session-duration')).toBeVisible()
    await expect(firstRow.getByTestId('session-course-name')).toBeVisible()

    // Trend indicator should be visible
    const trendIndicator = page.getByTestId('quality-trend-indicator')
    await expect(trendIndicator).toBeVisible()
    const trendText = await trendIndicator.textContent()
    expect(['improving', 'stable', 'declining'].some(t => trendText?.toLowerCase().includes(t))).toBe(true)
  })

  test('AC5: score not displayed during active session', async ({ page }) => {
    // GIVEN a learner is in an active study session
    // WHEN the session is ongoing
    // THEN the system tracks active time, interactions, and breaks in real time
    //      without displaying the score until the session concludes

    // TODO: Navigate to lesson player to start a session
    // Quality score should NOT be visible during active session
    const scoreDisplay = page.getByTestId('quality-score-display')
    await expect(scoreDisplay).not.toBeVisible()
  })
})
