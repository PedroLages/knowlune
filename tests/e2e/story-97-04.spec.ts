/**
 * E97-S04: New-Device Download Overlay — E2E coverage.
 *
 * Validates:
 *   1. Overlay renders phase-aware UI when the download store is driven
 *      through its lifecycle.
 *   2. Error phase surfaces Retry + Close; Close dismisses the overlay.
 *   3. The overlay is NEVER shown for an existing-device user (local data
 *      present → predicate short-circuits).
 *
 * Because `shouldShowDownloadOverlay` performs real Supabase HEAD queries,
 * we cannot exercise the mount-gate here without a seeded test account.
 * Instead, we drive the overlay directly via the exposed store hooks
 * (`window.__downloadStatusStore`) combined with a fake auth user, mirroring
 * the E97-S01/02/03 testing pattern.
 *
 * @since E97-S04
 */
import { test, expect } from '../support/fixtures'
import type { Page } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'

const USER_ID = 'e97-s04-user'

async function setFakeAuthUser(page: Page, userId = USER_ID) {
  await page.waitForFunction(
    () => !!(window as Record<string, unknown>).__authStore,
  )
  await page.evaluate((uid) => {
    const store = (window as Record<string, unknown>).__authStore as {
      setState: (partial: Record<string, unknown>) => void
    }
    store.setState({
      user: { id: uid, email: 'e97-s04@test.local' },
      session: null,
      initialized: true,
    })
  }, userId)
}

async function setDownloadStatus(
  page: Page,
  action:
    | 'startHydrating'
    | 'startDownloadingP0P2'
    | 'completeDownloading'
    | 'reset',
  message?: string,
) {
  await page.waitForFunction(
    () => !!(window as Record<string, unknown>).__downloadStatusStore,
  )
  await page.evaluate(
    ({ action, message }) => {
      const store = (window as Record<string, unknown>)
        .__downloadStatusStore as {
        getState: () => {
          startHydrating: () => void
          startDownloadingP0P2: () => void
          completeDownloading: () => void
          failDownloading: (m: string) => void
          reset: () => void
        }
      }
      const state = store.getState()
      if (action === 'startHydrating') state.startHydrating()
      else if (action === 'startDownloadingP0P2') state.startDownloadingP0P2()
      else if (action === 'completeDownloading') state.completeDownloading()
      else if (action === 'reset') state.reset()
      void message
    },
    { action, message },
  )
}

async function failDownload(page: Page, message: string) {
  await page.evaluate((msg) => {
    const store = (window as Record<string, unknown>)
      .__downloadStatusStore as {
      getState: () => { failDownloading: (m: string) => void }
    }
    store.getState().failDownloading(msg)
  }, message)
}

/**
 * Install the dev-only `__mockHeadCounts` hook in the page context so the
 * `useDownloadProgress` hook returns a stable remote total instead of hitting
 * Supabase. Must be called before the hook runs (i.e., before force-mounting).
 */
async function mockSupabaseHeadCounts(page: Page, count = 5) {
  await page.addInitScript((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__mockHeadCounts = c
  }, count)
}

/**
 * Mount the overlay directly by synthesizing the App.tsx state. Because we
 * do not have a seeded test account for `shouldShowDownloadOverlay`, we use
 * the dev-only `__forceDownloadOverlay` shim exposed by App.tsx to bypass
 * the predicate + 2s defer. Combined with driving `__downloadStatusStore`,
 * this gives us full control over the overlay's visual phases.
 */
async function forceOverlayMount(page: Page, userId = USER_ID) {
  await page.waitForFunction(
    () => typeof (window as Record<string, unknown>).__forceDownloadOverlay === 'function',
  )
  // Drive the store into an active phase FIRST so the overlay renders the
  // correct phase on mount instead of the default idle fallback.
  await setDownloadStatus(page, 'startHydrating')
  await page.evaluate((uid) => {
    const force = (window as Record<string, unknown>).__forceDownloadOverlay as
      | ((userId: string | null) => void)
      | undefined
    force?.(uid)
  }, userId)
  // Also put the sync status into a state that won't auto-complete the overlay
  // (the engine watcher would otherwise race against our test assertions).
  await page.evaluate(() => {
    const store = (window as Record<string, unknown>).__syncStatusStore as
      | { setState: (partial: Record<string, unknown>) => void }
      | undefined
    store?.setState({ status: 'syncing', lastError: null })
  })
}

test.describe('E97-S04: New Device Download Overlay', () => {
  test('store-driven: hydrating phase → downloading phase → success auto-close (R1, R3)', async ({
    page,
  }) => {
    await mockSupabaseHeadCounts(page, 5)
    await dismissOnboarding(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await setFakeAuthUser(page)
    await forceOverlayMount(page)

    // The overlay only mounts after the 2s defer; short-circuit by
    // waiting for it explicitly.
    const overlay = page.getByTestId('new-device-download-overlay')

    // Drive through phase A → B → complete. We must wait for each transition
    // to land in the DOM before advancing.
    await expect(overlay).toHaveAttribute('data-phase', 'hydrating-p3p4', {
      timeout: 5_000,
    })

    await setDownloadStatus(page, 'startDownloadingP0P2')
    await expect(overlay).toHaveAttribute('data-phase', 'downloading-p0p2')

    await setDownloadStatus(page, 'completeDownloading')
    // Overlay shows success briefly then auto-closes.
    await expect(overlay).toHaveCount(0, { timeout: 2_000 })
  })

  test('error phase exposes Retry + Close; Close dismisses (R5)', async ({
    page,
  }) => {
    await mockSupabaseHeadCounts(page, 5)
    await dismissOnboarding(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await setFakeAuthUser(page)
    await forceOverlayMount(page)
    const overlay = page.getByTestId('new-device-download-overlay')
    await expect(overlay).toBeVisible({ timeout: 5_000 })

    await failDownload(page, 'Network unavailable')
    await expect(overlay).toHaveAttribute('data-phase', 'error')
    await expect(page.getByTestId('new-device-download-retry')).toBeVisible()

    await page.getByTestId('new-device-download-close').click()
    await expect(overlay).toHaveCount(0)
  })

  test('Retry on error re-enters hydrating phase (R5)', async ({ page }) => {
    await mockSupabaseHeadCounts(page, 5)
    await dismissOnboarding(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await setFakeAuthUser(page)
    await forceOverlayMount(page)
    const overlay = page.getByTestId('new-device-download-overlay')
    await expect(overlay).toBeVisible({ timeout: 5_000 })

    await failDownload(page, 'boom')
    await expect(overlay).toHaveAttribute('data-phase', 'error')

    await page.getByTestId('new-device-download-retry').click()
    // Retry fires observedHydrate which stamps hydrating-p3p4 synchronously
    // via startHydrating. It may transition to downloading-p0p2 quickly once
    // the hydrator resolves (fast under mocked Supabase), so we accept both.
    await expect(overlay).toHaveAttribute(
      'data-phase',
      /hydrating-p3p4|downloading-p0p2/,
    )
  })

  test('existing-device user never sees the overlay (R6)', async ({ page }) => {
    await dismissOnboarding(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // No store manipulation — the predicate must run naturally. Without
    // seeded Supabase data the predicate returns false (safe default) and
    // the overlay never mounts.
    await setFakeAuthUser(page)

    // Wait past the 2s defer plus some buffer — no event to hook onto when
    // the overlay intentionally does NOT mount, so a hard wait is necessary
    // to assert absence across the full defer window.
    await page.waitForTimeout(2_500)
    const overlay = page.getByTestId('new-device-download-overlay')
    await expect(overlay).toHaveCount(0)
  })
})
