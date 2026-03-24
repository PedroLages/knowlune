/**
 * E2E tests for E21-S04: Visual Energy Boost (Color Saturation)
 *
 * Validates the vibrant color scheme feature:
 * - AC1: Default professional mode is unchanged
 * - AC2: Vibrant mode activates via .vibrant class and overrides CSS custom properties
 * - AC3: Dark + vibrant mode combination works correctly
 * - AC4: Momentum badges respond to vibrant token overrides
 *
 * Seed strategy: localStorage seeding of `app-settings` with colorScheme preference.
 * No IDB seeding needed.
 */
import { test, expect } from '../../support/fixtures'

const APP_SETTINGS_KEY = 'app-settings'

test.describe('E21-S04: Visual Energy Boost', () => {
  test.describe('AC1 — Default professional mode unchanged', () => {
    test('does not apply .vibrant class by default', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const hasVibrant = await page.evaluate(() =>
        document.documentElement.classList.contains('vibrant')
      )
      expect(hasVibrant).toBe(false)
    })

    test('professional mode uses standard brand color token', async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // The --brand CSS property should NOT contain oklch values from vibrant overrides
      const brandValue = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()
      )

      // Professional light brand is #5e6ad2 (hex) — should not be an oklch value
      expect(brandValue).not.toContain('oklch')
    })
  })

  test.describe('AC2 — Vibrant mode activation', () => {
    test('applies .vibrant class when colorScheme is vibrant', async ({ page }) => {
      // Seed vibrant preference before navigation
      await page.addInitScript(() => {
        localStorage.setItem(
          'app-settings',
          JSON.stringify({
            displayName: 'Student',
            bio: '',
            theme: 'light',
            colorScheme: 'vibrant',
          })
        )
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const hasVibrant = await page.evaluate(() =>
        document.documentElement.classList.contains('vibrant')
      )
      expect(hasVibrant).toBe(true)
    })

    test('vibrant mode overrides --brand with OKLCH value', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem(
          'app-settings',
          JSON.stringify({
            displayName: 'Student',
            bio: '',
            theme: 'light',
            colorScheme: 'vibrant',
          })
        )
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const brandValue = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()
      )

      // Vibrant brand uses oklch(0.50 0.19 275)
      expect(brandValue).toContain('oklch')
    })

    test('vibrant mode overrides --success token', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem(
          'app-settings',
          JSON.stringify({
            displayName: 'Student',
            bio: '',
            theme: 'light',
            colorScheme: 'vibrant',
          })
        )
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const successValue = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--success').trim()
      )

      // Vibrant success uses oklch(0.47 0.14 155)
      expect(successValue).toContain('oklch')
    })

    test('vibrant mode overrides momentum tier tokens', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem(
          'app-settings',
          JSON.stringify({
            displayName: 'Student',
            bio: '',
            theme: 'light',
            colorScheme: 'vibrant',
          })
        )
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const hotValue = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--momentum-hot').trim()
      )
      const warmValue = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--momentum-warm').trim()
      )
      const coldValue = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--momentum-cold').trim()
      )

      expect(hotValue).toContain('oklch')
      expect(warmValue).toContain('oklch')
      expect(coldValue).toContain('oklch')
    })
  })

  test.describe('AC3 — Dark + vibrant combination', () => {
    test('supports .dark.vibrant dual-class mode', async ({ page }) => {
      await page.addInitScript(() => {
        // next-themes reads the "theme" key directly from localStorage
        localStorage.setItem('theme', 'dark')
        localStorage.setItem(
          'app-settings',
          JSON.stringify({
            displayName: 'Student',
            bio: '',
            theme: 'dark',
            colorScheme: 'vibrant',
          })
        )
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const classes = await page.evaluate(() => ({
        hasDark: document.documentElement.classList.contains('dark'),
        hasVibrant: document.documentElement.classList.contains('vibrant'),
      }))

      expect(classes.hasDark).toBe(true)
      expect(classes.hasVibrant).toBe(true)
    })

    test('dark vibrant uses dark-specific brand token', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'dark')
        localStorage.setItem(
          'app-settings',
          JSON.stringify({
            displayName: 'Student',
            bio: '',
            theme: 'dark',
            colorScheme: 'vibrant',
          })
        )
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const brandValue = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()
      )

      // Dark vibrant brand is oklch(0.58 0.18 275) — distinct from light vibrant
      expect(brandValue).toContain('oklch')
      // Should contain 0.58 lightness (dark vibrant) not 0.50 (light vibrant)
      expect(brandValue).toContain('0.58')
    })
  })

  test.describe('AC4 — Professional mode regression guard', () => {
    test('explicitly set professional mode does not add .vibrant class', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem(
          'app-settings',
          JSON.stringify({
            displayName: 'Student',
            bio: '',
            theme: 'light',
            colorScheme: 'professional',
          })
        )
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const hasVibrant = await page.evaluate(() =>
        document.documentElement.classList.contains('vibrant')
      )
      expect(hasVibrant).toBe(false)
    })

    test('legacy settings without colorScheme default to professional', async ({ page }) => {
      // Simulate pre-E21-S04 settings (no colorScheme key)
      await page.addInitScript(() => {
        localStorage.setItem(
          'app-settings',
          JSON.stringify({
            displayName: 'OldUser',
            bio: '',
            theme: 'light',
          })
        )
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const hasVibrant = await page.evaluate(() =>
        document.documentElement.classList.contains('vibrant')
      )
      expect(hasVibrant).toBe(false)
    })
  })
})
