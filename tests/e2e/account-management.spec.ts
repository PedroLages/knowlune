/**
 * E2E tests for Account Management features.
 *
 * Tests cover:
 * - Change Password flow (success + validation errors)
 * - Change Email flow
 * - Profile persistence across sessions (local-first with Supabase best-effort sync)
 * - Change Password hidden for OAuth users
 *
 * NOTE: These tests mock Supabase auth endpoints via page.route() to simulate
 * server responses without a live Supabase instance.
 */
import { test, expect } from '../support/fixtures'
import { goToSettings } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_EMAIL = 'testuser@example.com'
const TEST_PASSWORD = 'SecurePass123!'
const NEW_PASSWORD = 'NewSecurePass456!'
const NEW_EMAIL = 'newemail@example.com'
const TEST_USER_ID = 'user-00000000-0000-0000-0000-000000000001'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock an authenticated Supabase session via page.route() interception */
async function mockAuthenticatedSession(
  page: import('@playwright/test').Page,
  overrides: {
    provider?: string
    email?: string
    userMetadata?: Record<string, unknown>
  } = {}
) {
  const provider = overrides.provider ?? 'email'
  const email = overrides.email ?? TEST_EMAIL
  const userMetadata = overrides.userMetadata ?? {}

  const sessionPayload = {
    access_token: 'mock-access-token-for-testing',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: 'mock-refresh-token',
    user: {
      id: TEST_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: { provider, providers: [provider] },
      user_metadata: { displayName: 'Test User', ...userMetadata },
      created_at: '2025-01-01T00:00:00.000000Z',
    },
  }

  // Intercept Supabase session/user endpoints
  await page.route('**/auth/v1/token?grant_type=*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionPayload),
    })
  )

  await page.route('**/auth/v1/user', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessionPayload.user),
      })
    }
    // PUT requests (update user) — handled per-test
    return route.continue()
  })

  // Seed auth state into localStorage so the app reads it on load
  await page.addInitScript(
    ({ session }) => {
      sessionStorage.removeItem('knowlune-guest')
      sessionStorage.removeItem('knowlune-guest-id')
      sessionStorage.removeItem('knowlune-guest-banner-dismissed')

      // Dismiss welcome wizard
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
      // Match the deterministic project ref configured in playwright.config.ts.
      // This exercises Supabase's real persisted-session seam while all network
      // endpoints remain intercepted by page.route().
      localStorage.setItem('sb-knowlune-auth-token', JSON.stringify(session))
      localStorage.setItem('sb-supabase-auth-token', JSON.stringify(session))
      localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: session }))
    },
    { session: sessionPayload }
  )

  return sessionPayload
}

async function openAuthenticatedSettings(
  page: import('@playwright/test').Page,
  session: Awaited<ReturnType<typeof mockAuthenticatedSession>>
): Promise<void> {
  await goToSettings(page)
  await page.waitForFunction(
    () => typeof (window as Window & { __authStore?: unknown }).__authStore !== 'undefined'
  )
  await page.evaluate(
    ({ activeSession }) => {
      const store = (
        window as Window & {
          __authStore?: { getState: () => { setSession: (value: typeof activeSession) => void } }
        }
      ).__authStore
      store?.getState().setSession(activeSession)
    },
    { activeSession: session }
  )
}

async function openProfileSettings(
  page: import('@playwright/test').Page,
  session: Awaited<ReturnType<typeof mockAuthenticatedSession>>
): Promise<void> {
  await openAuthenticatedSettings(page, session)
  await page.getByLabel(/^Profile(?: \(modified\))?$/).click()
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible()
}

async function seedProfileSettings(
  page: import('@playwright/test').Page,
  profile: { displayName: string; bio: string }
): Promise<void> {
  await page.addInitScript(value => {
    localStorage.setItem('app-settings', JSON.stringify(value))
  }, profile)
}

// ---------------------------------------------------------------------------
// Test: Change Password flow
// ---------------------------------------------------------------------------

