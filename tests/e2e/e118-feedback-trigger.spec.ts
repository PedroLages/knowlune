import { test, expect } from '@playwright/test'

/**
 * E118 — In-App Feedback & Bug Reporting
 * Tests the feedback trigger placement and modal interaction.
 * GitHub API calls are mocked to avoid real issue creation in CI.
 */
test.describe('E118 — Feedback trigger and modal', () => {
  // Mock GitHub Issues API for all tests
  test.beforeEach(async ({ page }) => {
    await page.route('https://api.github.com/repos/PedroLages/Knowlune/issues', route =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ number: 1 }) })
    )
    // Ensure sidebar localStorage state is set for tablet viewports
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
  })

  test('desktop: feedback trigger visible in sidebar on overview page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const trigger = page.getByTestId('feedback-trigger')
    await expect(trigger).toBeVisible()
  })

  test('desktop: clicking feedback trigger opens FeedbackModal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.getByTestId('feedback-trigger').click()
    await expect(page.getByRole('heading', { name: /send feedback/i })).toBeVisible()
  })

  test('desktop: modal closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.getByTestId('feedback-trigger').click()
    await expect(page.getByRole('heading', { name: /send feedback/i })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: /send feedback/i })).not.toBeVisible()
  })

  test('desktop: modal mode toggle switches between Bug Report and Feedback', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.getByTestId('feedback-trigger').click()
    // Default is Bug Report — steps field visible
    await expect(page.getByLabel(/steps to reproduce/i)).toBeVisible()
    // Switch to Feedback
    await page.getByRole('radio', { name: /feedback/i }).click()
    // Steps field should disappear
    await expect(page.getByLabel(/steps to reproduce/i)).not.toBeVisible()
    await expect(page.getByLabel(/message/i)).toBeVisible()
  })

  test('desktop: submit bug report flow — fills form and submits (mocked API)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.getByTestId('feedback-trigger').click()
    // Fill bug report form
    await page.getByLabel(/^title/i).fill('Test bug from E2E')
    await page.getByLabel(/description/i).fill('This is a test description with enough characters')
    const submitBtn = page.getByRole('button', { name: /^send$/i })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()
    // Modal should close and success toast should appear
    await expect(page.getByRole('heading', { name: /send feedback/i })).not.toBeVisible({ timeout: 5000 })
    // Toast notification
    await expect(page.getByText(/thanks.*feedback.*sent/i)).toBeVisible({ timeout: 5000 })
  })

  test('mobile (375px): feedback trigger visible in More drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // Open the More drawer
    await page.getByRole('button', { name: /more menu/i }).click()
    await expect(page.getByTestId('feedback-trigger-mobile')).toBeVisible()
  })

  test('mobile (375px): tapping feedback in More drawer opens modal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /more menu/i }).click()
    await page.getByTestId('feedback-trigger-mobile').click()
    await expect(page.getByRole('heading', { name: /send feedback/i })).toBeVisible()
  })
})
