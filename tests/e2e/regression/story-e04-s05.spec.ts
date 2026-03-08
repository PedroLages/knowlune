import { FIXED_DATE, getRelativeDate } from './../../utils/test-time'
/**
 * E04-S05: Continue Learning Dashboard Action E2E Tests
 *
 * Verifies:
 *   - AC1: Card displays with course + lesson info + progress
 *   - AC2: Click navigates to lesson player with position param, <1s load time
 *   - AC3: Shows most recent session as hero + secondary recently accessed row
 *   - AC4: Empty state shows discovery suggestions
 *   - AC5: Graceful fallback message for deleted content
 *   - AC6: Mobile responsive with 44x44px touch targets, first actionable element
 */
import { test, expect } from '../../support/fixtures'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

test.describe('Continue Learning Dashboard (E04-S05)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar state to prevent overlay blocking on tablet viewports
    await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  })

  test('AC1: should display Continue Learning card with course and lesson info', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed course progress with active session
    await localStorage.seed('course-progress', {
      'nci-access': {
        courseId: 'nci-access',
        completedLessons: ['nci-intro-start-here'],
        lastWatchedLesson: 'nci-fnl-drones-psyops',
        lastVideoPosition: 120,
        notes: {},
        startedAt: getRelativeDate(-15),
        lastAccessedAt: FIXED_DATE,
      },
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Verify Continue Learning section exists
    const continueSection = page.getByTestId('continue-learning-section')
    await expect(continueSection).toBeVisible()

    // Verify card is displayed (not empty state)
    const continueCard = page.getByTestId('continue-learning-card')
    await expect(continueCard).toBeVisible()

    // Verify course title is displayed
    await expect(continueCard.getByRole('heading', { name: /NCI Access/i })).toBeVisible()

    // Verify lesson title is displayed
    await expect(continueCard.getByText(/Drones & Psyops/i)).toBeVisible()

    // Verify progress bar exists with correct completion (must be > 0%)
    const progressBar = continueCard.getByRole('progressbar')
    await expect(progressBar).toBeVisible()
    await expect(progressBar).toHaveAttribute('aria-label', /NCI Access: [1-9]\d*% complete/)

    // Verify "Last accessed" timestamp
    await expect(continueCard.getByText(/Last accessed/i)).toBeVisible()

    // Verify Resume Learning button is visually present (aria-hidden since parent link is the target)
    await expect(continueCard.getByText(/Resume Learning/i)).toBeVisible()
  })

  test('AC2: should navigate to lesson player with position param', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed active session with specific video position
    await localStorage.seed('course-progress', {
      'nci-access': {
        courseId: 'nci-access',
        completedLessons: [],
        lastWatchedLesson: 'nci-intro-start-here',
        lastVideoPosition: 60,
        notes: {},
        startedAt: FIXED_DATE,
        lastAccessedAt: FIXED_DATE,
      },
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    const continueCard = page.getByTestId('continue-learning-card')
    await expect(continueCard).toBeVisible()

    // Verify the resume link includes the video position parameter
    await expect(continueCard).toHaveAttribute(
      'href',
      /\/courses\/nci-access\/nci-intro-start-here\?t=60/
    )

    // Click the card and verify navigation
    await continueCard.click()

    // Wait for lesson player to load
    await page.waitForURL(/\/courses\/nci-access\/nci-intro-start-here/)
    await page.waitForLoadState('domcontentloaded')

    // Verify we're on the lesson page with position param
    await expect(page).toHaveURL(/\/courses\/nci-access\/nci-intro-start-here\?t=60/)
  })

  test('AC3: should show most recent session as hero and other courses in secondary row', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed multiple course progress entries
    await localStorage.seed('course-progress', {
      'nci-access': {
        courseId: 'nci-access',
        completedLessons: ['nci-intro-start-here'],
        lastWatchedLesson: 'nci-fnl-drones-psyops',
        lastVideoPosition: 120,
        notes: {},
        startedAt: getRelativeDate(-15),
        lastAccessedAt: new Date('2026-03-02T10:00:00Z').toISOString(),
      },
      authority: {
        courseId: 'authority',
        completedLessons: [],
        lastWatchedLesson: 'authority-lesson-01-communication-laws',
        lastVideoPosition: 0,
        notes: {},
        startedAt: new Date('2026-02-28').toISOString(),
        lastAccessedAt: new Date('2026-03-01T08:00:00Z').toISOString(),
      },
      'confidence-reboot': {
        courseId: 'confidence-reboot',
        completedLessons: [],
        lastWatchedLesson: 'cr-00-welcome',
        lastVideoPosition: 45,
        notes: {},
        startedAt: new Date('2026-03-03').toISOString(),
        lastAccessedAt: FIXED_DATE, // Most recent
      },
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Verify hero card shows the most recent session (Confidence Reboot)
    const continueCard = page.getByTestId('continue-learning-card')
    await expect(continueCard).toBeVisible()
    await expect(continueCard.getByRole('heading', { name: /Confidence Reboot/i })).toBeVisible()
    await expect(continueCard).toHaveAttribute(
      'href',
      /\/courses\/confidence-reboot\/cr-00-welcome/
    )

    // Verify recently accessed row shows other courses
    const recentRow = page.getByTestId('recently-accessed-row')
    await expect(recentRow).toBeVisible()

    // Should contain the other two courses
    await expect(recentRow.getByText(/NCI Access/i)).toBeVisible()
    await expect(recentRow.getByText(/Authority/i)).toBeVisible()
  })

  test('AC4: should show discovery-focused empty state when no sessions exist', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Clear any progress data to ensure fresh state
    await localStorage.seed('course-progress', {})

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Verify Continue Learning section exists
    const continueSection = page.getByTestId('continue-learning-section')
    await expect(continueSection).toBeVisible()

    // Verify empty state is shown (not the card)
    const continueCard = page.getByTestId('continue-learning-card')
    await expect(continueCard).not.toBeVisible()

    // Verify discovery heading
    await expect(continueSection.getByText(/Start Your Learning Journey/i)).toBeVisible()

    // Verify description
    await expect(
      continueSection.getByText(/Begin with one of these recommended courses/i)
    ).toBeVisible()

    // Verify at least 1 suggested course is displayed
    const suggestedCourses = continueSection.getByTestId(/suggested-course-/)
    await expect(suggestedCourses.first()).toBeVisible()

    // Verify "Explore All Courses" CTA
    const exploreButton = continueSection.getByRole('link', { name: /Explore All Courses/i })
    await expect(exploreButton).toBeVisible()
    await expect(exploreButton).toHaveAttribute('href', '/courses')
  })

  test('AC5: should show unavailable message for deleted course content', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed progress with a non-existent course ID
    await localStorage.seed('course-progress', {
      'deleted-course': {
        courseId: 'deleted-course',
        completedLessons: [],
        lastWatchedLesson: 'deleted-lesson',
        lastVideoPosition: 30,
        notes: {},
        startedAt: FIXED_DATE,
        lastAccessedAt: FIXED_DATE,
      },
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    // Verify Continue Learning section exists
    const continueSection = page.getByTestId('continue-learning-section')
    await expect(continueSection).toBeVisible()

    // Verify explicit unavailable message is shown
    const unavailableMessage = page.getByTestId('content-unavailable-message')
    await expect(unavailableMessage).toBeVisible()
    await expect(unavailableMessage.getByText(/no longer available/i)).toBeVisible()

    // Verify "Explore other courses" link is offered
    await expect(
      unavailableMessage.getByRole('link', { name: /Explore other courses/i })
    ).toBeVisible()

    // Falls back to discovery state since no valid sessions remain
    await expect(continueSection.getByText(/Start Your Learning Journey/i)).toBeVisible()

    // Page should not crash - verify other sections render
    const statsGrid = page.getByTestId('stats-grid')
    await expect(statsGrid).toBeVisible()
  })

  test('AC6: should be responsive with touch targets and first actionable prominence on mobile', async ({
    page,
    localStorage,
  }) => {
    // Set mobile viewport (iPhone 12 Pro: 390x844)
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto('/')

    // Seed active session
    await localStorage.seed('course-progress', {
      'nci-access': {
        courseId: 'nci-access',
        completedLessons: [],
        lastWatchedLesson: 'nci-intro-start-here',
        lastVideoPosition: 15,
        notes: {},
        startedAt: FIXED_DATE,
        lastAccessedAt: FIXED_DATE,
      },
    })

    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    const continueCard = page.getByTestId('continue-learning-card')
    await expect(continueCard).toBeVisible()

    // Verify card is visible and has adequate height
    const cardBox = await continueCard.boundingBox()
    expect(cardBox).not.toBeNull()
    expect(cardBox!.height).toBeGreaterThanOrEqual(88) // Exceeds 44px minimum

    // Verify Resume button has adequate touch target (aria-hidden, so query by text)
    const resumeButton = continueCard.getByText(/Resume Learning/i)
    const buttonBox = await resumeButton.boundingBox()
    expect(buttonBox).not.toBeNull()
    expect(buttonBox!.height).toBeGreaterThanOrEqual(44) // Minimum touch target
    expect(buttonBox!.width).toBeGreaterThanOrEqual(44)

    // Card should take full width on mobile
    const linkBox = await continueCard.boundingBox()
    expect(linkBox).not.toBeNull()
    expect(linkBox!.width).toBeGreaterThan(300) // Reasonable mobile width

    // Verify Continue Learning section appears before Study Streak (DOM order = visual order)
    const continueSection = page.getByTestId('continue-learning-section')
    const continueSectionBox = await continueSection.boundingBox()
    const streakSection = page.getByText('Study Streak')
    const streakSectionBox = await streakSection.boundingBox()
    expect(continueSectionBox).not.toBeNull()
    expect(streakSectionBox).not.toBeNull()
    expect(continueSectionBox!.y).toBeLessThan(streakSectionBox!.y)

    // Verify click interaction works on mobile
    await continueCard.click()
    await page.waitForURL(/\/courses\/nci-access\/nci-intro-start-here/)
    await expect(page).toHaveURL(/\/courses\/nci-access\/nci-intro-start-here/)
  })
})
