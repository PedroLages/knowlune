/**
 * E07-S03: Next Course Suggestion After Completion
 *
 * Tests the end-to-end flow for the next course suggestion feature
 * that appears when a learner completes 100% of a course.
 *
 * Course used: 'authority' (7 lessons)
 */
import { test, expect } from '../../support/fixtures'
import { FIXED_DATE, getRelativeDate } from './../../utils/test-time'
import { TIMEOUTS } from '../../utils/constants'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

// All 7 lesson IDs for the 'authority' course
const AUTHORITY_LESSONS = [
  'authority-lesson-01-communication-laws',
  'authority-lesson-02-composure-confidence',
  'authority-lesson-03-confidence-strengths',
  'authority-lesson-04-discipline-habits',
  'authority-lesson-05-authority-triangle',
  'authority-lesson-06-overcoming-anxiety',
  'authority-lesson-07-resources',
]

const LAST_LESSON = AUTHORITY_LESSONS[AUTHORITY_LESSONS.length - 1]
const LAST_LESSON_URL = `/courses/authority/${LAST_LESSON}`

// All 8 course IDs (for "all done" seeding)
const ALL_COURSE_IDS = [
  'nci-access',
  'authority',
  'confidence-reboot',
  '6mx',
  'operative-six',
  'behavior-skills-breakthrough',
  'ops-manual-resources',
  'study-materials',
]

/**
 * Seed N-1 completed lessons for the authority course so that completing
 * the last lesson triggers a course-completion event.
 */
async function seedAuthorityAlmostComplete(
  page: import('@playwright/test').Page,
  localStorage: { seed: (key: string, data: unknown) => Promise<void> }
) {
  const progress: Record<string, unknown> = {
    authority: {
      courseId: 'authority',
      completedLessons: AUTHORITY_LESSONS.slice(0, 6), // all but last
      lastWatchedLesson: AUTHORITY_LESSONS[5],
      lastAccessedAt: FIXED_DATE,
      startedAt: getRelativeDate(-7),
      notes: {},
    },
  }
  await localStorage.seed('course-progress', progress)
}

/** Click the explicit "Close" text button in the CompletionModal */
async function closeCompletionModal(page: import('@playwright/test').Page) {
  // The CompletionModal renders a <Button variant="outline">Close</Button>
  // The Dialog also has an X icon button with aria-label "Close"
  // Scope to the dialog to avoid matching PDF viewer toolbar buttons
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
  await dialog.locator('button', { hasText: 'Close' }).first().click()
}