test.describe('Change Password flow', () => {
  test('should submit password change successfully', async ({ page }) => {
    const session = await mockAuthenticatedSession(page)

    // Mock the Supabase user update endpoint for password change
    await page.route('**/auth/v1/user', route => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: TEST_USER_ID,
            email: TEST_EMAIL,
            app_metadata: { provider: 'email' },
            user_metadata: {},
          }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      })
    })

    await openAuthenticatedSettings(page, session)

    // Verify account section is visible and shows signed-in state
    const accountSection = page.getByTestId('account-section')
    await expect(accountSection).toBeVisible()
    await expect(accountSection).toContainText(TEST_EMAIL)

    await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible()

    // Fill password fields
    await page.getByTestId('current-password-input').fill(TEST_PASSWORD)
    await page.getByTestId('new-password-input').fill(NEW_PASSWORD)
    await page.getByTestId('confirm-password-input').fill(NEW_PASSWORD)

    // Submit
    const submitButton = page.getByRole('button', { name: 'Update Password' })
    await submitButton.click()

    // Verify success feedback (toast or inline message)
    await expect(
      page.getByText(/password.*changed|password.*updated|success/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('should show error when passwords do not match', async ({ page }) => {
    const session = await mockAuthenticatedSession(page)
    await openAuthenticatedSettings(page, session)

    await page.getByTestId('current-password-input').fill(TEST_PASSWORD)
    await page.getByTestId('new-password-input').fill(NEW_PASSWORD)
    await page.getByTestId('confirm-password-input').fill('DifferentPassword!')

    // Verify mismatch error
    await expect(
      page.getByRole('status').filter({ hasText: 'Passwords do not match' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update Password' })).toBeDisabled()
  })

  test('should show error for short password', async ({ page }) => {
    const session = await mockAuthenticatedSession(page)
    await openAuthenticatedSettings(page, session)

    await page.getByTestId('current-password-input').fill(TEST_PASSWORD)
    await page.getByTestId('new-password-input').fill('ab')
    await page.getByTestId('confirm-password-input').fill('ab')

    // Verify validation error for short password
    await expect(
      page.getByRole('status').filter({ hasText: 'Password must be at least 8 characters' })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update Password' })).toBeDisabled()
  })

  test('should show validation errors for empty fields', async ({ page }) => {
    const session = await mockAuthenticatedSession(page)
    await openAuthenticatedSettings(page, session)

    // Empty forms are prevented from submitting until every required field is valid.
    await expect(page.getByRole('button', { name: 'Update Password' })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Test: Change Email flow
// ---------------------------------------------------------------------------

test.describe('Change Email flow', () => {
  test('should submit email change and show verification info', async ({ page }) => {
    const session = await mockAuthenticatedSession(page)

    // Mock the Supabase user update endpoint for email change
    await page.route('**/auth/v1/user', route => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: TEST_USER_ID,
            email: TEST_EMAIL,
            new_email: NEW_EMAIL,
            app_metadata: { provider: 'email' },
            user_metadata: {},
          }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      })
    })

    await openAuthenticatedSettings(page, session)

    await expect(page.getByRole('heading', { name: 'Change Email' })).toBeVisible()

    // Fill new email and current password for verification
    await page.getByLabel('New Email Address').fill(NEW_EMAIL)
    await page.getByTestId('email-change-password-input').fill(TEST_PASSWORD)

    // Submit
    const submitButton = page.getByRole('button', { name: 'Change Email' })
    await submitButton.click()

    // Verify info toast/message about verification email
    await expect(
      page.getByText(/verification.*email|check.*email|confirm.*email/i).first()
    ).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Test: Profile persistence across sessions
// ---------------------------------------------------------------------------

test.describe('Profile persistence across sessions', () => {
  test('should show persisted local profile settings', async ({ page }) => {
    const profileData = {
      displayName: 'Persistent User',
      bio: 'My learning journey',
    }

    await seedProfileSettings(page, profileData)
    const session = await mockAuthenticatedSession(page)

    await openProfileSettings(page, session)

    const displayNameInput = page.getByLabel('Display Name')
    await expect(displayNameInput).toBeVisible()
    await expect(displayNameInput).toHaveValue(profileData.displayName)

    const bioInput = page.getByLabel('Bio')
    await expect(bioInput).toBeVisible()
    await expect(bioInput).toHaveValue(profileData.bio)
  })

  test('should update profile and persist it locally', async ({ page }) => {
    const session = await mockAuthenticatedSession(page)

    // Profile sync is best effort; keep its network seam deterministic.
    await page.route('**/auth/v1/user', route => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: TEST_USER_ID,
            email: TEST_EMAIL,
            app_metadata: { provider: 'email' },
            user_metadata: { displayName: 'Updated Name', bio: 'Updated bio' },
          }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      })
    })

    await openProfileSettings(page, session)

    // Update display name
    const displayNameInput = page.getByLabel('Display Name')
    await displayNameInput.clear()
    await displayNameInput.fill('Updated Name')

    // Update bio
    const bioInput = page.getByLabel('Bio')
    await bioInput.clear()
    await bioInput.fill('Updated bio')

    // Save
    const saveButton = page.getByRole('button', { name: 'Save Changes' })
    await saveButton.click()

    // Verify success feedback
    await expect(page.getByText('Profile updated successfully')).toBeVisible({ timeout: 5000 })
    await expect
      .poll(() =>
        page.evaluate(() => {
          const stored = localStorage.getItem('app-settings')
          return stored ? JSON.parse(stored) : null
        })
      )
      .toMatchObject({ displayName: 'Updated Name', bio: 'Updated bio' })
  })
})

// ---------------------------------------------------------------------------
// Test: Change Password hidden for OAuth users
// ---------------------------------------------------------------------------

test.describe('Change Password hidden for OAuth users', () => {
  test('should not show Change Password section for Google OAuth users', async ({ page }) => {
    const session = await mockAuthenticatedSession(page, { provider: 'google' })
    await openAuthenticatedSettings(page, session)

    // Account section should be visible
    const accountSection = page.getByTestId('account-section')
    await expect(accountSection).toBeVisible()
    await expect(accountSection).toContainText(TEST_EMAIL)

    // Password and email controls are not applicable to OAuth-only accounts.
    await expect(page.getByRole('heading', { name: 'Change Password' })).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Change Email' })).not.toBeVisible()
  })

  test('should show Change Password section for email/password users', async ({ page }) => {
    const session = await mockAuthenticatedSession(page, { provider: 'email' })
    await openAuthenticatedSettings(page, session)

    await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible()
  })
})
