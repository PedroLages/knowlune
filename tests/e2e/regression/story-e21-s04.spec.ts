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

      // Dark vibrant brand is oklch(0.57 0.18 275) — distinct from light vibrant
      expect(brandValue).toContain('oklch')
      // Should contain 0.57 lightness (dark vibrant) not 0.50 (light vibrant)
      expect(brandValue).toContain('0.57')
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

  test.describe('AC4 — prefers-reduced-motion instant color transition', () => {
    test('vibrant mode color change has no transition when reduced motion is preferred', async ({
      page,
    }) => {
      // Enable reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' })

      // Seed vibrant color scheme
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

      // Verify vibrant class is applied
      const hasVibrant = await page.evaluate(() =>
        document.documentElement.classList.contains('vibrant')
      )
      expect(hasVibrant).toBe(true)

      // Check that transition-duration is effectively 0 on all elements
      // The global prefers-reduced-motion rule in index.css sets:
      //   transition-duration: 0.01ms !important
      const transitionDuration = await page.evaluate(() => {
        const body = document.body
        return getComputedStyle(body).transitionDuration
      })

      // Should be 0s or 0.01ms (effectively instant) — not 300ms
      const durationMs = parseFloat(transitionDuration)
      // transitionDuration returns in 's' units: 0s or 0.00001s (0.01ms)
      expect(durationMs).toBeLessThanOrEqual(0.01)

      // Also verify on <html> element itself
      const rootTransition = await page.evaluate(() =>
        getComputedStyle(document.documentElement).transitionDuration
      )
      const rootDurationMs = parseFloat(rootTransition)
      expect(rootDurationMs).toBeLessThanOrEqual(0.01)
    })
  })

  test.describe('AC1 — WCAG contrast ratio validation', () => {
    /**
     * Parses a CSS color string into [r, g, b] in 0-255 range.
     * Handles rgb(), rgba(), hex (#rrggbb), and oklch() formats.
     * For oklch(), uses the canvas 2D fillStyle round-trip to convert to hex.
     */
    function parseColor(color: string): [number, number, number] {
      // Try rgb()/rgba() first
      const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (rgbMatch) {
        return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]
      }
      // Try hex (#rrggbb or #rgb)
      const hexMatch = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
      if (hexMatch) {
        return [parseInt(hexMatch[1], 16), parseInt(hexMatch[2], 16), parseInt(hexMatch[3], 16)]
      }
      throw new Error(`Cannot parse color: ${color}`)
    }

    /** Compute relative luminance per WCAG 2.1 definition */
    function relativeLuminance([r, g, b]: [number, number, number]): number {
      const [rs, gs, bs] = [r, g, b].map(c => {
        const s = c / 255
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
    }

    /** Compute WCAG contrast ratio between two colors */
    function contrastRatio(c1: [number, number, number], c2: [number, number, number]): number {
      const l1 = relativeLuminance(c1)
      const l2 = relativeLuminance(c2)
      const lighter = Math.max(l1, l2)
      const darker = Math.min(l1, l2)
      return (lighter + 0.05) / (darker + 0.05)
    }

    test('vibrant brand foreground on brand background meets 4.5:1', async ({ page }) => {
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

      const colors = await page.evaluate(() => {
        // Resolve any CSS color (oklch, color-mix, hex) to rgb() via canvas pixel readback
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        function resolveToRgb(cssColor: string): string {
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = cssColor
          ctx.fillRect(0, 0, 1, 1)
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
          return `rgb(${r}, ${g}, ${b})`
        }

        const style = getComputedStyle(document.documentElement)
        return {
          brand: resolveToRgb(style.getPropertyValue('--brand').trim()),
          brandFg: resolveToRgb(style.getPropertyValue('--brand-foreground').trim()),
          brandSoft: resolveToRgb(style.getPropertyValue('--brand-soft').trim()),
          brandSoftFg: resolveToRgb(style.getPropertyValue('--brand-soft-foreground').trim()),
        }
      })

      // Brand foreground (white) on brand background
      const brandBg = parseColor(colors.brand)
      const brandFg = parseColor(colors.brandFg)
      const ratio = contrastRatio(brandBg, brandFg)
      expect(ratio).toBeGreaterThanOrEqual(4.5)

      // Brand-soft-foreground on brand-soft background
      const softBg = parseColor(colors.brandSoft)
      const softFg = parseColor(colors.brandSoftFg)
      const softRatio = contrastRatio(softBg, softFg)
      expect(softRatio).toBeGreaterThanOrEqual(4.5)
    })

    test('dark vibrant brand foreground on brand background meets 4.5:1', async ({ page }) => {
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

      const colors = await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        function resolveToRgb(cssColor: string): string {
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = cssColor
          ctx.fillRect(0, 0, 1, 1)
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
          return `rgb(${r}, ${g}, ${b})`
        }

        const style = getComputedStyle(document.documentElement)
        return {
          brand: resolveToRgb(style.getPropertyValue('--brand').trim()),
          brandFg: resolveToRgb(style.getPropertyValue('--brand-foreground').trim()),
        }
      })

      const brandBg = parseColor(colors.brand)
      const brandFg = parseColor(colors.brandFg)
      const ratio = contrastRatio(brandBg, brandFg)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })
  })
})
