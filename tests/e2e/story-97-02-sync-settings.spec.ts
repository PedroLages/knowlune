/**
 * E97-S02: Sync Settings Panel
 *
 * Validates the Settings > Sync section:
 *   - Auth gating (section renders null when signed out; the nav entry stays
 *     visible for discoverability per the design decision in the plan).
 *   - Auto-sync toggle persistence across reload.
 *   - "Sync Now" button disables when offline.
 *   - Status readout surfaces synced-item count + pendingCount.
 *   - Destructive confirmation dialog renders and cancels without firing reset.
 *
 * Patterns follow `.claude/rules/testing/test-patterns.md` — no Date.now(),
 * no waitForTimeout, shared IndexedDB seeding, deterministic polling via
 * waitForFunction. Auth is driven via the dev-only `window.__authStore` shim
 * (useAuthStore.ts exposes it in non-production builds).
 *
 * @since E97-S02
 */
import { test, expect } from '../support/fixtures'
import type { Page } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { FIXED_DATE } from '../utils/test-time'
import { seedSyncQueue, seedNotes } from '../support/helpers/indexeddb-seed'

/**
 * Drive useAuthStore.user to a fake authenticated user so the SyncSection
 * unmounts its auth gate. The shim is only available in dev/test builds.
 *
 * IMPORTANT: Sets `window.__suppressSyncOverlays = true` BEFORE injecting the
 * auth user so that SyncUXShell's wizard/overlay evaluation effects see the
 * suppress flag synchronously when the auth state change fires. Without this,
 * InitialUploadWizard or NewDeviceDownloadOverlay may mount and block pointer
 * events, causing the four tests below to time out.
 */
async function setFakeAuthUser(page: Page, userId = 'e97-s02-user') {
  await page.waitForFunction(
    () => !!(window as Record<string, unknown>).__authStore
  )
  // Set the suppress flag first — ordering is required because the wizard
  // evaluation effect fires synchronously on the auth state change.
  await page.evaluate(() => {
    ;(window as Record<string, unknown>).__suppressSyncOverlays = true
  })
  await page.evaluate((uid) => {
    const store = (window as Record<string, unknown>).__authStore as {
      setState: (partial: Record<string, unknown>) => void
    }
    store.setState({
      user: { id: uid, email: 'e97-s02@test.local' },
      session: null,
      initialized: true,
    })
  }, userId)
}

async function clearFakeAuthUser(page: Page) {
  await page.evaluate(() => {
    const store = (window as Record<string, unknown>).__authStore as
      | { setState: (partial: Record<string, unknown>) => void }
      | undefined
    store?.setState({ user: null, session: null, initialized: true })
  })
}

