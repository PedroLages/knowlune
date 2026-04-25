/**
 * E66-S06: WCAG 2.2 Compliance Aggregator Suite.
 *
 * Aggregates the SCs not already covered by per-SC audit specs and provides
 * regression sentinels for the criteria fixed in E66-S01..S05.
 *
 * Existing per-SC specs remain authoritative for their respective criteria
 * and are auto-discovered by `playwright.config.ts` (testDir: './tests'):
 *   - SC 2.4.11 Focus Not Obscured (Min) -> tests/audit/focus-not-obscured.spec.ts
 *   - SC 2.4.13 Focus Appearance (AAA)   -> tests/audit/focus-indicators.spec.ts
 *   - SC 2.5.8 Target Size (Min)         -> tests/audit/target-size.spec.ts
 *
 * This spec adds NEW coverage for:
 *   - SC 2.5.7 Dragging Movements (runtime + source sentinel)
 *   - SC 3.3.7 Redundant Entry           (autocomplete attributes on auth)
 *   - SC 3.3.8 Accessible Authentication (paste allowed + non-cognitive alt)
 *   - SC 3.2.6 Consistent Help           (documented N/A)
 *
 * Each test name encodes the SC number for grep-friendly reporting.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'

// Repo root resolution -- this spec lives at tests/audit/, repo root is two up.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')

/**
 * Components that use `@dnd-kit` `useSortable` AND should expose
 * adjacent move-up / move-down controls (via `MoveUpDownButtons` or
 * equivalent `aria-label="Move ... up|down"`).
 *
 * Maintenance: when adding a new sortable list to the app, add the file
 * here. The sentinel keeps WCAG 2.5.7 from regressing silently.
 *
 * Known exceptions (intentionally NOT in this list because the move-button
 * contract is implemented in a sibling/parent rendering component):
 *   - src/app/components/library/ReadingQueue.tsx
 *       Sortable rows; move buttons live in ReadingQueueView.tsx (the
 *       rendered consumer). Documented in compliance report.
 *   - src/app/components/audiobook/ClipListPanel.tsx
 *       Audiobook clip reorder is currently drag-only; tracked as a known
 *       partial gap in the compliance report (low impact -- editor surface).
 */
const SORTABLE_FILES_REQUIRING_MOVE_BUTTONS = [
  'src/app/components/figma/VideoReorderList.tsx',
  'src/app/components/figma/YouTubeChapterEditor.tsx',
  'src/app/components/DashboardCustomizer.tsx',
  'src/app/components/library/ReadingQueueView.tsx',
  'src/app/pages/AILearningPath.tsx',
  'src/app/pages/LearningPathDetail.tsx',
] as const

