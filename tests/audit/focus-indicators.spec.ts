/**
 * E66-S05: WCAG 2.4.13 Focus Appearance (AAA) audit.
 *
 * For each public route in light and dark themes, tab through every focusable
 * element and verify that the focus indicator (outline OR box-shadow ring)
 * has at least a 2px perimeter and >=3:1 contrast ratio against the resolved
 * effective background color of the focused element's nearest opaque ancestor.
 *
 * Compliance is satisfied if EITHER mechanism passes:
 *   - outline-style != 'none' AND outline-width >= 2 AND contrast(outline-color, bg) >= 3.0
 *   - leading box-shadow with spread >= 2px AND contrast(shadow-color, bg) >= 3.0
 */

import { test, expect, type Page } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'

type RouteSpec = { path: string; skip?: boolean; skipReason?: string }

const ROUTES: RouteSpec[] = [
  { path: '/' },
  { path: '/my-class' },
  { path: '/courses' },
  { path: '/reports' },
  { path: '/settings' },
]

const VIEWPORT = { width: 1440, height: 900 }
const MAX_TABS = 50
const MIN_OUTLINE_PX = 2
const MIN_CONTRAST = 3.0

type Finding = {
  route: string
  theme: 'light' | 'dark'
  tabIndex: number
  selector: string
  mechanism: 'outline' | 'box-shadow' | 'none'
  outlineWidthPx: number
  outlineStyle: string
  shadowSpreadPx: number
  indicatorColor: string
  backgroundColor: string
  contrastRatio: number
  reason: string
}

type Report = Omit<Finding, 'route' | 'theme' | 'tabIndex'> | null

/**
 * Runs in browser context. Inspects the active element's focus indicator and
 * resolves the effective background color of its nearest opaque ancestor.
 * Returns a finding when the indicator is non-compliant, or null when it passes.
 */
async function checkFocusIndicator(page: Page): Promise<Report> {
  return await page.evaluate(
    ({ MIN_OUTLINE_PX, MIN_CONTRAST }) => {
      const active = document.activeElement
      if (!active || active === document.body || active === document.documentElement) {
        return null
      }

      // ---- helpers (kept inline so they can be serialized) ----
      const parseRGB = (
        s: string
      ): { r: number; g: number; b: number; a: number } | null => {
        // matches rgb(...) and rgba(...) and the modern space-separated form
        const m = s.match(
          /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/i
        )
        if (!m) return null
        return {
          r: parseFloat(m[1]),
          g: parseFloat(m[2]),
          b: parseFloat(m[3]),
          a: m[4] !== undefined ? parseFloat(m[4]) : 1,
        }
      }

      const luminance = (r: number, g: number, b: number) => {
        const ch = (v: number) => {
          const c = v / 255
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
      }

      const contrast = (
        a: { r: number; g: number; b: number },
        b: { r: number; g: number; b: number }
      ) => {
        const la = luminance(a.r, a.g, a.b)
        const lb = luminance(b.r, b.g, b.b)
        const [hi, lo] = la > lb ? [la, lb] : [lb, la]
        return (hi + 0.05) / (lo + 0.05)
      }

      const effectiveBackground = (
        el: Element
      ): { r: number; g: number; b: number; a: number } => {
        let cur: Element | null = el
        while (cur && cur !== document.documentElement) {
          const cs = window.getComputedStyle(cur)
          const parsed = parseRGB(cs.backgroundColor)
          if (parsed && parsed.a > 0) return parsed
          cur = cur.parentElement
        }
        // Fallback: use html background or assume white.
        const htmlBg = parseRGB(window.getComputedStyle(document.documentElement).backgroundColor)
        if (htmlBg && htmlBg.a > 0) return htmlBg
        const isDark = document.documentElement.classList.contains('dark')
        return isDark
          ? { r: 26, g: 27, b: 38, a: 1 } // approx --background dark
          : { r: 250, g: 245, b: 238, a: 1 } // approx --background light
      }

      // ---- collect indicator data ----
      const cs = window.getComputedStyle(active)
      const outlineWidthPx = parseFloat(cs.outlineWidth || '0') || 0
      const outlineStyle = cs.outlineStyle || 'none'
      const outlineColorStr = cs.outlineColor || ''
      const shadowStr = cs.boxShadow || 'none'

      // Parse leading non-inset shadow: "0px 0px 0px Npx <color>" (4th length is spread).
      let shadowSpreadPx = 0
      let shadowColorStr = ''
      if (shadowStr && shadowStr !== 'none') {
        // Match the first shadow's color (rgb/rgba) and lengths in order.
        const colorMatch = shadowStr.match(/rgba?\([^)]+\)/)
        const lengths = shadowStr.match(/-?\d+(\.\d+)?px/g)
        if (colorMatch && lengths && lengths.length >= 4) {
          shadowColorStr = colorMatch[0]
          shadowSpreadPx = parseFloat(lengths[3])
        }
      }

      const bg = effectiveBackground(active)

      const buildSelector = (el: Element) => {
        const html = el as HTMLElement
        const tag = el.tagName.toLowerCase()
        const id = html.id ? `#${html.id}` : ''
        const aria = html.getAttribute('aria-label')
        const role = html.getAttribute('role')
        const cls =
          typeof html.className === 'string' && html.className
            ? `.${html.className.split(' ').filter(Boolean).slice(0, 2).join('.')}`
            : ''
        return `${tag}${id}${cls}${aria ? `[aria-label="${aria}"]` : ''}${
          role ? `[role="${role}"]` : ''
        }`
      }

      // ---- evaluate outline mechanism ----
      let outlinePass = false
      let outlineRatio = 0
      if (outlineStyle !== 'none' && outlineWidthPx >= MIN_OUTLINE_PX) {
        const oc = parseRGB(outlineColorStr)
        if (oc) {
          outlineRatio = contrast(oc, bg)
          if (outlineRatio >= MIN_CONTRAST) outlinePass = true
        }
      }

      // ---- evaluate box-shadow mechanism ----
      let shadowPass = false
      let shadowRatio = 0
      if (shadowSpreadPx >= MIN_OUTLINE_PX) {
        const sc = parseRGB(shadowColorStr)
        if (sc) {
          shadowRatio = contrast(sc, bg)
          if (shadowRatio >= MIN_CONTRAST) shadowPass = true
        }
      }

      if (outlinePass || shadowPass) return null

      const mechanism: 'outline' | 'box-shadow' | 'none' =
        outlineWidthPx >= MIN_OUTLINE_PX
          ? 'outline'
          : shadowSpreadPx >= MIN_OUTLINE_PX
            ? 'box-shadow'
            : 'none'

      const indicatorColor =
        mechanism === 'outline' ? outlineColorStr : shadowColorStr || '(none)'
      const ratio = mechanism === 'outline' ? outlineRatio : shadowRatio

      const reason =
        mechanism === 'none'
          ? 'No outline (>=2px) or box-shadow ring (spread >=2px) detected'
          : `Contrast ${ratio.toFixed(2)}:1 < ${MIN_CONTRAST}:1`

      return {
        selector: buildSelector(active),
        mechanism,
        outlineWidthPx,
        outlineStyle,
        shadowSpreadPx,
        indicatorColor,
        backgroundColor: `rgb(${bg.r},${bg.g},${bg.b})`,
        contrastRatio: parseFloat(ratio.toFixed(2)),
        reason,
      }
    },
    { MIN_OUTLINE_PX, MIN_CONTRAST }
  )
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    if (t === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, theme)
}

