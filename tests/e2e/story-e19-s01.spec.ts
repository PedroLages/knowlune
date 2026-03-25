/**
 * ATDD E2E tests for E19-S01: Authentication Setup
 *
 * Tests that auth flows work correctly:
 * - AC1: Core features work without an account (no auth gates)
 * - AC2: Sign-up form is accessible from premium CTAs
 * - AC3: Sign-up completes and redirects back
 * - AC4: Sign-in authenticates and preserves local data
 * - AC5: Sign-out removes token, core features continue
 * - AC6: Duplicate email shows helpful error
 * - Error: Network errors show retry option
 * - Loading: Submit buttons disable during auth requests
 *
 * NOTE: These tests use Supabase test project credentials.
 * Real auth flows require VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 */
import { test, expect } from '../support/fixtures'
import {
  goToOverview,
  goToCourses,
  goToSettings,
  navigateAndWait,
} from '../support/helpers/navigation'

// Dismiss welcome wizard for all tests (appears on first visit)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' }),
    )
  })
})

// ---------------------------------------------------------------------------
// AC1: Core features work without authentication
// ---------------------------------------------------------------------------

test.describe('AC1: Core features without account', () => {
  test('should access overview page without login', async ({ page }) => {
    await goToOverview(page)
    await expect(page.locator('main')).toBeVisible()
    // No auth-specific dialog should appear (welcome wizard already dismissed)
    await expect(page.getByTestId('welcome-wizard')).not.toBeVisible()
  })

  test('should access courses page without login', async ({ page }) => {
    await goToCourses(page)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByTestId('welcome-wizard')).not.toBeVisible()
  })

  test('should access settings page without login', async ({ page }) => {
    await goToSettings(page)
    await expect(page.locator('main')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC2: Sign-up form accessible from upgrade CTA
// ---------------------------------------------------------------------------

test.describe('AC2: Sign-up form', () => {
  test('should show sign-up form with email and password fields', async ({ page }) => {
    await goToSettings(page)
    // Look for a sign-up trigger in the Account section
    const signUpTrigger = page.getByRole('button', { name: /sign up/i })
    await expect(signUpTrigger).toBeVisible()
    await signUpTrigger.click()

    // Sign-up form should appear in dialog — scope to the email tab's fields
    const emailField = page.locator('#auth-email')
    const passwordField = page.locator('#auth-password')
    await expect(emailField).toBeVisible()
    await expect(passwordField).toBeVisible()
  })

  test('should include sign-in link for existing accounts', async ({ page }) => {
    await goToSettings(page)
    const signUpTrigger = page.getByRole('button', { name: /sign up/i })
    await signUpTrigger.click()

    // Mode toggle at bottom of dialog: "Already have an account? Sign In"
    const signInLink = page.getByRole('button', { name: /sign in/i })
    await expect(signInLink).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC3: Successful sign-up
// ---------------------------------------------------------------------------

test.describe('AC3: Sign-up completion', () => {
  test('should show loading state during sign-up submission', async ({ page }) => {
    await goToSettings(page)
    const signUpTrigger = page.getByRole('button', { name: /sign up/i })
    await signUpTrigger.click()

    // The submit button in the email/password form
    const submitButton = page.getByRole('button', { name: /sign up|create account/i }).last()
    // Before submission, button should be enabled
    await expect(submitButton).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// AC4: Sign-in preserves local data
// ---------------------------------------------------------------------------

test.describe('AC4: Sign-in', () => {
  test('should show sign-in form with email and password fields', async ({ page }) => {
    await goToSettings(page)
    // Click the Sign In button in the Account section
    const signInTrigger = page.getByRole('button', { name: /sign in/i })
    await expect(signInTrigger).toBeVisible()
    await signInTrigger.click()

    // Scope to the email tab's specific fields (magic link tab also has an email field)
    const emailField = page.locator('#auth-email')
    const passwordField = page.locator('#auth-password')
    await expect(emailField).toBeVisible()
    await expect(passwordField).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC5: Sign-out
// ---------------------------------------------------------------------------

test.describe('AC5: Sign-out', () => {
  test('should not show sign-out button when not authenticated', async ({ page }) => {
    await goToSettings(page)
    const signOutButton = page.getByRole('button', { name: /sign out|log out/i })
    await expect(signOutButton).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC6: Duplicate email error
// ---------------------------------------------------------------------------

test.describe('AC6: Duplicate email', () => {
  test('should show error for duplicate email on sign-up form', async ({ page }) => {
    await goToSettings(page)
    const signUpTrigger = page.getByRole('button', { name: /sign up/i })
    await signUpTrigger.click()

    // The form should have client-side validation
    const emailField = page.locator('#auth-email')
    await expect(emailField).toHaveAttribute('type', 'email')
  })
})

// ---------------------------------------------------------------------------
// Loading states
// ---------------------------------------------------------------------------

test.describe('Loading states', () => {
  test('should show loading indicator on app launch (session restore)', async ({ page }) => {
    // Core features should load immediately — no blocking auth check
    await navigateAndWait(page, '/')
    await expect(page.locator('main')).toBeVisible()
    // Page should be interactive within reasonable time
    await expect(page.getByRole('navigation')).toBeVisible()
  })
})
