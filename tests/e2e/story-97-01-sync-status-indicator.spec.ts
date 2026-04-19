/**
 * E97-S01: Sync Status Indicator in Header
 *
 * Validates that the header indicator renders with role="status", opens a
 * Popover with status copy, reflects pendingCount via a badge, and swaps to
 * an offline appearance when the browser dispatches an `offline` event.
 *
 * Patterns follow `.claude/rules/testing/test-patterns.md` — no Date.now(),
 * no waitForTimeout, shared IndexedDB seeding, deterministic polling via
 * waitForFunction.
 *
 * @since E97-S01
 */
import { test, expect } from '../support/fixtures'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { FIXED_DATE } from '../utils/test-time'
import { seedSyncQueue } from '../support/helpers/indexeddb-seed'

test.describe('E97-S01: Sync Status Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('indicator renders in header and live region carries role=status', async ({ page }) => {
    // The button itself no longer carries role=status (that overrides the native
    // button role). The polite live region (a sibling sr-only span) holds it.
    const indicator = page.getByTestId('sync-status-indicator')
    await expect(indicator).toBeVisible()
    // Button must NOT override its own role — aria-label provides the accessible name.
    await expect(indicator).not.toHaveAttribute('role', 'status')
    // Sibling live region exists and carries role=status.
    const liveRegion = page.locator('[role="status"][aria-live="polite"]')
    await expect(liveRegion).toBeAttached()
  })

  test('clicking the indicator opens the Popover with status copy', async ({ page }) => {
    const indicator = page.getByTestId('sync-status-indicator')
    await indicator.click()
    // "Last sync" label is present in the popover body.
    await expect(page.getByText(/last sync/i).first()).toBeVisible()
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })

  test('badge shows the pendingCount when syncQueue has pending rows', async ({ page }) => {
    // Seed syncQueue via shared helper (follows test-patterns.md mandate — no
    // inline raw indexedDB.open() blocks in spec files).
    await seedSyncQueue(page, [
      { id: 'q-1', table: 'notes', op: 'upsert', status: 'pending', createdAt: FIXED_DATE },
      { id: 'q-2', table: 'notes', op: 'upsert', status: 'pending', createdAt: FIXED_DATE },
      { id: 'q-3', table: 'notes', op: 'upsert', status: 'pending', createdAt: FIXED_DATE },
    ])

    // Opening the popover triggers refreshPendingCount.
    await page.getByTestId('sync-status-indicator').click()

    const badge = page.getByTestId('sync-status-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText(/^3$/)
  })

  test('indicator swaps to offline status after an offline event', async ({ page }) => {
    await page.evaluate(() => {
      // Force navigator.onLine to report false, then dispatch the event.
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      })
      window.dispatchEvent(new Event('offline'))
    })

    // Poll navigator.onLine via waitForFunction rather than using a hard wait —
    // ESLint test-patterns/no-hard-waits blocks waitForTimeout.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="sync-status-indicator"]')
      return el?.getAttribute('data-sync-status') === 'offline'
    })

    const indicator = page.getByTestId('sync-status-indicator')
    await expect(indicator).toHaveAttribute('data-sync-status', 'offline')
    await expect(indicator).toHaveAttribute('aria-label', /offline/i)
  })

  test('offline popover copy reminds the user they are offline', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      })
      window.dispatchEvent(new Event('offline'))
    })

    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="sync-status-indicator"]')
      return el?.getAttribute('data-sync-status') === 'offline'
    })

    await page.getByTestId('sync-status-indicator').click()
    await expect(page.getByText(/you're offline/i)).toBeVisible()
  })

  test('indicator is visible and tappable at 375px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    await page.waitForLoadState('domcontentloaded')

    const indicator = page.getByTestId('sync-status-indicator')
    await expect(indicator).toBeVisible()

    const box = await indicator.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  test('reduced-motion emulation removes animate-spin from the icon', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // Force the indicator into 'syncing' via the dev-only window.__syncStatusStore
    // shim (useSyncStatusStore.ts exposes this in non-production builds).
    // Wait until the store is available (it mounts after app hydration).
    await page.waitForFunction(() => !!(window as Record<string, unknown>).__syncStatusStore)
    await page.evaluate(() => {
      const store = (window as Record<string, unknown>).__syncStatusStore as {
        setState: (partial: Record<string, unknown>) => void
      }
      store.setState({ status: 'syncing' })
    })

    // Wait for the data-sync-status attribute to confirm the component re-rendered
    // with the injected status. This is the authoritative signal — the attribute
    // is set directly from the store's status value in SyncStatusIndicator.tsx.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="sync-status-indicator"]')
      return el?.getAttribute('data-sync-status') === 'syncing'
    })

    // Under prefers-reduced-motion, the syncing icon swaps to a static Cloud
    // icon (no Loader2) so animate-spin must be absent.
    const icon = page.getByTestId('sync-status-icon')
    const cls = await icon.getAttribute('class')
    expect(cls ?? '').not.toContain('animate-spin')
  })
})
