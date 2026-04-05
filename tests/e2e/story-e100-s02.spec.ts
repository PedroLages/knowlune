/**
 * E2E Tests: E100-S02 — Clean Color Theme Settings UI & Visual QA
 *
 * Acceptance criteria covered:
 * - AC1: "Clean" option visible in Color Scheme picker alongside Professional and Vibrant
 * - AC2: Selecting Clean applies `.clean` class to `<html>` immediately
 * - AC3: Clean theme persists across navigation
 * - AC4: Clean theme restores from persisted storage on reload
 * - AC6: Switching back to Professional removes `.clean` class from `<html>`
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

/** Navigate to Settings > Learning section (where the color scheme picker lives). */
async function goToSettingsLearning(page: import('@playwright/test').Page): Promise<void> {
  // Color scheme picker is in EngagementPreferences, which is rendered in LearningSection
  await navigateAndWait(page, '/settings?section=learning')
  // Wait for the color scheme picker to be visible
  await page.waitForSelector('[data-testid="color-scheme-picker"]', {
    state: 'visible',
    timeout: 10000,
  })
}

/**
 * Click a color scheme option by its exact heading text.
 * The picker cards have both a heading span and a description paragraph.
 * We click the label element containing the scheme heading span (exact text match).
 */
async function selectColorScheme(
  page: import('@playwright/test').Page,
  scheme: 'Professional' | 'Vibrant' | 'Clean'
): Promise<void> {
  const picker = page.getByTestId('color-scheme-picker')
  // Each option is a <label> containing a <span class="text-sm font-medium"> with exact name.
  // Click the label that contains that span to activate the radio.
  await picker.locator(`label:has(span.text-sm.font-medium:text-is("${scheme}"))`).click()
}

test.describe('E100-S02: Clean Color Theme Settings UI', () => {
  test('AC1: Color scheme picker shows Professional, Vibrant, and Clean options', async ({
    page,
  }) => {
    await goToSettingsLearning(page)

    const picker = page.getByTestId('color-scheme-picker')
    await expect(picker).toBeVisible()

    // All three option headings are visible (exact match for the span text)
    await expect(picker.locator('span:text-is("Professional")')).toBeVisible()
    await expect(picker.locator('span:text-is("Vibrant")')).toBeVisible()
    await expect(picker.locator('span:text-is("Clean")')).toBeVisible()
  })

  test('AC2: Selecting Clean applies .clean class to <html>', async ({ page }) => {
    await goToSettingsLearning(page)

    // Verify no .clean class initially (default is Professional)
    let htmlClasses = await page.evaluate(() => document.documentElement.className)
    expect(htmlClasses).not.toContain('clean')

    // Click the Clean option
    await selectColorScheme(page, 'Clean')

    // Verify .clean class is applied
    htmlClasses = await page.evaluate(() => document.documentElement.className)
    expect(htmlClasses).toContain('clean')
  })

  test('AC6: Switching back to Professional removes .clean class from <html>', async ({
    page,
  }) => {
    await goToSettingsLearning(page)

    // First select Clean
    await selectColorScheme(page, 'Clean')

    // Verify .clean is applied
    let htmlClasses = await page.evaluate(() => document.documentElement.className)
    expect(htmlClasses).toContain('clean')

    // Switch back to Professional
    await selectColorScheme(page, 'Professional')

    // Verify .clean is removed
    htmlClasses = await page.evaluate(() => document.documentElement.className)
    expect(htmlClasses).not.toContain('clean')
  })

  test('AC4: Clean theme persists to localStorage and restores on reload', async ({ page }) => {
    await goToSettingsLearning(page)

    // Select Clean
    await selectColorScheme(page, 'Clean')

    // Verify .clean is applied
    let htmlClasses = await page.evaluate(() => document.documentElement.className)
    expect(htmlClasses).toContain('clean')

    // Verify localStorage was updated.
    // The colorScheme is stored in two places:
    // - 'app-settings' (read by useColorScheme hook on load)
    // - 'levelup-engagement-prefs-v1' (engagement prefs store)
    // We check 'app-settings' since that's what drives theme restoration on reload.
    const storedSettings = await page.evaluate(() => {
      const raw = localStorage.getItem('app-settings')
      if (!raw) return null
      try {
        return JSON.parse(raw) as Record<string, unknown>
      } catch {
        return null
      }
    })
    expect(storedSettings).not.toBeNull()
    expect(storedSettings?.colorScheme).toBe('clean')

    // Reload page and verify Clean theme is restored
    await page.reload()
    await page.waitForLoadState('load')

    htmlClasses = await page.evaluate(() => document.documentElement.className)
    expect(htmlClasses).toContain('clean')
  })

  test('AC3: Clean theme persists across page navigation', async ({ page }) => {
    await goToSettingsLearning(page)

    // Select Clean
    await selectColorScheme(page, 'Clean')

    // Navigate to Overview
    await navigateAndWait(page, '/')

    // Verify .clean class is still applied after navigation
    const htmlClasses = await page.evaluate(() => document.documentElement.className)
    expect(htmlClasses).toContain('clean')
  })
})
