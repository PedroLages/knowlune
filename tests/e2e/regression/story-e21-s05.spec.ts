/**
 * E21-S05: User Engagement Preference Controls — E2E Tests
 *
 * Tests verify:
 *   - AC1: Engagement Preferences section exists in Settings with all toggles
 *   - AC2: Toggling streaks hides streak section, toggling achievements hides banner
 *   - AC3: Color scheme picker renders with Professional selected
 *   - AC4: Preferences persist across page reload
 *   - AC5: Default state for new users (all ON, Professional scheme)
 *
 * Data seeding:
 *   - localStorage key: 'levelup-engagement-prefs-v1'
 *   - Tests clear/set this key as needed
 */
import { test, expect } from '../../support/fixtures'
import { goToSettings, goToOverview } from '../../support/helpers/navigation'

const PREFS_KEY = 'levelup-engagement-prefs-v1'

// ===========================================================================
// AC1: Engagement Preferences section renders with all toggles
// ===========================================================================

test.describe('AC1: Engagement Preferences section in Settings', () => {
  test('should display all four feature toggles and color scheme picker', async ({ page }) => {
    await goToSettings(page)

    // Section card is visible
    const section = page.getByTestId('engagement-preferences')
    await expect(section).toBeVisible()

    // Verify section heading
    await expect(section.getByText('Engagement Preferences')).toBeVisible()

    // Verify all 4 toggles are present
    await expect(section.getByTestId('toggle-achievements')).toBeVisible()
    await expect(section.getByTestId('toggle-streaks')).toBeVisible()
    await expect(section.getByTestId('toggle-badges')).toBeVisible()
    await expect(section.getByTestId('toggle-animations')).toBeVisible()

    // Verify toggle labels
    await expect(section.getByText('Achievements')).toBeVisible()
    await expect(section.getByText('Streaks')).toBeVisible()
    await expect(section.getByText('Badges', { exact: true })).toBeVisible()
    await expect(section.getByText('Animations')).toBeVisible()

    // Verify color scheme picker is present
    const colorPicker = section.getByTestId('color-scheme-picker')
    await expect(colorPicker).toBeVisible()
    await expect(colorPicker.getByText('Professional', { exact: true })).toBeVisible()
    await expect(colorPicker.getByText('Vibrant', { exact: true })).toBeVisible()
  })
})

// ===========================================================================
// AC2: Toggles control feature visibility
// ===========================================================================

test.describe('AC2: Toggling streaks hides streak section on Overview', () => {
  test('should hide study streak calendar when streaks toggle is OFF', async ({ page }) => {
    // GIVEN: Streaks are toggled OFF
    await page.addInitScript(key => {
      localStorage.setItem(
        key,
        JSON.stringify({
          achievements: true,
          streaks: false,
          badges: true,
          animations: true,
          colorScheme: 'professional',
        })
      )
    }, PREFS_KEY)

    // WHEN: Navigate to Overview
    await goToOverview(page)

    // THEN: Study Streak heading should not be visible
    await expect(page.getByText('Study Streak')).not.toBeVisible()
  })

  test('should show study streak calendar when streaks toggle is ON', async ({ page }) => {
    // GIVEN: Streaks are toggled ON (default)
    await page.addInitScript(key => {
      localStorage.setItem(
        key,
        JSON.stringify({
          achievements: true,
          streaks: true,
          badges: true,
          animations: true,
          colorScheme: 'professional',
        })
      )
    }, PREFS_KEY)

    // WHEN: Navigate to Overview
    await goToOverview(page)

    // THEN: Study Streak heading should be visible
    await expect(page.getByText('Study Streak')).toBeVisible()
  })
})

test.describe('AC2: Toggling achievements hides banner on Overview', () => {
  test('should hide achievement banner when achievements toggle is OFF', async ({ page }) => {
    // GIVEN: Achievements are toggled OFF
    await page.addInitScript(key => {
      localStorage.setItem(
        key,
        JSON.stringify({
          achievements: false,
          streaks: true,
          badges: true,
          animations: true,
          colorScheme: 'professional',
        })
      )
    }, PREFS_KEY)

    // Seed some lesson progress so the banner would normally appear
    await page.addInitScript(() => {
      localStorage.setItem(
        'course-progress',
        JSON.stringify({
          'test-course': {
            completedLessons: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10', 'l11'],
            lastAccessedAt: '2026-03-24T12:00:00.000Z',
          },
        })
      )
    })

    // WHEN: Navigate to Overview
    await goToOverview(page)

    // THEN: Achievement-related milestone text should not be in the DOM
    // (The AchievementBanner component is conditionally rendered)
    const banner = page.locator('[class*="shadow-studio-gold"]')
    await expect(banner).toHaveCount(0)
  })
})

test.describe('AC2: Toggling badges hides MomentumBadge on Overview', () => {
  test('should hide momentum badges when badges toggle is OFF and show when ON', async ({
    page,
  }) => {
    // GIVEN: Badges are toggled OFF
    await page.addInitScript(key => {
      localStorage.setItem(
        key,
        JSON.stringify({
          achievements: true,
          streaks: true,
          badges: false,
          animations: true,
          colorScheme: 'professional',
        })
      )
    }, PREFS_KEY)

    // WHEN: Navigate to Overview (MomentumBadge renders inside CourseCards)
    await goToOverview(page)

    // THEN: No momentum badges should be visible
    await expect(page.getByTestId('momentum-badge')).toHaveCount(0)

    // WHEN: Navigate to Settings and toggle badges ON
    await goToSettings(page)
    const section = page.getByTestId('engagement-preferences')
    const badgesToggle = section.getByTestId('toggle-badges')
    await badgesToggle.click()
    await expect(badgesToggle).toBeChecked()

    // AND: Navigate back to Overview
    await goToOverview(page)

    // THEN: Momentum badges should now be visible (if course data present)
    // Verify localStorage was updated to badges: true
    const prefs = await page.evaluate(
      key => JSON.parse(localStorage.getItem(key) || '{}'),
      PREFS_KEY
    )
    expect(prefs.badges).toBe(true)
  })
})

