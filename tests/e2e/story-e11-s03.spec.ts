import { test, expect } from '../support/fixtures'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'

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

const DB_NAME = 'ElearningDB'

/** Create a completed study session with quality scoring data */
function makeSession(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID()
  const startTime = new Date('2026-03-15T10:00:00Z').toISOString()
  const endTime = new Date('2026-03-15T10:45:00Z').toISOString()
  return {
    id,
    courseId: 'course-1',
    contentItemId: 'lesson-1',
    startTime,
    endTime,
    duration: 2700, // 45 min
    idleTime: 300, // 5 min
    videosWatched: [],
    lastActivity: endTime,
    sessionType: 'video',
    interactionCount: 200,
    breakCount: 1,
    qualityScore: 85,
    qualityFactors: {
      activeTimeScore: 90,
      interactionDensityScore: 89,
      sessionLengthScore: 100,
      breaksScore: 95,
    },
    ...overrides,
  }
}

/** Seed a mock course for the session to reference */
function makeCourse() {
  return {
    id: 'course-1',
    name: 'Test Course',
    folderName: 'test-course',
    importedAt: new Date('2026-03-01').toISOString(),
    videoCount: 2,
    pdfCount: 0,
    status: 'active',
    tags: [],
  }
}

test.describe('E11-S03: Study Session Quality Scoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Prevent sidebar overlay in tablet viewports
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
  })

  test('AC1+AC2: session history shows high quality score with badge', async ({ page }) => {
    // Seed a high-engagement completed session
    const session = makeSession({
      qualityScore: 88,
      qualityFactors: {
        activeTimeScore: 90,
        interactionDensityScore: 89,
        sessionLengthScore: 100,
        breaksScore: 95,
      },
    })

    await seedIndexedDBStore(page, DB_NAME, 'importedCourses', [makeCourse()])
    await seedIndexedDBStore(page, DB_NAME, 'studySessions', [session])
    await page.goto('/session-history')
    await page.waitForLoadState('domcontentloaded')

    // Session row should be visible with quality badge
    const sessionRow = page.getByTestId('session-row').first()
    await expect(sessionRow).toBeVisible()

    // Quality score badge should show the score
    const qualityBadge = sessionRow.getByTestId('session-quality-score')
    await expect(qualityBadge).toBeVisible()
    await expect(qualityBadge).toHaveText('88')

    // Date, duration, course name should be visible
    await expect(sessionRow.getByTestId('session-date')).toBeVisible()
    await expect(sessionRow.getByTestId('session-duration')).toBeVisible()
    await expect(sessionRow.getByTestId('session-course-name')).toBeVisible()
  })

  test('AC3: low engagement session shows low quality score', async ({ page }) => {
    // Seed a low-engagement session
    const session = makeSession({
      duration: 120, // 2 min
      idleTime: 600,
      interactionCount: 1,
      breakCount: 0,
      qualityScore: 18,
      qualityFactors: {
        activeTimeScore: 17,
        interactionDensityScore: 7,
        sessionLengthScore: 14,
        breaksScore: 100,
      },
    })

    await seedIndexedDBStore(page, DB_NAME, 'importedCourses', [makeCourse()])
    await seedIndexedDBStore(page, DB_NAME, 'studySessions', [session])
    await page.goto('/session-history')
    await page.waitForLoadState('domcontentloaded')

    const qualityBadge = page.getByTestId('session-quality-score').first()
    await expect(qualityBadge).toBeVisible()
    await expect(qualityBadge).toHaveText('18')
  })

  test('AC4: multiple sessions show trend indicator', async ({ page }) => {
    // Seed multiple sessions with improving scores (recent first after sort)
    const sessions = [
      makeSession({
        id: crypto.randomUUID(),
        startTime: new Date('2026-03-15T10:00:00Z').toISOString(),
        endTime: new Date('2026-03-15T10:45:00Z').toISOString(),
        qualityScore: 90,
      }),
      makeSession({
        id: crypto.randomUUID(),
        startTime: new Date('2026-03-14T10:00:00Z').toISOString(),
        endTime: new Date('2026-03-14T10:30:00Z').toISOString(),
        qualityScore: 85,
      }),
      makeSession({
        id: crypto.randomUUID(),
        startTime: new Date('2026-03-13T10:00:00Z').toISOString(),
        endTime: new Date('2026-03-13T10:20:00Z').toISOString(),
        qualityScore: 60,
      }),
      makeSession({
        id: crypto.randomUUID(),
        startTime: new Date('2026-03-12T10:00:00Z').toISOString(),
        endTime: new Date('2026-03-12T10:15:00Z').toISOString(),
        qualityScore: 55,
      }),
    ]

    await seedIndexedDBStore(page, DB_NAME, 'importedCourses', [makeCourse()])
    await seedIndexedDBStore(page, DB_NAME, 'studySessions', sessions)
    await page.goto('/session-history')
    await page.waitForLoadState('domcontentloaded')

    // Trend indicator should be visible
    const trendIndicator = page.getByTestId('quality-trend-indicator')
    await expect(trendIndicator).toBeVisible()

    // With improving scores (90,85 recent vs 60,55 old), trend should be "Improving"
    await expect(trendIndicator).toContainText('Improving')

    // Multiple session rows should show quality scores
    const sessionRows = page.getByTestId('session-row')
    const count = await sessionRows.count()
    expect(count).toBe(4)
  })

  test('AC1: quality score dialog shows breakdown after session ends', async ({ page }) => {
    // Navigate to any page that renders Layout (which hosts the dialog)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Quality score dialog should NOT be visible initially
    await expect(page.getByTestId('quality-score-display')).not.toBeVisible()

    // Simulate session end by dispatching the custom event that Layout listens for
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('session-quality-calculated', {
          detail: {
            score: 78,
            factors: {
              activeTimeScore: 85,
              interactionDensityScore: 72,
              sessionLengthScore: 68,
              breaksScore: 82,
            },
            tier: 'good',
          },
        })
      )
    })

    // Dialog should appear with score ring
    const scoreDisplay = page.getByTestId('quality-score-display')
    await expect(scoreDisplay).toBeVisible()
    await expect(page.getByTestId('quality-score-value')).toHaveText('78')

    // All four factor breakdowns should be visible
    await expect(page.getByTestId('factor-active-time')).toBeVisible()
    await expect(page.getByTestId('factor-interaction-density')).toBeVisible()
    await expect(page.getByTestId('factor-session-length')).toBeVisible()
    await expect(page.getByTestId('factor-breaks')).toBeVisible()

    // Close the dialog
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(scoreDisplay).not.toBeVisible()
  })

  test('AC5: quality score dialog absent during active session, shown after end', async ({
    page,
  }) => {
    // Navigate to app — dialog should not be visible
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Simulate that a session is "active" — dialog must NOT appear
    await expect(page.getByTestId('quality-score-display')).not.toBeVisible()

    // Now simulate session end via custom event
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('session-quality-calculated', {
          detail: {
            score: 65,
            factors: {
              activeTimeScore: 70,
              interactionDensityScore: 60,
              sessionLengthScore: 55,
              breaksScore: 75,
            },
            tier: 'fair',
          },
        })
      )
    })

    // Dialog should now be visible with the score
    await expect(page.getByTestId('quality-score-display')).toBeVisible()
    await expect(page.getByTestId('quality-score-value')).toHaveText('65')
  })

  test('AC4: session history shows dash for sessions without quality score', async ({ page }) => {
    // Seed a legacy session (no quality score)
    const session = makeSession({
      qualityScore: undefined,
      qualityFactors: undefined,
      interactionCount: undefined,
      breakCount: undefined,
    })

    await seedIndexedDBStore(page, DB_NAME, 'importedCourses', [makeCourse()])
    await seedIndexedDBStore(page, DB_NAME, 'studySessions', [session])
    await page.goto('/session-history')
    await page.waitForLoadState('domcontentloaded')

    // Should show "—" for sessions without a quality score
    const sessionRow = page.getByTestId('session-row').first()
    await expect(sessionRow).toBeVisible()
    await expect(sessionRow.getByText('—')).toBeVisible()
  })
})
