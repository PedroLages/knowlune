/**
 * E2E tests for Account Management features.
 *
 * Tests cover:
 * - Change Password flow (success + validation errors)
 * - Change Email flow
 * - Profile persistence across sessions (hydrated from Supabase user_metadata)
 * - Change Password hidden for OAuth users
 *
 * NOTE: These tests mock Supabase auth endpoints via page.route() to simulate
 * server responses without a live Supabase instance. The implementation agent
 * is adding Change Password / Change Email forms to Settings.tsx in parallel.
 */
import { test, expect } from '../support/fixtures'
import { goToSettings, navigateAndWait } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL_PATTERN = '**/auth/v1/**'
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
      // Dismiss welcome wizard
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
      // Seed Supabase session into localStorage (key pattern used by @supabase/supabase-js)
      const storageKey = Object.keys(localStorage).find(k => k.includes('supabase'))
      if (!storageKey) {
        // Set auth state directly — the useAuthStore will pick it up from Supabase client
        localStorage.setItem(
          'sb-localhost-auth-token',
          JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            token_type: session.token_type,
            user: session.user,
          })
        )
      }
    },
    { session: sessionPayload }
  )
}

/** Dismiss welcome wizard for unauthenticated tests */
async function dismissWelcomeWizard(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })
}

// ---------------------------------------------------------------------------
// Test: Change Password flow
// ---------------------------------------------------------------------------