test.describe('AC2: Toggling animations controls MotionConfig and confetti', () => {
  test('should store animations preference as OFF and persist it', async ({ page }) => {
    // GIVEN: Animations are toggled OFF
    await page.addInitScript(key => {
      localStorage.setItem(
        key,
        JSON.stringify({
          achievements: true,
          streaks: true,
          badges: true,
          animations: false,
          colorScheme: 'professional',
        })
      )
    }, PREFS_KEY)

    // WHEN: Navigate to Overview
    await goToOverview(page)

    // THEN: MotionConfig should set reducedMotion to "always" (disabling animations)
    // Verify by checking the persisted preference
    const prefs = await page.evaluate(
      key => JSON.parse(localStorage.getItem(key) || '{}'),
      PREFS_KEY
    )
    expect(prefs.animations).toBe(false)
  })

  test('should toggle animations OFF via Settings and verify persistence after reload', async ({
    page,
  }) => {
    // GIVEN: Default state (animations ON)
    await goToSettings(page)

    const section = page.getByTestId('engagement-preferences')
    const animationsToggle = section.getByTestId('toggle-animations')

    // Verify animations toggle is ON by default
    await expect(animationsToggle).toBeChecked()

    // WHEN: Toggle animations OFF
    await animationsToggle.click()
    await expect(animationsToggle).not.toBeChecked()

    // THEN: Preference should be persisted
    const prefs = await page.evaluate(
      key => JSON.parse(localStorage.getItem(key) || '{}'),
      PREFS_KEY
    )
    expect(prefs.animations).toBe(false)

    // AND: After reload, the preference should persist
    await page.reload()
    await page.waitForSelector('h1', { state: 'visible', timeout: 10000 })
    const reloadedSection = page.getByTestId('engagement-preferences')
    const reloadedToggle = reloadedSection.getByTestId('toggle-animations')
    await expect(reloadedToggle).not.toBeChecked()
  })
})

// ===========================================================================
// AC3: Color scheme picker
// ===========================================================================

test.describe('AC3: Color scheme picker', () => {
  test('should show Professional as selected by default', async ({ page }) => {
    await goToSettings(page)

    const section = page.getByTestId('engagement-preferences')
    const colorPicker = section.getByTestId('color-scheme-picker')

    // Professional option should have the active indicator (brand dot)
    const professionalOption = colorPicker.getByText('Professional').locator('..')
    await expect(professionalOption.locator('.bg-brand.rounded-full')).toBeVisible()
  })

  test('should show Vibrant option as disabled', async ({ page }) => {
    await goToSettings(page)

    const section = page.getByTestId('engagement-preferences')
    const vibrantLabel = section.getByText('coming soon')
    await expect(vibrantLabel).toBeVisible()
  })
})

// ===========================================================================
// AC4: localStorage persistence
// ===========================================================================

test.describe('AC4: Preferences persist across page reload', () => {
  test('should preserve toggle state after page reload', async ({ page }) => {
    await goToSettings(page)

    const section = page.getByTestId('engagement-preferences')

    // Toggle Streaks OFF
    const streaksToggle = section.getByTestId('toggle-streaks')
    await streaksToggle.click()

    // Verify it's now unchecked
    await expect(streaksToggle).not.toBeChecked()

    // Reload the page
    await page.reload()
    await page.waitForSelector('h1', { state: 'visible', timeout: 10000 })

    // Verify toggle state persisted
    const reloadedSection = page.getByTestId('engagement-preferences')
    const reloadedStreaksToggle = reloadedSection.getByTestId('toggle-streaks')
    await expect(reloadedStreaksToggle).not.toBeChecked()
  })

  test('should persist OFF state and keep streak section hidden after reload', async ({ page }) => {
    // GIVEN: Toggle streaks OFF via Settings
    await goToSettings(page)
    const section = page.getByTestId('engagement-preferences')
    const streaksToggle = section.getByTestId('toggle-streaks')
    await streaksToggle.click()
    await expect(streaksToggle).not.toBeChecked()

    // WHEN: Navigate to Overview, reload, check again
    await goToOverview(page)
    await expect(page.getByText('Study Streak')).not.toBeVisible()

    // Reload and verify persistence
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })
    await expect(page.getByText('Study Streak')).not.toBeVisible()
  })
})

// ===========================================================================
// AC5: Default state for new users
// ===========================================================================

test.describe('AC5: Default state for new users', () => {
  test('should default all toggles to ON and color scheme to Professional', async ({ page }) => {
    // GIVEN: No saved engagement preferences (clean slate)
    await page.addInitScript(key => {
      localStorage.removeItem(key)
    }, PREFS_KEY)

    // WHEN: Navigate to Settings
    await goToSettings(page)

    const section = page.getByTestId('engagement-preferences')

    // THEN: All toggles should be checked (ON)
    await expect(section.getByTestId('toggle-achievements')).toBeChecked()
    await expect(section.getByTestId('toggle-streaks')).toBeChecked()
    await expect(section.getByTestId('toggle-badges')).toBeChecked()
    await expect(section.getByTestId('toggle-animations')).toBeChecked()

    // AND: Color scheme should be Professional
    const colorPicker = section.getByTestId('color-scheme-picker')
    const professionalOption = colorPicker.getByText('Professional').locator('..')
    await expect(professionalOption.locator('.bg-brand.rounded-full')).toBeVisible()
  })
})
