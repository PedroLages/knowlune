/**
 * E2E tests for E21-S07: Age-Appropriate Defaults & Font Scaling
 *
 * Tests:
 * - Welcome wizard appears on first visit, not on subsequent visits
 * - Age range selection updates recommended font size
 * - Font size picker in Settings persists and applies scaling
 * - Font scale CSS custom property updates on <html>
 */
import { test, expect } from '../../support/fixtures'

const WIZARD_STORAGE_KEY = 'knowlune-welcome-wizard-v1'
const SETTINGS_STORAGE_KEY = 'app-settings'

test.describe('E21-S07: Welcome Wizard', () => {
  test('shows wizard on first visit and closes on skip', async ({ page, localStorage }) => {
    await page.goto('/')

    // Wizard should appear automatically
    const wizard = page.getByTestId('welcome-wizard')
    await expect(wizard).toBeVisible()

    // Click "Skip for now"
    await page.getByTestId('wizard-skip').click()

    // Wizard should disappear
    await expect(wizard).not.toBeVisible()

    // Persist the completion marker
    const stored = await localStorage.get(WIZARD_STORAGE_KEY)
    expect(stored).toBeTruthy()
    expect((stored as { completedAt: string }).completedAt).toBeTruthy()
  })

  test('does not show wizard on subsequent visits', async ({ page, localStorage }) => {
    await page.goto('/')

    // Pre-seed: wizard already completed
    await localStorage.seed(WIZARD_STORAGE_KEY, {
      completedAt: '2026-01-01T00:00:00.000Z',
    })

    // Reload to trigger initialization with persisted state
    await page.reload()

    // Wait for the page to load
    await expect(page.locator('h1')).toBeVisible()

    // Wizard should NOT appear
    await expect(page.getByTestId('welcome-wizard')).not.toBeVisible()
  })

  test('completes full wizard flow: age selection -> font size -> finish', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    const wizard = page.getByTestId('welcome-wizard')
    await expect(wizard).toBeVisible()

    // Step 1: Welcome — click "Get Started"
    await page.getByTestId('wizard-start').click()

    // Step 2: Age selection — pick "Boomer"
    await page.getByTestId('age-option-boomer').click()
    await expect(page.getByTestId('age-option-boomer')).toHaveAttribute('aria-checked', 'true')

    // Continue to font step
    await page.getByTestId('wizard-continue').click()

    // Step 3: Font size — "Large" should be pre-selected (boomer default)
    // The Finish Setup button should be visible
    await page.getByTestId('wizard-finish').click()

    // Wizard closes
    await expect(wizard).not.toBeVisible()

    // Check settings persisted
    const settings = await localStorage.get<{ fontSize: string; ageRange: string }>(
      SETTINGS_STORAGE_KEY
    )
    expect(settings?.fontSize).toBe('large')
    expect(settings?.ageRange).toBe('boomer')

    // Font size CSS variable applied
    const fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim()
    )
    expect(fontSize).toBe('18px')
  })
})

test.describe('E21-S07: Font Size Settings', () => {
  test('font size picker changes root font-size', async ({ page, localStorage }) => {
    await page.goto('/')

    // Dismiss wizard first
    await localStorage.seed(WIZARD_STORAGE_KEY, {
      completedAt: '2026-01-01T00:00:00.000Z',
    })
    await page.reload()

    // Navigate to Settings
    await page.goto('/settings')
    await expect(page.locator('h1')).toContainText('Settings')

    // Find the Font Size section
    const fontSection = page.getByTestId('font-size-section')
    await expect(fontSection).toBeVisible()

    // Default should be "Medium" (16px)
    const mediumOption = fontSection.getByRole('radio', { name: /medium/i })
    await expect(mediumOption).toHaveAttribute('aria-checked', 'true')

    // Click "Extra Large"
    const xlOption = fontSection.getByRole('radio', { name: /extra large/i })
    await xlOption.click()
    await expect(xlOption).toHaveAttribute('aria-checked', 'true')

    // Verify CSS variable updated
    const fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim()
    )
    expect(fontSize).toBe('20px')

    // Verify persisted
    const settings = await localStorage.get<{ fontSize: string }>(SETTINGS_STORAGE_KEY)
    expect(settings?.fontSize).toBe('extra-large')
  })

  test('font size persists across page navigation', async ({ page, localStorage }) => {
    await page.goto('/')

    // Pre-seed: wizard done, font size set to large
    await localStorage.seed(WIZARD_STORAGE_KEY, {
      completedAt: '2026-01-01T00:00:00.000Z',
    })
    await localStorage.seed(SETTINGS_STORAGE_KEY, {
      displayName: 'Student',
      bio: '',
      theme: 'system',
      fontSize: 'large',
    })
    await page.reload()

    // Verify the CSS variable is applied
    const fontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim()
    )
    expect(fontSize).toBe('18px')

    // Navigate to a different page
    await page.goto('/courses')
    await expect(page.locator('h1')).toBeVisible()

    // Font size should still be 18px
    const fontSizeAfterNav = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim()
    )
    expect(fontSizeAfterNav).toBe('18px')
  })
})

test.describe('E21-S07: Proportional Scaling', () => {
  test('heading hierarchy is maintained at different font sizes', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Dismiss wizard and set font size
    await localStorage.seed(WIZARD_STORAGE_KEY, {
      completedAt: '2026-01-01T00:00:00.000Z',
    })
    await localStorage.seed(SETTINGS_STORAGE_KEY, {
      displayName: 'Student',
      bio: '',
      theme: 'system',
      fontSize: 'extra-large',
    })
    await page.reload()

    // Wait for the page heading to be visible
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()

    // Root font size should be 20px
    const rootFontSize = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim()
    )
    expect(rootFontSize).toBe('20px')

    // The h1 on the overview page should be rendered at a larger size than body text
    const h1FontSize = await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      return h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0
    })

    const bodyFontSize = await page.evaluate(() => {
      return parseFloat(getComputedStyle(document.body).fontSize)
    })

    // Both should be non-zero (page loaded)
    expect(h1FontSize).toBeGreaterThan(0)
    expect(bodyFontSize).toBeGreaterThan(0)

    // Heading should be larger than body text (hierarchy maintained)
    expect(h1FontSize).toBeGreaterThan(bodyFontSize)
  })
})
