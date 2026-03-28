/**
 * E2E tests for E51-S02: Reduced Motion Toggle with Global MotionConfig.
 *
 * Tests cover:
 * - Select "Reduce motion" -> verify .reduce-motion class on <html>
 * - Select "Allow all motion" -> verify no .reduce-motion class
 * - Select "Follow system" -> verify behavior matches OS preference
 * - Reload page -> verify saved preference re-applied
 * - Verify RadioGroup keyboard navigation (arrow keys)
 */
import { test, expect } from '../support/fixtures'
import { goToSettings } from '../support/helpers/navigation'

test.describe('E51-S02: Reduced Motion Toggle', () => {
  test('selecting "Reduce motion" adds .reduce-motion class to <html>', async ({ page }) => {
    await goToSettings(page)

    // Find the Display & Accessibility section
    const section = page.getByTestId('display-accessibility-section')
    await expect(section).toBeVisible()

    // Select "Reduce motion" radio option
    const reduceMotionRadio = section.getByLabel('Reduce motion')
    await reduceMotionRadio.click()

    // Verify .reduce-motion class is on <html>
    await expect(page.locator('html.reduce-motion')).toBeAttached()
  })

  test('selecting "Allow all motion" removes .reduce-motion class', async ({ page }) => {
    // Pre-seed settings with reduceMotion: 'on' so we start with .reduce-motion
    await page.addInitScript(() => {
      const existing = localStorage.getItem('app-settings')
      const settings = existing ? JSON.parse(existing) : {}
      settings.reduceMotion = 'on'
      localStorage.setItem('app-settings', JSON.stringify(settings))
    })

    await goToSettings(page)

    // Confirm .reduce-motion is present initially
    await expect(page.locator('html.reduce-motion')).toBeAttached()

    const section = page.getByTestId('display-accessibility-section')
    await expect(section).toBeVisible()

    // Select "Allow all motion"
    const allowAllRadio = section.getByLabel('Allow all motion')
    await allowAllRadio.click()

    // Verify .reduce-motion class is removed
    await expect(page.locator('html.reduce-motion')).not.toBeAttached()
  })

  test('selecting "Follow system" respects OS prefers-reduced-motion', async ({ page }) => {
    // Emulate OS prefers-reduced-motion: reduce
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await goToSettings(page)

    const section = page.getByTestId('display-accessibility-section')
    await expect(section).toBeVisible()

    // Select "Follow system"
    const followSystemRadio = section.getByLabel('Follow system')
    await followSystemRadio.click()

    // With OS reduced motion ON + "Follow system", class should be present
    await expect(page.locator('html.reduce-motion')).toBeAttached()

    // Now emulate OS without reduced motion
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    // Class should be removed when OS says no-preference
    await expect(page.locator('html.reduce-motion')).not.toBeAttached()
  })

  test('saved preference is re-applied after page reload', async ({ page }) => {
    await goToSettings(page)

    const section = page.getByTestId('display-accessibility-section')
    await expect(section).toBeVisible()

    // Select "Reduce motion"
    const reduceMotionRadio = section.getByLabel('Reduce motion')
    await reduceMotionRadio.click()

    // Verify class is applied
    await expect(page.locator('html.reduce-motion')).toBeAttached()

    // Reload the page
    await page.reload()
    await page.waitForLoadState('load')

    // Verify class is still present after reload (flash prevention script)
    await expect(page.locator('html.reduce-motion')).toBeAttached()

    // Verify the radio button still shows "Reduce motion" as selected
    const section2 = page.getByTestId('display-accessibility-section')
    await expect(section2).toBeVisible()
    const radioItem = section2.locator('#motion-on')
    await expect(radioItem).toBeChecked()
  })

  test('RadioGroup supports keyboard navigation with arrow keys', async ({ page }) => {
    await goToSettings(page)

    const section = page.getByTestId('display-accessibility-section')
    await expect(section).toBeVisible()

    // Focus the first radio item by clicking "Follow system"
    const followSystemRadio = section.getByLabel('Follow system')
    await followSystemRadio.click()

    // The radio input should be focused
    const systemRadioInput = section.locator('#motion-system')
    await expect(systemRadioInput).toBeChecked()

    // Press ArrowDown to move to "Reduce motion"
    await page.keyboard.press('ArrowDown')
    const reduceRadioInput = section.locator('#motion-on')
    await expect(reduceRadioInput).toBeChecked()

    // Press ArrowDown to move to "Allow all motion"
    await page.keyboard.press('ArrowDown')
    const allowAllRadioInput = section.locator('#motion-off')
    await expect(allowAllRadioInput).toBeChecked()

    // Press ArrowDown to wrap around to "Follow system"
    await page.keyboard.press('ArrowDown')
    await expect(systemRadioInput).toBeChecked()
  })
})