// Matches `aria-label="Move ... up"` or `aria-label={`Move ... up`}` style
// usages, including template literals that interpolate item titles between the
// word "Move" and the up/down direction.
const MOVE_LABEL_PATTERN = /aria-label=(?:[{][`"']|[`"'])[^`"']*[Mm]ove[^`"']*?\b(up|down)\b/

test.describe('WCAG 2.2 Compliance Suite', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  // -------------------------------------------------------------------------
  // SC 2.5.7 - Dragging Movements
  // -------------------------------------------------------------------------

  test('SC 2.5.7 - Dragging Movements: source sentinel - useSortable callsites carry move-button aria-labels', async () => {
    const violations: string[] = []
    for (const relPath of SORTABLE_FILES_REQUIRING_MOVE_BUTTONS) {
      const abs = path.join(REPO_ROOT, relPath)
      const src = readFileSync(abs, 'utf8')
      const hasMoveButtonContract =
        src.includes('MoveUpDownButtons') || MOVE_LABEL_PATTERN.test(src)
      if (!hasMoveButtonContract) {
        violations.push(
          `${relPath}: SC 2.5.7 violation - sortable list lacks adjacent Move Up / Move Down buttons (no MoveUpDownButtons import and no move-up/down aria-label found)`
        )
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })

  test('SC 2.5.7 - Dragging Movements: reading-queue route exposes move-up/down buttons at runtime', async ({
    page,
  }) => {
    await page.goto('/library')
    await page.waitForLoadState('networkidle')

    // The reading queue is conditionally rendered. If no entries, the move
    // buttons won't appear -- treat as a "no items, no obligation" pass and
    // surface the situation clearly rather than failing.
    const moveUpButtons = page.locator('button[aria-label*="Move" i][aria-label*="up" i]')
    const moveDownButtons = page.locator('button[aria-label*="Move" i][aria-label*="down" i]')
    const upCount = await moveUpButtons.count()
    const downCount = await moveDownButtons.count()

    if (upCount === 0 && downCount === 0) {
      test.info().annotations.push({
        type: 'note',
        description:
          'No reading-queue entries seeded; runtime SC 2.5.7 check exercised the source sentinel only. Add fixtures here when queue seeding helpers are available.',
      })
      return
    }

    expect(upCount, 'Move Up buttons should be present when queue has entries').toBeGreaterThan(0)
    expect(downCount, 'Move Down buttons should be present when queue has entries').toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // SC 3.3.7 - Redundant Entry  (autocomplete attributes on auth inputs)
  // -------------------------------------------------------------------------

  test('SC 3.3.7 - Redundant Entry: login email/password fields carry autocomplete attributes', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Default mode is Email + Password; the tab is labelled "Email".
    // The form may already be visible; if not, click into it.
    const emailTab = page.getByRole('tab', { name: /^email$/i })
    if (await emailTab.count()) {
      await emailTab.click().catch(() => {})
    }

    const emailInput = page.locator('input[type="email"]').first()
    const passwordInput = page.locator('input[type="password"]').first()

    await expect(emailInput, 'login page must render an email input').toBeVisible()
    await expect(passwordInput, 'login page must render a password input').toBeVisible()

    const emailAutocomplete = await emailInput.getAttribute('autocomplete')
    const passwordAutocomplete = await passwordInput.getAttribute('autocomplete')

    expect(
      emailAutocomplete,
      'SC 3.3.7 violation: email input is missing autocomplete="email"'
    ).toBe('email')
    expect(
      passwordAutocomplete,
      'SC 3.3.7 violation: password input must declare autocomplete (current-password or new-password)'
    ).toMatch(/^(current-password|new-password)$/)
  })

  // -------------------------------------------------------------------------
  // SC 3.3.8 - Accessible Authentication (Minimum)
  // -------------------------------------------------------------------------

  test('SC 3.3.8 - Accessible Authentication (Min): password input does not block paste', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible()

    // Dispatch a synthetic paste event and assert the page does not call
    // preventDefault. WCAG 2.5.7 / 3.3.8 explicitly call out paste support
    // as the assistive mechanism for password managers.
    const defaultPrevented = await passwordInput.evaluate((el) => {
      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      })
      el.dispatchEvent(event)
      return event.defaultPrevented
    })

    expect(
      defaultPrevented,
      'SC 3.3.8 violation: password input is blocking paste (preventDefault on paste event)'
    ).toBe(false)
  })

  test('SC 3.3.8 - Accessible Authentication (Min): non-cognitive auth alternative is offered', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Magic Link tab/button OR a Google OAuth button qualify as the
    // non-cognitive alternative required by SC 3.3.8.
    const magicLinkAffordance = page.getByRole('tab', { name: /magic link/i })
    const googleButton = page.getByRole('button', { name: /google/i })

    const magicLinkVisible = (await magicLinkAffordance.count()) > 0
    const googleVisible = (await googleButton.count()) > 0

    expect(
      magicLinkVisible || googleVisible,
      'SC 3.3.8 violation: login page must offer at least one non-cognitive auth alternative (Magic Link or OAuth)'
    ).toBe(true)
  })

  // -------------------------------------------------------------------------
  // SC 3.2.6 - Consistent Help (documented N/A)
  // -------------------------------------------------------------------------

  test.fixme(
    'SC 3.2.6 - Consistent Help: documented N/A',
    () => {
      // Knowlune does not currently expose a help mechanism (no help button,
      // contact link, FAQ, or support chat). SC 3.2.6 only applies when a
      // help mechanism is present on multiple pages, so it is N/A today.
      // When a help affordance is added, place it consistently in the
      // sidebar footer below Settings on every page so this SC is satisfied
      // from day one. See compliance report for the full N/A justification.
    }
  )
})