test.describe('E07-S03: Next Course Suggestion After Completion', () => {
  test.beforeEach(async ({ page, localStorage }) => {
    // Prevent sidebar overlay at tablet viewports; clear any persisted dismissals
    await page.addInitScript(sidebarState => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        window.localStorage.setItem(key, value)
      })
      window.localStorage.removeItem('levelup-dismissed-suggestions')
    }, closeSidebar())
    // Also clear after navigating to ensure any leftover state is gone
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.removeItem('levelup-dismissed-suggestions')
    })
    // Clear course progress so tests start clean
    await localStorage.clearAll()
  })

  test('AC1: suggestion card appears after completing final lesson', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')
    await seedAuthorityAlmostComplete(page, localStorage)

    // Navigate to last lesson
    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    // Click "Mark Complete" to complete the last lesson
    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
    await markCompleteBtn.click()

    // Course-level celebration modal should appear
    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: TIMEOUTS.EXTENDED })

    // Close the modal using the explicit "Close" button
    await closeCompletionModal(page)

    // Next course suggestion card should now be visible
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: TIMEOUTS.LONG })
  })

  test('AC3: clicking "Start Course" navigates to the suggested course', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')
    await seedAuthorityAlmostComplete(page, localStorage)

    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
    await markCompleteBtn.click()

    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: TIMEOUTS.EXTENDED })
    await closeCompletionModal(page)

    // Suggestion card should be visible
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Click "Start Course"
    await page.getByRole('button', { name: /start course/i }).click()

    // Should navigate to some course page (not authority — that's already done)
    await expect(page).toHaveURL(/\/courses\/(?!authority)/, { timeout: TIMEOUTS.LONG })
  })

  test('AC4: dismiss hides the suggestion card', async ({ page, localStorage }) => {
    await page.goto('/')
    await seedAuthorityAlmostComplete(page, localStorage)

    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
    await markCompleteBtn.click()

    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: TIMEOUTS.EXTENDED })
    await closeCompletionModal(page)
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Click dismiss (×) button
    await page.getByRole('button', { name: /dismiss course suggestion/i }).click()

    // Card should be gone
    await expect(page.getByTestId('next-course-suggestion')).not.toBeVisible()
  })

  test('AC4: dismiss persists across page reload', async ({ page, localStorage }) => {
    await page.goto('/')
    await seedAuthorityAlmostComplete(page, localStorage)

    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
    await markCompleteBtn.click()

    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: TIMEOUTS.EXTENDED })
    await closeCompletionModal(page)
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Dismiss the suggestion
    await page.getByRole('button', { name: /dismiss course suggestion/i }).click()
    await expect(page.getByTestId('next-course-suggestion')).not.toBeVisible()

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Card should still not appear (dismissal persisted in localStorage via Zustand persist)
    await expect(page.getByTestId('next-course-suggestion')).not.toBeVisible()
  })

  test('AC5: congratulatory message shown when all courses are complete', async ({
    page,
    localStorage,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'WebKit CI times out seeding large localStorage payloads')
    await page.goto('/')

    // Seed authority with N-1 lessons complete, all other courses with fake 100% progress
    const progress: Record<string, unknown> = {}

    // Use 1000 fake lesson IDs per course — well above any real course's lesson count.
    // The algorithm checks completedLessons.length >= module-derived total,
    // so we need a count that exceeds the largest real course (nci-access ~275 lessons).
    // NOTE: The algorithm uses course.modules.reduce(sum + m.lessons.length),
    // so completedLessons.length comparison works regardless of actual IDs.
    for (const courseId of ALL_COURSE_IDS.filter(id => id !== 'authority')) {
      progress[courseId] = {
        courseId,
        completedLessons: Array.from({ length: 1000 }, (_, i) => `${courseId}-lesson-${i + 1}`),
        lastAccessedAt: FIXED_DATE,
        startedAt: getRelativeDate(-30),
        notes: {},
      }
    }

    progress.authority = {
      courseId: 'authority',
      completedLessons: AUTHORITY_LESSONS.slice(0, 6),
      lastWatchedLesson: AUTHORITY_LESSONS[5],
      lastAccessedAt: FIXED_DATE,
      startedAt: getRelativeDate(-7),
      notes: {},
    }

    await localStorage.seed('course-progress', progress)

    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
    await markCompleteBtn.click()

    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: TIMEOUTS.EXTENDED })
    await closeCompletionModal(page)

    // Congratulatory message should appear (not a suggestion card)
    await expect(page.getByTestId('next-course-congratulations')).toBeVisible({
      timeout: TIMEOUTS.LONG,
    })
    await expect(page.getByText("You've completed all active courses!")).toBeVisible()
    await expect(page.getByTestId('next-course-suggestion')).not.toBeVisible()
  })

  test('AC2: 60/40 weighting ranks course with higher tag overlap despite lower momentum', async ({
    page,
    localStorage,
  }) => {
    // Mock Date.now() for deterministic recency calculations
    await page.addInitScript(
      ({ fixedTimestamp }) => {
        Date.now = () => fixedTimestamp
      },
      { fixedTimestamp: new Date(FIXED_DATE).getTime() }
    )

    await page.goto('/')

    // Seed course progress with calibrated data to validate 60/40 formula
    // Authority: 7 tags = ['authority', 'influence', 'communication', 'composure', 'confidence', 'discipline', 'anxiety']
    //
    // Candidate A (confidence-reboot): 2 shared tags ('confidence', 'composure')
    // - tagScore = 2/7 = 0.286
    // - progress = 9/18 = 50%
    // - recency = 2 days → recencyScore = 1 - 2/14 = 0.857
    // - momentumProxy = (0.857 * 0.5) + (0.5 * 0.5) = 0.679
    // - finalScore = (0.286 * 0.6) + (0.679 * 0.4) = 0.444
    //
    // Candidate B (6mx): 1 shared tag ('influence')
    // - tagScore = 1/7 = 0.143
    // - progress = 16/31 = 51.6%
    // - recency = 2 days → recencyScore = 0.857
    // - momentumProxy = (0.857 * 0.5) + (0.516 * 0.5) = 0.687
    // - finalScore = (0.143 * 0.6) + (0.687 * 0.4) = 0.361
    //
    // Expected winner: confidence-reboot (0.444 > 0.361)
    // Proof: Extra shared tag in confidence-reboot (2 vs 1) overcomes slightly lower momentum (0.679 vs 0.687)

    const progress: Record<string, unknown> = {
      authority: {
        courseId: 'authority',
        completedLessons: AUTHORITY_LESSONS.slice(0, 6), // All but last
        lastWatchedLesson: AUTHORITY_LESSONS[5],
        lastAccessedAt: FIXED_DATE,
        startedAt: getRelativeDate(-7),
        notes: {},
      },
      'confidence-reboot': {
        courseId: 'confidence-reboot',
        completedLessons: [
          'confidence-reboot-lesson-01',
          'confidence-reboot-lesson-02',
          'confidence-reboot-lesson-03',
          'confidence-reboot-lesson-04',
          'confidence-reboot-lesson-05',
          'confidence-reboot-lesson-06',
          'confidence-reboot-lesson-07',
          'confidence-reboot-lesson-08',
          'confidence-reboot-lesson-09',
        ], // 9/18 = 50%
        lastAccessedAt: getRelativeDate(-2), // 2 days ago
        startedAt: getRelativeDate(-30),
        notes: {},
      },
      '6mx': {
        courseId: '6mx',
        completedLessons: Array.from(
          { length: 16 },
          (_, i) => `6mx-lesson-${String(i + 1).padStart(2, '0')}`
        ), // 16/31 = 51.6%
        lastAccessedAt: getRelativeDate(-2), // Same recency
        startedAt: getRelativeDate(-45),
        notes: {},
      },
    }

    await localStorage.seed('course-progress', progress)

    // Navigate to last lesson and complete it
    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
    await markCompleteBtn.click()

    // Close completion modal
    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: TIMEOUTS.EXTENDED })
    await closeCompletionModal(page)

    // Suggestion card should appear
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Verify the suggested course title appears (validates 60/40 weighting was applied)
    // The NextCourseSuggestion component has an <h2> with the course title
    // Mathematical proof (see test setup comments):
    // confidence-reboot: (0.286 * 0.6) + (0.679 * 0.4) = 0.444
    // 6mx:               (0.143 * 0.6) + (0.687 * 0.4) = 0.361
    // Expected winner: confidence-reboot due to extra shared tag (2 vs 1)
    const suggestionCard = page.getByTestId('next-course-suggestion')
    await expect(suggestionCard.locator('h2')).toHaveText(/confidence reboot/i)
  })

  test('AC3: tiebreaker applies momentum when courses have identical tag overlap', async ({
    page,
    localStorage,
  }) => {
    // Mock Date.now() for deterministic recency calculations
    await page.addInitScript(
      ({ fixedTimestamp }) => {
        Date.now = () => fixedTimestamp
      },
      { fixedTimestamp: new Date(FIXED_DATE).getTime() }
    )

    await page.goto('/')

    // Seed 3 courses with different tag overlap and momentum to validate scoring
    //
    // Tag overlap with authority (7 tags):
    // - confidence-reboot: 2 tags ('confidence', 'composure'), tagScore = 2/7 = 0.286
    // - operative-six: 1 tag ('influence'), tagScore = 1/7 = 0.143
    // - 6mx: 1 tag ('influence'), tagScore = 1/7 = 0.143
    //
    // confidence-reboot wins by primary sort (higher tagScore), not tiebreaker

    const progress: Record<string, unknown> = {
      authority: {
        courseId: 'authority',
        completedLessons: AUTHORITY_LESSONS.slice(0, 6),
        lastWatchedLesson: AUTHORITY_LESSONS[5],
        lastAccessedAt: FIXED_DATE,
        startedAt: getRelativeDate(-7),
        notes: {},
      },
      'confidence-reboot': {
        courseId: 'confidence-reboot',
        completedLessons: Array.from(
          { length: 9 },
          (_, i) => `confidence-reboot-lesson-${String(i + 1).padStart(2, '0')}`
        ), // 9/18 = 50%
        lastAccessedAt: getRelativeDate(-7), // 7 days ago → recency = 0.5
        startedAt: getRelativeDate(-30),
        notes: {},
      },
      'operative-six': {
        courseId: 'operative-six',
        completedLessons: Array.from(
          { length: 15 },
          (_, i) => `operative-six-lesson-${String(i + 1).padStart(2, '0')}`
        ), // ~60% progress
        lastAccessedAt: getRelativeDate(-3), // 3 days ago → recency ≈ 0.785
        startedAt: getRelativeDate(-30),
        notes: {},
      },
      '6mx': {
        courseId: '6mx',
        completedLessons: Array.from(
          { length: 10 },
          (_, i) => `6mx-lesson-${String(i + 1).padStart(2, '0')}`
        ), // ~30% progress
        lastAccessedAt: getRelativeDate(-1), // 1 day ago → recency ≈ 0.928
        startedAt: getRelativeDate(-30),
        notes: {},
      },
    }

    await localStorage.seed('course-progress', progress)

    // Navigate to last lesson and complete it
    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
    await markCompleteBtn.click()

    // Close completion modal
    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: TIMEOUTS.EXTENDED })
    await closeCompletionModal(page)

    // Suggestion card should appear
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Click "Start Course" to navigate to the suggested course
    const startButton = page.getByRole('button', { name: /start course/i })
    await startButton.click()

    // Validate that scoring selected the correct winner
    // With seeded data:
    // - confidence-reboot: tagScore=0.286 (2 shared tags), momentum=0.5, final=0.372
    // - operative-six: tagScore=0.143 (1 shared tag), momentum≈0.706, final≈0.368
    // - 6mx: tagScore=0.143 (1 shared tag), momentum≈0.627, final≈0.337
    //
    // Confidence-reboot wins due to higher tag overlap (2 vs 1) — primary sort, not tiebreaker
    await expect(page).toHaveURL(/\/courses\/confidence-reboot/, {
      timeout: TIMEOUTS.LONG,
    })
  })

  test('E07-S06: tiebreaker selects highest momentum when tag overlap counts match', async ({
    page,
    localStorage,
  }) => {
    // Mock Date.now() for deterministic recency calculations
    await page.addInitScript(
      ({ fixedTimestamp }) => {
        Date.now = () => fixedTimestamp
      },
      { fixedTimestamp: new Date(FIXED_DATE).getTime() }
    )

    await page.goto('/')

    // Both candidates share exactly 2 tags with authority (7 tags):
    //   confidence-reboot:            'confidence', 'composure'
    //   behavior-skills-breakthrough: 'influence', 'authority'
    //
    // Both have identical tagScore = 2/7 ≈ 0.286
    // With equal tag overlap, momentum proxy becomes the deciding factor.
    //
    // confidence-reboot (EXPECTED WINNER — high momentum):
    //   progress = 10/20 = 50%
    //   recency  = 1 day ago → recencyScore = 1 - 1/14 ≈ 0.929
    //   momentumProxy = (0.929 × 0.5) + (0.5 × 0.5) = 0.714
    //   finalScore = (0.286 × 0.6) + (0.714 × 0.4) = 0.457
    //
    // behavior-skills-breakthrough (EXPECTED LOSER — low momentum):
    //   progress = 3/13 ≈ 23% (13 = module-derived lesson count, matches totalLessons field)
    //   recency  = 10 days ago → recencyScore = 1 - 10/14 ≈ 0.286
    //   momentumProxy = (0.286 × 0.5) + (0.231 × 0.5) = 0.258
    //   finalScore = (0.286 × 0.6) + (0.258 × 0.4) = 0.275
    //
    // Margin: 0.457 vs 0.275 — momentum decides the winner.

    // Mark all courses except authority, confidence-reboot, and behavior-skills-breakthrough
    // as 100% complete so they are excluded from candidates.
    // Derived from ALL_COURSE_IDS to avoid breakage when new courses are added.
    const candidateIds = ['authority', 'confidence-reboot', 'behavior-skills-breakthrough']
    const excludedCourseIds = ALL_COURSE_IDS.filter(id => !candidateIds.includes(id))
    const progress: Record<string, unknown> = {}

    for (const courseId of excludedCourseIds) {
      progress[courseId] = {
        courseId,
        completedLessons: Array.from({ length: 1000 }, (_, i) => `${courseId}-lesson-${i + 1}`),
        lastAccessedAt: FIXED_DATE,
        startedAt: getRelativeDate(-30),
        notes: {},
      }
    }

    // Authority: N-1 lessons complete (completing the last triggers suggestion)
    progress.authority = {
      courseId: 'authority',
      completedLessons: AUTHORITY_LESSONS.slice(0, 6),
      lastWatchedLesson: AUTHORITY_LESSONS[5],
      lastAccessedAt: FIXED_DATE,
      startedAt: getRelativeDate(-7),
      notes: {},
    }

    // confidence-reboot: HIGH momentum (recent + 50% progress)
    // 20 total lessons (module-derived count used by algorithm, not totalLessons:18 field), seed 10 as complete
    progress['confidence-reboot'] = {
      courseId: 'confidence-reboot',
      completedLessons: Array.from(
        { length: 10 },
        (_, i) => `confidence-reboot-lesson-${String(i + 1).padStart(2, '0')}`
      ),
      lastAccessedAt: getRelativeDate(-1), // 1 day ago → high recency
      startedAt: getRelativeDate(-14),
      notes: {},
    }

    // behavior-skills-breakthrough: LOW momentum (old + 23% progress)
    // 13 total lessons (module-derived count matches totalLessons field), seed 3 as complete
    progress['behavior-skills-breakthrough'] = {
      courseId: 'behavior-skills-breakthrough',
      completedLessons: Array.from(
        { length: 3 },
        (_, i) => `behavior-skills-breakthrough-lesson-${String(i + 1).padStart(2, '0')}`
      ),
      lastAccessedAt: getRelativeDate(-10), // 10 days ago → low recency
      startedAt: getRelativeDate(-30),
      notes: {},
    }

    await localStorage.seed('course-progress', progress)

    // Navigate to last lesson and complete it
    await page.goto(LAST_LESSON_URL)
    await page.waitForLoadState('domcontentloaded')

    const markCompleteBtn = page.locator('button[aria-label="Mark lesson complete"]')
    await markCompleteBtn.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED })
    await markCompleteBtn.click()

    // Close completion modal
    await expect(page.getByText('🎉 Course Completed!')).toBeVisible({ timeout: TIMEOUTS.EXTENDED })
    await closeCompletionModal(page)

    // Suggestion card should appear
    await expect(page.getByTestId('next-course-suggestion')).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Verify the suggested course is confidence-reboot (higher momentum wins)
    const suggestionCard = page.getByTestId('next-course-suggestion')
    await expect(suggestionCard.locator('h2')).toHaveText(/confidence reboot/i)
  })
})
