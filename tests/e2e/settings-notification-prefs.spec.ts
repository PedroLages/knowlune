import { test, expect } from '@playwright/test'

test.describe('Smart Trigger Notification Preferences', () => {
  test.beforeEach(async ({ page }) => {
    // Seed localStorage via addInitScript so values are present before React hydration
    await page.addInitScript(() => {
      try {
        localStorage.setItem('knowlune-sidebar-v1', 'false')
        localStorage.setItem(
          'knowlune-onboarding-v1',
          JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
        )
      } catch {
        // about:blank throws SecurityError — ignore, runs again on real URL
      }
    })
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    // Dismiss onboarding dialog if it appears despite localStorage seed
    const skipButton = page.getByRole('button', { name: 'Skip for now' })
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click()
      await expect(skipButton).not.toBeVisible()
    }
  })

  test('renders three smart trigger toggles', async ({ page }) => {
    await expect(page.getByText('Smart Triggers')).toBeVisible()
    await expect(page.getByText('Knowledge Decay Alerts')).toBeVisible()
    await expect(page.getByText('Content Recommendations')).toBeVisible()
    await expect(page.getByText('Milestone Progress')).toBeVisible()
  })

  test('smart trigger toggles have correct data-testid selectors', async ({ page }) => {
    await expect(page.locator('[data-testid="smart-trigger-knowledge-decay"]')).toBeVisible()
    await expect(page.locator('[data-testid="smart-trigger-recommendation-match"]')).toBeVisible()
    await expect(page.locator('[data-testid="smart-trigger-milestone-approaching"]')).toBeVisible()
  })

  test('toggle persists across reload', async ({ page }) => {
    const toggle = page.locator(
      '[data-testid="smart-trigger-milestone-approaching"] [role="switch"]'
    )

    // Confirm starts checked (enabled by default)
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('data-state', 'checked')

    // Use store API directly to toggle off — the Switch click isn't reliable
    // in E2E because Agentation dev toolbar may intercept pointer events
    await page.evaluate(async () => {
      const mod = await import('/src/stores/useNotificationPrefsStore')
      await mod.useNotificationPrefsStore.getState().setTypeEnabled('milestone-approaching', false)
    })

    // Reload to verify persistence (store reads from IndexedDB on init)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Dismiss onboarding if it reappears
    const skipButton = page.getByRole('button', { name: 'Skip for now' })
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click()
      await expect(skipButton).not.toBeVisible()
    }

    const toggleAfterReload = page.locator(
      '[data-testid="smart-trigger-milestone-approaching"] [role="switch"]'
    )
    await expect(toggleAfterReload).toBeVisible()
    await expect(toggleAfterReload).toHaveAttribute('data-state', 'unchecked')
  })

  test('no console errors on settings page load', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/settings')
    await expect(page.getByText('Smart Triggers')).toBeVisible()

    const criticalErrors = consoleErrors.filter(
      err => !err.includes('favicon') && !err.includes('net::ERR')
    )

    expect(criticalErrors).toHaveLength(0)
  })
})