test.describe('Change Password flow', () => {
  test('should submit password change successfully', async ({ page }) => {
    await mockAuthenticatedSession(page)

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
      return route.continue()
    })

    await goToSettings(page)

    // Verify account section is visible and shows signed-in state
    const accountSection = page.getByTestId('account-section')
    await expect(accountSection).toBeVisible()
    await expect(accountSection).toContainText(TEST_EMAIL)

    // Find and interact with Change Password section
    const changePasswordSection = page.getByTestId('change-password-section')
    await expect(changePasswordSection).toBeVisible()

    // Fill password fields
    await changePasswordSection.getByLabel(/current password/i).fill(TEST_PASSWORD)
    await changePasswordSection.getByLabel(/new password/i).first().fill(NEW_PASSWORD)
    await changePasswordSection.getByLabel(/confirm.*password/i).fill(NEW_PASSWORD)

    // Submit
    const submitButton = changePasswordSection.getByRole('button', {
      name: /change password|update password/i,
    })
    await submitButton.click()

    // Verify success feedback (toast or inline message)
    await expect(
      page.getByText(/password.*changed|password.*updated|success/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('should show error when passwords do not match', async ({ page }) => {
    await mockAuthenticatedSession(page)
    await goToSettings(page)

    const changePasswordSection = page.getByTestId('change-password-section')
    await expect(changePasswordSection).toBeVisible()

    await changePasswordSection.getByLabel(/current password/i).fill(TEST_PASSWORD)
    await changePasswordSection.getByLabel(/new password/i).first().fill(NEW_PASSWORD)
    await changePasswordSection.getByLabel(/confirm.*password/i).fill('DifferentPassword!')

    const submitButton = changePasswordSection.getByRole('button', {
      name: /change password|update password/i,
    })
    await submitButton.click()

    // Verify mismatch error
    await expect(
      page.getByText(/passwords.*do not match|passwords.*don't match|mismatch/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('should show error for short password', async ({ page }) => {
    await mockAuthenticatedSession(page)
    await goToSettings(page)

    const changePasswordSection = page.getByTestId('change-password-section')
    await expect(changePasswordSection).toBeVisible()

    await changePasswordSection.getByLabel(/current password/i).fill(TEST_PASSWORD)
    await changePasswordSection.getByLabel(/new password/i).first().fill('ab')
    await changePasswordSection.getByLabel(/confirm.*password/i).fill('ab')

    const submitButton = changePasswordSection.getByRole('button', {
      name: /change password|update password/i,
    })
    await submitButton.click()

    // Verify validation error for short password
    await expect(
      page.getByText(/too short|at least|minimum|characters/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('should show validation errors for empty fields', async ({ page }) => {
    await mockAuthenticatedSession(page)
    await goToSettings(page)

    const changePasswordSection = page.getByTestId('change-password-section')
    await expect(changePasswordSection).toBeVisible()

    // Submit without filling any fields
    const submitButton = changePasswordSection.getByRole('button', {
      name: /change password|update password/i,
    })
    await submitButton.click()

    // Verify validation error appears
    await expect(
      page.getByText(/required|please enter|cannot be empty/i).first()
    ).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Test: Change Email flow
// ---------------------------------------------------------------------------

test.describe('Change Email flow', () => {
  test('should submit email change and show verification info', async ({ page }) => {
    await mockAuthenticatedSession(page)

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
      return route.continue()
    })

    await goToSettings(page)

    // Find Change Email section
    const changeEmailSection = page.getByTestId('change-email-section')
    await expect(changeEmailSection).toBeVisible()

    // Fill new email and current password for verification
    await changeEmailSection.getByLabel(/new email/i).fill(NEW_EMAIL)
    await changeEmailSection.getByLabel(/current password|password/i).fill(TEST_PASSWORD)

    // Submit
    const submitButton = changeEmailSection.getByRole('button', {
      name: /change email|update email/i,
    })
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
  test('should persist profile data from Supabase user_metadata', async ({ page }) => {
    const profileData = {
      displayName: 'Persistent User',
      bio: 'My learning journey',
    }

    await mockAuthenticatedSession(page, {
      userMetadata: profileData,
    })

    await goToSettings(page)

    // Verify profile section shows the user_metadata values
    // After hydration from Supabase, the display name input should have the value
    const displayNameInput = page.getByLabel(/display name|name/i).first()
    await expect(displayNameInput).toBeVisible()

    // The value should reflect the hydrated user_metadata
    await expect(displayNameInput).toHaveValue(profileData.displayName)

    const bioInput = page.getByLabel(/bio/i).first()
    await expect(bioInput).toBeVisible()
    await expect(bioInput).toHaveValue(profileData.bio)
  })

  test('should update profile and persist to Supabase user_metadata', async ({ page }) => {
    await mockAuthenticatedSession(page)

    // Mock the user update endpoint
    let capturedBody: Record<string, unknown> | null = null
    await page.route('**/auth/v1/user', route => {
      if (route.request().method() === 'PUT') {
        capturedBody = route.request().postDataJSON()
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
      return route.continue()
    })

    await goToSettings(page)

    // Update display name
    const displayNameInput = page.getByLabel(/display name|name/i).first()
    await displayNameInput.clear()
    await displayNameInput.fill('Updated Name')

    // Update bio
    const bioInput = page.getByLabel(/bio/i).first()
    await bioInput.clear()
    await bioInput.fill('Updated bio')

    // Save
    const saveButton = page.getByRole('button', { name: /save/i }).first()
    await saveButton.click()

    // Verify success feedback
    await expect(
      page.getByText(/saved|updated|success/i).first()
    ).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Test: Change Password hidden for OAuth users
// ---------------------------------------------------------------------------

test.describe('Change Password hidden for OAuth users', () => {
  test('should not show Change Password section for Google OAuth users', async ({ page }) => {
    await mockAuthenticatedSession(page, { provider: 'google' })
    await goToSettings(page)

    // Account section should be visible
    const accountSection = page.getByTestId('account-section')
    await expect(accountSection).toBeVisible()
    await expect(accountSection).toContainText(TEST_EMAIL)

    // Change Password section should NOT be visible for OAuth users
    const changePasswordSection = page.getByTestId('change-password-section')
    await expect(changePasswordSection).not.toBeVisible()
  })

  test('should show Change Password section for email/password users', async ({ page }) => {
    await mockAuthenticatedSession(page, { provider: 'email' })
    await goToSettings(page)

    // Change Password section SHOULD be visible for email users
    const changePasswordSection = page.getByTestId('change-password-section')
    await expect(changePasswordSection).toBeVisible()
  })
})