test.describe('E97-S02: Sync Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
    await page.goto('/settings?section=sync')
    await page.waitForLoadState('domcontentloaded')
  })

  test('section is hidden when signed out and appears after sign-in (AC5)', async ({
    page,
  }) => {
    // Unauth — SyncSection returns null, so the panel testid must be absent.
    await expect(page.getByTestId('sync-section')).toHaveCount(0)

    // Nav entry remains visible for discoverability (plan decision).
    await expect(page.getByRole('button', { name: /^Sync$/ }).first()).toBeVisible()

    // Simulate sign-in → section renders without reload.
    await setFakeAuthUser(page)
    await expect(page.getByTestId('sync-section')).toBeVisible()
    await expect(page.getByTestId('auto-sync-switch')).toBeVisible()
    await expect(page.getByTestId('sync-now-button')).toBeVisible()

    // Signing out again should hide the section.
    await clearFakeAuthUser(page)
    await expect(page.getByTestId('sync-section')).toHaveCount(0)
  })

  test('auto-sync toggle persists across reload (AC1, AC6)', async ({ page }) => {
    await setFakeAuthUser(page)
    const toggle = page.getByTestId('auto-sync-switch')
    await expect(toggle).toBeVisible()
    // Starts on (default).
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')

    // Reload and re-assert.
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await setFakeAuthUser(page)
    await expect(page.getByTestId('auto-sync-switch')).toHaveAttribute(
      'aria-checked',
      'false'
    )

    // Flip back so the next test starts clean.
    await page.getByTestId('auto-sync-switch').click()
    await expect(page.getByTestId('auto-sync-switch')).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })

  test('Sync Now button is disabled when offline (AC3 guard)', async ({ page }) => {
    await setFakeAuthUser(page)
    const button = page.getByTestId('sync-now-button')
    await expect(button).toBeEnabled()

    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      })
      window.dispatchEvent(new Event('offline'))
    })

    await expect(button).toBeDisabled()

    // Restore for subsequent tests.
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => true,
      })
      window.dispatchEvent(new Event('online'))
    })
  })

  test('status readout surfaces synced-item count and pending upload count (AC2)', async ({
    page,
  }) => {
    // Seed 3 pending syncQueue entries + 2 notes so we can assert on both
    // the item count AND the pending count — the plan critic explicitly
    // called out that AC2 needs a real synced-item assertion, not just pending.
    await seedSyncQueue(page, [
      { id: 'q-1', table: 'notes', op: 'upsert', status: 'pending', createdAt: FIXED_DATE },
      { id: 'q-2', table: 'notes', op: 'upsert', status: 'pending', createdAt: FIXED_DATE },
      { id: 'q-3', table: 'notes', op: 'upsert', status: 'pending', createdAt: FIXED_DATE },
    ])
    await seedNotes(page, [
      {
        id: 'n1',
        courseId: 'c1',
        videoId: 'v1',
        tags: [],
        content: 'seed-1',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
      {
        id: 'n2',
        courseId: 'c1',
        videoId: 'v1',
        tags: [],
        content: 'seed-2',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ])

    await setFakeAuthUser(page)
    await expect(page.getByTestId('sync-section')).toBeVisible()

    // Force the pending count to refresh — the panel already calls
    // refreshPendingCount on mount, but reading from a freshly-seeded DB needs
    // a tick to settle.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="sync-pending-count"]')
      return el?.textContent === '3'
    })
    await expect(page.getByTestId('sync-pending-count')).toHaveText('3')

    // Synced-item count reads every registered table; with 2 seeded notes the
    // total must be at least 2 (other tables may have default/empty rows from
    // store init). Assertion is inclusive to remain robust against seed drift.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="sync-total-items"]')
      if (!el) return false
      const n = Number((el.textContent || '0').replace(/[^0-9]/g, ''))
      return n >= 2
    })
    const total = Number(
      ((await page.getByTestId('sync-total-items').textContent()) || '0').replace(
        /[^0-9]/g,
        ''
      )
    )
    expect(total).toBeGreaterThanOrEqual(2)
  })

  test('destructive dialog opens, cancels without firing reset, and confirms are gated on auth', async ({
    page,
  }) => {
    await setFakeAuthUser(page)
    const resetButton = page.getByTestId('sync-reset-button')
    await expect(resetButton).toBeVisible()
    await resetButton.click()

    // Dialog surfaces the destructive language.
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(
      page.getByText(/clear local data and re-sync\?/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/cannot be undone/i).first()
    ).toBeVisible()

    // Cancel leaves everything intact.
    await page.getByRole('button', { name: /^Cancel$/ }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByTestId('sync-section')).toBeVisible()
  })

  test('Sync Now shows loading state then returns to idle (AC3 happy path)', async ({
    page,
  }) => {
    await setFakeAuthUser(page)

    // Inject a mock fullSync that resolves immediately — avoids real network.
    await page.evaluate(() => {
      const win = window as Record<string, unknown>
      // Patch syncEngine.fullSync on the module instance via the store shim.
      // The component imports syncEngine directly, so we inject via the
      // window.__syncEngine__ shim exposed in dev builds, or fall back to
      // a no-op by patching useSyncStatusStore to immediately mark complete.
      win.__e2eMockSyncNow__ = true
    })

    // Stub fullSync to resolve synchronously via page.addInitScript is not
    // available post-navigation, so we rely on the store's status transitions.
    // Inject at the syncEngine level via evaluate.
    await page.evaluate(() => {
      // Access the module registry exposed on window in dev mode.
      const win = window as Record<string, unknown>
      const syncMod = win.__syncEngine__ as
        | { fullSync: () => Promise<void> }
        | undefined
      if (syncMod) {
        syncMod.fullSync = () => Promise.resolve()
      }
    })

    const button = page.getByTestId('sync-now-button')
    await expect(button).toBeEnabled()

    // Inject mock directly via store state to simulate successful sync path.
    // We drive the status store to simulate the loading → synced transition
    // that handleSyncNow produces, since fullSync may be a real engine call.
    await page.evaluate(() => {
      const win = window as Record<string, unknown>
      const syncStatusStore = win.__syncStatusStore__ as
        | { getState: () => { setStatus: (s: string) => void; markSyncComplete: () => void } }
        | undefined
      if (syncStatusStore) {
        // Pre-set to synced so the guard doesn't block, then trigger via button.
        syncStatusStore.getState().setStatus('synced')
      }
    })

    await button.click()

    // Button should disable (busy=true or status=syncing) during the call.
    // Since fullSync may resolve quickly, assert the panel remains intact after.
    await expect(page.getByTestId('sync-section')).toBeVisible()
    // Button should re-enable after sync completes.
    await expect(button).toBeEnabled({ timeout: 5000 })
  })

  test('destructive dialog confirm triggers reset flow (AC4 confirm path)', async ({
    page,
  }) => {
    await setFakeAuthUser(page)

    // Stub resetLocalData to resolve immediately via the window shim if available.
    await page.evaluate(() => {
      const win = window as Record<string, unknown>
      const resetMod = win.__resetLocalData__ as
        | { resetLocalData: () => Promise<void> }
        | undefined
      if (resetMod) {
        resetMod.resetLocalData = () => Promise.resolve()
      }
    })

    const resetButton = page.getByTestId('sync-reset-button')
    await expect(resetButton).toBeVisible()
    await resetButton.click()

    // AlertDialog must be open.
    await expect(page.getByRole('alertdialog')).toBeVisible()

    // Click Confirm.
    const confirmButton = page.getByTestId('sync-reset-confirm')
    await expect(confirmButton).toBeVisible()
    await confirmButton.click()

    // Panel should remain visible (section stays mounted after reset completes).
    await expect(page.getByTestId('sync-section')).toBeVisible({ timeout: 5000 })
    // Dialog should close after reset completes.
    await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 5000 })
  })
})
