/**
 * WCAG 2.5.8 Target Size (Minimum) audit helpers.
 *
 * Pure logic for collecting interactive element rects and detecting
 * violations of the 24x24 px target-size floor with the spacing exception.
 *
 * The rect collection function is page-side (uses Playwright); the violation
 * detection function is Node-side and unit-testable with synthetic input.
 */

import type { Page } from '@playwright/test'

/** Selector matching every interactive element in scope per the story. */
export const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="slider"]',
  'input:not([type="hidden"])',
  'select',
].join(', ')

/** WCAG 2.5.8 minimum target size (CSS pixels). */
export const MIN_TARGET_PX = 24

export type RectInfo = {
  selector: string
  tag: string
  role: string | null
  ariaLabel: string | null
  text: string
  width: number
  height: number
  x: number
  y: number
  excluded: boolean
  excludeReason?: string
}

export type Violation = {
  selector: string
  tag: string
  role: string | null
  ariaLabel: string | null
  text: string
  width: number
  height: number
  nearestNeighborDistance: number
}

/**
 * L-infinity (Chebyshev) distance between two rects: the minimum gap along
 * the X or Y axis. Returns 0 if the rects overlap on both axes.
 *
 * WCAG 2.5.8 spacing exception applies when this distance is >= 24 px to
 * every other interactive neighbor.
 */
export function rectDistance(a: RectInfo, b: RectInfo): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)))
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)))
  // L-infinity: nearest edge gap is the larger of the two axis gaps when
  // both are positive; when one is zero (axis-aligned overlap), the smaller
  // axis gap dominates. We treat "nearest neighbor distance" as the minimum
  // of the two so any direction with insufficient clearance counts.
  if (dx === 0 && dy === 0) return 0
  if (dx === 0) return dy
  if (dy === 0) return dx
  return Math.min(dx, dy)
}

/**
 * Find all rects that are below the minimum target size AND lack the
 * spacing exception (>= 24 px from every other interactive neighbor).
 *
 * Excluded rects (per the exclusion predicate at collection time) are
 * skipped as both subjects and as neighbors.
 */
export function findViolations(rects: RectInfo[]): Violation[] {
  const live = rects.filter(r => !r.excluded && r.width > 0 && r.height > 0)
  const violations: Violation[] = []

  for (const r of live) {
    const tooSmall = r.width < MIN_TARGET_PX || r.height < MIN_TARGET_PX
    if (!tooSmall) continue

    let nearest = Infinity
    for (const other of live) {
      if (other === r) continue
      const d = rectDistance(r, other)
      if (d < nearest) nearest = d
      if (nearest === 0) break
    }

    // Spacing exception: < 24 px gap to nearest neighbor means the element
    // does not qualify for the WCAG 2.5.8 spacing carve-out and must meet
    // the size floor itself.
    if (nearest < MIN_TARGET_PX) {
      violations.push({
        selector: r.selector,
        tag: r.tag,
        role: r.role,
        ariaLabel: r.ariaLabel,
        text: r.text,
        width: r.width,
        height: r.height,
        nearestNeighborDistance: nearest === Infinity ? -1 : nearest,
      })
    }
  }

  return violations
}

/**
 * Collect bounding rects + classification metadata for every in-scope
 * interactive element on the current page. Runs in the browser via
 * page.evaluate (single round-trip).
 */
export async function collectInteractiveRects(page: Page): Promise<RectInfo[]> {
  return page.evaluate((selector: string) => {
    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[]

    function isHidden(el: HTMLElement): boolean {
      const style = window.getComputedStyle(el)
      if (style.display === 'none') return true
      if (style.visibility === 'hidden' || style.visibility === 'collapse') return true
      if (el.getAttribute('aria-hidden') === 'true') return true
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return true
      return false
    }

    function isScreenReaderOnly(el: HTMLElement): boolean {
      // sr-only / visually-hidden patterns clip to 1x1; they only show on
      // focus (skip links). WCAG 2.5.8 doesn't apply to elements that are
      // visually hidden by design.
      if (el.classList.contains('sr-only')) return true
      if (el.classList.contains('visually-hidden')) return true
      return false
    }

    function isInlineLink(el: HTMLElement): boolean {
      if (el.tagName.toLowerCase() !== 'a') return false
      // Inline-text exception (WCAG 2.5.8): the link sits in a run of text
      // whose size is constrained by surrounding line-height. Detect this by
      // checking whether the link's parent contains meaningful sibling text
      // and the parent itself is rendered inline-ish (not a flex/grid row).
      const parent = el.parentElement
      if (!parent) return false
      const parentTag = parent.tagName.toLowerCase()
      if (parentTag === 'p') return true

      // Generic container heuristic: parent has direct text content beyond
      // the link's own text, AND parent is not laid out as a flex/grid row
      // (which signals a chip/button row, not prose).
      const parentText = (parent.textContent || '').trim()
      const ownText = (el.textContent || '').trim()
      const hasSurroundingText = parentText.length > ownText.length + 3
      if (!hasSurroundingText) return false

      const parentDisplay = window.getComputedStyle(parent).display
      const isProseLayout =
        parentDisplay === 'block' ||
        parentDisplay === 'inline' ||
        parentDisplay === 'inline-block'
      return isProseLayout
    }

    function isNativeSelectChrome(el: HTMLElement): boolean {
      return el.tagName.toLowerCase() === 'select'
    }

    function isThirdPartyDevWidget(el: HTMLElement): boolean {
      // The `agentation` dev-mode visual feedback toolbar is rendered into
      // the page via portal in development only (see App.tsx). Its controls
      // are out of scope for Knowlune's WCAG conformance.
      let cur: HTMLElement | null = el
      while (cur) {
        if (cur.hasAttribute('data-feedback-toolbar')) return true
        if (cur.hasAttribute('data-annotation-popup')) return true
        if (cur.hasAttribute('data-annotation-marker')) return true
        cur = cur.parentElement
      }
      // Class-name fallback (CSS-Modules hashed names from agentation).
      const cls = typeof el.className === 'string' ? el.className : ''
      if (cls.includes('styles-module__')) return true
      return false
    }

    function shortSelector(el: HTMLElement): string {
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const testId = el.getAttribute('data-testid')
      const testIdPart = testId ? `[data-testid="${testId}"]` : ''
      const cls = el.className && typeof el.className === 'string'
        ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
        : ''
      return `${tag}${id}${testIdPart}${cls}`.slice(0, 200)
    }

    return elements.map(el => {
      const rect = el.getBoundingClientRect()
      const hidden = isHidden(el)
      const srOnly = !hidden && isScreenReaderOnly(el)
      const inlineLink = !hidden && !srOnly && isInlineLink(el)
      const nativeSelect = !hidden && !srOnly && isNativeSelectChrome(el)
      const thirdParty = !hidden && !srOnly && isThirdPartyDevWidget(el)
      const excluded = hidden || srOnly || inlineLink || nativeSelect || thirdParty
      let excludeReason: string | undefined
      if (hidden) excludeReason = 'hidden'
      else if (srOnly) excludeReason = 'sr-only'
      else if (inlineLink) excludeReason = 'inline-link-in-prose'
      else if (nativeSelect) excludeReason = 'native-select'
      else if (thirdParty) excludeReason = 'third-party-dev-widget'

      return {
        selector: shortSelector(el),
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        text: (el.textContent || '').trim().slice(0, 40),
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        excluded,
        excludeReason,
      }
    })
  }, INTERACTIVE_SELECTOR)
}
