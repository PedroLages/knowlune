/**
 * E2E tests for AI Provider Change Re-consent — E119-S09 (AC-7)
 *
 * Covers:
 *   1. Provider mismatch → ProviderReconsentModal appears with correct provider name
 *   2. Accept path → modal closes, AI call proceeds
 *   3. Decline path → modal closes, AIConsentDeclinedBanner appears
 *   4. Combined flow → simultaneous notice update + provider change shown in single modal
 *
 * Strategy:
 *   - Inject window.__testForceProviderMismatch via addInitScript to signal the factory
 *     that a provider mismatch should be simulated (bypasses real AI config).
 *   - Supabase endpoints mocked via page.route().
 *   - Uses the existing window.__mockLLMClient pattern for the AI layer mock.
 */

import { test, expect } from '../../support/fixtures'

// ── Constants ──────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'usr-00000000-0000-0000-0000-reconsent-001'
const TEST_EMAIL = 'provider-reconsent@example.com'

const MOCK_USER = {
  id: MOCK_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: TEST_EMAIL,
  created_at: '2026-04-01T10:00:00.000Z',
  updated_at: '2026-04-01T10:00:00.000Z',
  app_metadata: { provider: 'email' },
  user_metadata: {},
}

const MOCK_SESSION = {
  access_token: 'mock-access-token-reconsent',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-token-reconsent',
  user: MOCK_USER,
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function setupAuthAndConsent(page: import('@playwright/test').Page) {
  // Navigate first (about:blank storage restriction)
  await page.goto('/')

  // Inject Supabase session into localStorage so auth store picks it up
  await page.evaluate(
    ([userId, session]) => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      // Supabase persists session under this key
      localStorage.setItem(
        `sb-${location.hostname.split('.')[0]}-auth-token`,
        JSON.stringify({ currentSession: session, expiresAt: 9999999999 }),
      )
      // Seed a userConsents row with provider_id='openai'.
      // The app reads from IndexedDB via Dexie; we seed via the IDB API directly.
      // Must return a Promise so page.evaluate awaits completion before navigating.
      return new Promise<void>((resolve, reject) => {
        const openRequest = indexedDB.open('knowlune-db')
        openRequest.onerror = () => resolve() // IDB not yet initialised — skip seed
        openRequest.onsuccess = () => {
          const db = openRequest.result
          if (!db.objectStoreNames.contains('userConsents')) {
            db.close()
            resolve()
            return
          }
          const tx = db.transaction('userConsents', 'readwrite')
          const store = tx.objectStore('userConsents')
          store.put({
            id: 'consent-ai-tutor-openai',
            userId,
            purpose: 'ai_tutor',
            grantedAt: '2026-04-01T10:00:00.000Z',
            withdrawnAt: null,
            noticeVersion: '2026-04-23.1',
            evidence: { provider_id: 'openai' },
            createdAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-01T10:00:00.000Z',
          })
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => { db.close(); reject(tx.error) }
        }
      })
    },
    [MOCK_USER_ID, MOCK_SESSION] as const,
  )

  // Mock Supabase session endpoint
  await page.route('**/auth/v1/token*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...MOCK_SESSION }),
    })
  })

  await page.route('**/auth/v1/user*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USER),
    })
  })
}

/** Signal to the factory that the configured provider has changed to 'anthropic'. */
async function injectProviderMismatch(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    // The factory checks this before calling isGrantedForProvider.
    // In test environments (import.meta.env.DEV), the factory respects this override.
    ;(window as unknown as Record<string, unknown>).__testForceProvider = 'anthropic'
  })
}

/** Remove the mismatch signal so the normal flow is tested. */
async function clearProviderMismatch(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    delete (window as unknown as Record<string, unknown>).__testForceProvider
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('E119-S09: AI Provider Change Re-consent', () => {
  test('provider mismatch surfaces ProviderReconsentModal with correct provider name', async ({
    page,
  }) => {
    await injectProviderMismatch(page)
    await setupAuthAndConsent(page)

    // Navigate to a page that triggers an AI call (e.g. Overview with AI suggestions)
    await page.goto('/overview')

    // The factory sees anthropic ≠ evidence.provider_id (openai) and throws ProviderReconsentError
    // The hook opens the modal
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/Anthropic/i)).toBeVisible()
    await expect(page.getByText(/Prompt text/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /privacy notice/i })).toBeVisible()
  })

  test('accept path closes modal and allows AI call to proceed', async ({ page }) => {
    await injectProviderMismatch(page)
    await setupAuthAndConsent(page)

    // Mock Supabase user_consents upsert (called by grantConsent)
    await page.route('**/rest/v1/user_consents*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await page.goto('/overview')

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 })

    // Click Accept
    await page.getByRole('button', { name: /accept/i }).click()

    // Modal closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

    // Declined banner should NOT be shown
    await expect(page.getByRole('status')).not.toBeVisible()
  })

  test('decline path closes modal and shows AIConsentDeclinedBanner', async ({ page }) => {
    await injectProviderMismatch(page)
    await setupAuthAndConsent(page)

    await page.goto('/overview')

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 })

    // Click Decline
    await page.getByRole('button', { name: /decline/i }).click()

    // Modal closes
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

    // AIConsentDeclinedBanner appears
    await expect(page.getByRole('status')).toBeVisible()
    await expect(page.getByRole('status')).toContainText(/Anthropic/i)
  })

  test('combined flow: notice update + provider change shows single modal with both sections', async ({
    page,
  }) => {
    await injectProviderMismatch(page)

    // Seed a stale notice version in the consent row so noticeUpdatePending=true
    await page.addInitScript(() => {
      const req = indexedDB.open('knowlune-db')
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('userConsents')) return
        const tx = db.transaction('userConsents', 'readwrite')
        tx.objectStore('userConsents').put({
          id: 'consent-ai-tutor-openai-stale',
          userId: 'usr-00000000-0000-0000-0000-reconsent-001',
          purpose: 'ai_tutor',
          grantedAt: '2026-04-01T10:00:00.000Z',
          withdrawnAt: null,
          noticeVersion: '2026-01-01.1', // stale version → triggers noticeUpdatePending
          evidence: { provider_id: 'openai' },
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:00:00.000Z',
        })
      }
    })

    await setupAuthAndConsent(page)
    await page.goto('/overview')

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 })

    // Both sections visible in a single modal
    await expect(page.getByText(/Anthropic/i)).toBeVisible()
    await expect(page.getByText(/Privacy notice updated/i)).toBeVisible()

    // Only ONE dialog open (not two separate modals)
    await expect(page.getByRole('dialog')).toHaveCount(1)
  })
})