async function auditRoute(
  page: Page,
  route: RouteSpec,
  theme: 'light' | 'dark'
): Promise<Finding[]> {
  await page.goto(route.path)
  await page.waitForLoadState('networkidle')
  await setTheme(page, theme)

  const findings: Finding[] = []
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab')
    const result = await checkFocusIndicator(page)
    if (result) {
      findings.push({ route: route.path, theme, tabIndex: i + 1, ...result })
    }
    const stillFocused = await page.evaluate(
      () => document.activeElement && document.activeElement !== document.body
    )
    if (!stillFocused) break
  }

  return findings
}

test.describe('WCAG 2.4.13 focus-indicator audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT)
    await page.goto('/')
    // Seed sidebar collapsed to avoid mobile sheet overlay nuances at this width.
    await page.evaluate(() => {
      try {
        localStorage.setItem('knowlune-sidebar-v1', 'false')
      } catch {
        /* ignore */
      }
    })
    await dismissOnboarding(page)
  })

  for (const route of ROUTES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${route.path} (${theme} theme)`, async ({ page }) => {
        if (route.skip) {
          test.skip(true, route.skipReason || 'route excluded')
          return
        }

        const findings = await auditRoute(page, route, theme)

        if (findings.length > 0) {
          const report = findings
            .map(
              (f) =>
                `  Tab #${f.tabIndex} (${f.theme}) ${f.selector}\n    mechanism=${f.mechanism} outline=${f.outlineWidthPx}px ${f.outlineStyle} shadowSpread=${f.shadowSpreadPx}px color=${f.indicatorColor} bg=${f.backgroundColor} ratio=${f.contrastRatio}:1\n    reason: ${f.reason}`
            )
            .join('\n')
          // eslint-disable-next-line no-console
          console.log(
            `Focus indicator violations on ${route.path} (${theme}):\n${report}`
          )
        }

        expect(
          findings,
          `Focus indicator violations on ${route.path} (${theme} theme)`
        ).toEqual([])
      })
    }
  }
})
