/**
 * E66-S04: WCAG 2.2 SC 3.3.7 (Redundant Entry) and SC 3.3.8 (Accessible
 * Authentication, Minimum) regression spec.
 *
 * Locks the autocomplete contract on the Login page so password managers
 * can autofill credentials and so future refactors cannot regress the
 * attribute set silently.
 *
 * Surfaces covered:
 *   - EmailPasswordForm (sign-in mode)
 *   - EmailPasswordForm (sign-up mode, including confirm-password)
 *   - MagicLinkForm
 *
 * Negative checks:
 *   - No autocomplete="off" anywhere on /login
 *   - No onpaste attribute blocking paste on any auth input
 */
import { test, expect } from '../support/fixtures'

test.describe('E66-S04: Auth autocomplete contract (WCAG 3.3.7, 3.3.8)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /Sign in to Knowlune/i })).toBeVisible()
  })

  test('sign-in mode: email and password inputs declare correct autocomplete', async ({ page }) => {
    const emailInput = page.locator('#auth-email')
    const passwordInput = page.locator('#auth-password')

    await expect(emailInput).toHaveAttribute('autocomplete', 'email')
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
  })

  test('sign-up mode: password and confirm-password use new-password token', async ({ page }) => {
    // Toggle from sign-in to sign-up via the mode switch button.
    await page.getByRole('button', { name: /Sign Up/i }).click()
    await expect(page.getByRole('heading', { name: /Create your Knowlune account/i })).toBeVisible()

    const passwordInput = page.locator('#auth-password')
    const confirmInput = page.locator('#auth-confirm-password')

    await expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')
    await expect(confirmInput).toHaveAttribute('autocomplete', 'new-password')
  })

  test('mode toggle flips password autocomplete between current-password and new-password', async ({
    page,
  }) => {
    const passwordInput = page.locator('#auth-password')
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')

    await page.getByRole('button', { name: /Sign Up/i }).click()
    await expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')

    await page.getByRole('button', { name: /Sign In/i }).click()
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
  })

  test('Magic Link tab: email input declares autocomplete="email"', async ({ page }) => {
    await page.getByRole('tab', { name: /Magic Link/i }).click()
    const magicEmail = page.locator('#magic-link-email')
    await expect(magicEmail).toBeVisible()
    await expect(magicEmail).toHaveAttribute('autocomplete', 'email')
  })

  test('no auth input on /login uses autocomplete="off"', async ({ page }) => {
    // Visit each tab so the inputs render at least once.
    await page.getByRole('tab', { name: /Email/i }).click()
    const emailTabOff = await page.locator('input[autocomplete="off"]').count()
    expect(emailTabOff).toBe(0)

    await page.getByRole('tab', { name: /Magic Link/i }).click()
    const magicTabOff = await page.locator('input[autocomplete="off"]').count()
    expect(magicTabOff).toBe(0)
  })

  test('no auth input declares an onpaste attribute that could block password managers', async ({
    page,
  }) => {
    // The React property `onPaste` does not serialize to a DOM `onpaste`
    // attribute, so an attribute query is the strongest signal that
    // someone wired up an inline paste blocker.
    await page.getByRole('tab', { name: /Email/i }).click()
    const emailTabPaste = await page.locator('input[onpaste]').count()
    expect(emailTabPaste).toBe(0)

    await page.getByRole('tab', { name: /Magic Link/i }).click()
    const magicTabPaste = await page.locator('input[onpaste]').count()
    expect(magicTabPaste).toBe(0)
  })
})
