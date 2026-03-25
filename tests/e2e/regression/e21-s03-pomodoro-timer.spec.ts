/**
 * E2E tests for E21-S03: Pomodoro Focus Timer
 *
 * Tests the Pomodoro timer integrated in the lesson player:
 * - AC1: Timer button visible in lesson player, opens popover with 25:00
 * - AC2: Start/pause/resume/reset controls work correctly
 * - AC3: Session counter tracks completed cycles
 * - AC4: Preferences persist across page reloads (localStorage)
 * - AC5: Audio notification fires on phase completion (AudioContext verified)
 *
 * Strategy: Navigate to a pre-seeded course lesson (operative-six), interact
 * with the Pomodoro popover. For time-based tests, we mock Date.now to
 * simulate countdown completion without waiting 25 minutes.
 */
import { test, expect } from '../../support/fixtures'

const LESSON_URL = '/courses/operative-six/op6-introduction'

test.describe('E21-S03: Pomodoro Focus Timer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LESSON_URL, { waitUntil: 'networkidle' })
  })

  test('AC1: timer button is visible and opens popover with default 25:00', async ({ page }) => {
    const trigger = page.getByTestId('pomodoro-trigger')
    await expect(trigger).toBeVisible()
    await expect(trigger).toHaveAccessibleName(/pomodoro focus timer/i)

    // Open popover
    await trigger.click()
    const popover = page.getByTestId('pomodoro-popover')
    await expect(popover).toBeVisible()

    // Default countdown should show 25:00
    const countdown = page.getByTestId('pomodoro-countdown')
    await expect(countdown).toHaveText('25:00')

    // Phase should be "Ready"
    const phase = page.getByTestId('pomodoro-phase')
    await expect(phase).toHaveText('Ready')
  })

  test('AC2: start transitions to focus phase and shows countdown on trigger', async ({ page }) => {
    await page.getByTestId('pomodoro-trigger').click()

    // Start the timer
    await page.getByTestId('pomodoro-start').click()

    // Phase should change to "Focus Time"
    await expect(page.getByTestId('pomodoro-phase')).toHaveText('Focus Time')

    // Trigger button should show remaining time
    const triggerTime = page.getByTestId('pomodoro-trigger-time')
    await expect(triggerTime).toBeVisible()

    // Pause and resume controls should appear
    await expect(page.getByTestId('pomodoro-pause')).toBeVisible()
    await expect(page.getByTestId('pomodoro-skip')).toBeVisible()
    await expect(page.getByTestId('pomodoro-reset')).toBeVisible()
  })

  test('AC2: pause freezes countdown, resume continues', async ({ page }) => {
    await page.getByTestId('pomodoro-trigger').click()
    await page.getByTestId('pomodoro-start').click()

    // eslint-disable-next-line test-patterns/no-hard-waits -- Intentional: real-time interval ticks needed to decrement countdown
    await page.waitForTimeout(2100)

    // Pause
    await page.getByTestId('pomodoro-pause').click()
    const pausedTime = await page.getByTestId('pomodoro-countdown').textContent()

    // eslint-disable-next-line test-patterns/no-hard-waits -- Intentional: verifying countdown stays frozen while paused
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('pomodoro-countdown')).toHaveText(pausedTime!)

    // Resume
    await page.getByTestId('pomodoro-resume').click()
    // eslint-disable-next-line test-patterns/no-hard-waits -- Intentional: real-time ticks after resume to confirm countdown progresses
    await page.waitForTimeout(1500)

    // Time should have decreased from paused value
    const resumedTime = await page.getByTestId('pomodoro-countdown').textContent()
    expect(resumedTime).not.toBe(pausedTime)
  })

  test('AC2: reset returns to idle state', async ({ page }) => {
    await page.getByTestId('pomodoro-trigger').click()
    await page.getByTestId('pomodoro-start').click()

    // Verify running
    await expect(page.getByTestId('pomodoro-phase')).toHaveText('Focus Time')

    // Reset
    await page.getByTestId('pomodoro-reset').click()

    // Should be back to idle
    await expect(page.getByTestId('pomodoro-phase')).toHaveText('Ready')
    await expect(page.getByTestId('pomodoro-countdown')).toHaveText('25:00')
    await expect(page.getByTestId('pomodoro-start')).toBeVisible()
  })

  test('AC2: skip advances from focus to break', async ({ page }) => {
    await page.getByTestId('pomodoro-trigger').click()
    await page.getByTestId('pomodoro-start').click()

    // Skip focus phase
    await page.getByTestId('pomodoro-skip').click()

    // Should transition to break (auto-start break is on by default)
    await expect(page.getByTestId('pomodoro-phase')).toHaveText('Break Time')
  })

  test('AC3: session counter increments after full cycle', async ({ page }) => {
    await page.getByTestId('pomodoro-trigger').click()

    // Initial sessions should be 0
    await expect(page.getByTestId('pomodoro-sessions')).toHaveText('0 sessions completed')

    // Start and skip focus
    await page.getByTestId('pomodoro-start').click()
    await page.getByTestId('pomodoro-skip').click()

    // Now in break phase - skip break to complete cycle
    await expect(page.getByTestId('pomodoro-phase')).toHaveText('Break Time')
    await page.getByTestId('pomodoro-skip').click()

    // Session counter should show 1
    await expect(page.getByTestId('pomodoro-sessions')).toHaveText('1 session completed')
  })

  test('AC4: preferences persist across page reloads', async ({ page }) => {
    await page.getByTestId('pomodoro-trigger').click()

    // Open preferences
    await page.getByTestId('pomodoro-prefs-toggle').click()
    await expect(page.getByTestId('pomodoro-preferences')).toBeVisible()

    // Change focus duration from 25 to 20
    const decreaseBtn = page.getByLabel('Decrease focus duration')
    await decreaseBtn.click() // 25 -> 20

    // Verify change took effect on countdown display
    await expect(page.getByTestId('pomodoro-countdown')).toHaveText('20:00')

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' })

    // Re-open popover
    await page.getByTestId('pomodoro-trigger').click()

    // Countdown should still show 20:00 (persisted preference)
    await expect(page.getByTestId('pomodoro-countdown')).toHaveText('20:00')
  })

  test('AC5: audio notification fires via AudioContext', async ({ page }) => {
    // Track AudioContext creation
    await page.evaluate(() => {
      ;(window as unknown as { __audioContextCreated: boolean }).__audioContextCreated = false
      const OrigAudioContext = window.AudioContext
      window.AudioContext = class extends OrigAudioContext {
        constructor() {
          super()
          ;(window as unknown as { __audioContextCreated: boolean }).__audioContextCreated = true
        }
      }
    })

    await page.getByTestId('pomodoro-trigger').click()
    await page.getByTestId('pomodoro-start').click()

    // Skip focus to trigger audio notification
    await page.getByTestId('pomodoro-skip').click()

    // Verify AudioContext was created (chime played)
    const audioCreated = await page.evaluate(
      () => (window as unknown as { __audioContextCreated: boolean }).__audioContextCreated
    )
    expect(audioCreated).toBe(true)
  })

  test('accessibility: timer has proper ARIA attributes', async ({ page }) => {
    await page.getByTestId('pomodoro-trigger').click()

    // Countdown should have role="timer"
    const countdown = page.getByTestId('pomodoro-countdown')
    await expect(countdown).toHaveAttribute('role', 'timer')

    // Phase indicator should have aria-live
    const phase = page.getByTestId('pomodoro-phase')
    await expect(phase).toHaveAttribute('aria-live', 'polite')

    // Start button should have aria-label
    const startBtn = page.getByTestId('pomodoro-start')
    await expect(startBtn).toHaveAccessibleName('Start focus timer')
  })

  test('preferences toggles work correctly', async ({ page }) => {
    await page.getByTestId('pomodoro-trigger').click()
    await page.getByTestId('pomodoro-prefs-toggle').click()

    // Toggle auto-start break off
    const autoBreakSwitch = page.getByTestId('pomodoro-auto-break')
    await autoBreakSwitch.click()

    // Start and skip focus — should NOT auto-start break
    await page.getByTestId('pomodoro-start').click()
    await page.getByTestId('pomodoro-skip').click()

    // Should show break phase but stopped (not running)
    await expect(page.getByTestId('pomodoro-phase')).toHaveText('Break Time')
    // Should show a start button for break instead of pause
    await expect(page.getByTestId('pomodoro-start-phase')).toBeVisible()
  })
})
