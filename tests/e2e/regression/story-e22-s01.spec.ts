import { test, expect, type Page } from '@playwright/test'

/**
 * E22-S01: Ollama Provider Integration
 *
 * Acceptance Criteria:
 * - AC1: "Ollama" appears in the provider dropdown
 * - AC2: Selecting Ollama shows URL input (not API key) with correct placeholder
 * - AC3: Proxy mode is the default (no direct connection toggle active)
 * - AC4: Advanced section contains Direct Connection toggle
 * - AC5: Saving an Ollama URL persists it and updates CSP connect-src
 * - AC6: OllamaDirectClient is exercised via factory (covered by unit tests)
 */

/** Select Ollama in the provider dropdown */
async function selectOllamaProvider(page: Page) {
  await page.getByTestId('ai-provider-selector').click()
  await page.getByRole('option', { name: 'Ollama (Local)' }).click()
  // Wait for state update after async handleProviderChange
  await page.waitForSelector('[data-testid="ollama-url-input"]', { timeout: 5000 })
}

test.describe('E22-S01: Ollama Provider Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Set sidebar + clear AI config before page loads
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.removeItem('ai-configuration')
    })
    await page.goto('/settings')
    // Ensure AI Configuration section is mounted
    await page.waitForSelector('[data-testid="ai-provider-selector"]', { timeout: 10000 })
  })

  test('AC1: Ollama appears in provider dropdown', async ({ page }) => {
    await page.getByTestId('ai-provider-selector').click()
    await expect(page.getByRole('option', { name: 'Ollama (Local)' })).toBeVisible()
  })

  test('AC2: Selecting Ollama shows URL text input (not password field)', async ({ page }) => {
    await selectOllamaProvider(page)

    const urlInput = page.getByTestId('ollama-url-input')
    await expect(urlInput).toBeVisible()
    await expect(urlInput).toHaveAttribute('type', 'text')
    await expect(urlInput).toHaveAttribute('placeholder', 'http://192.168.1.x:11434')

    // API key password input should NOT be present
    await expect(page.getByTestId('api-key-input')).not.toBeVisible()
  })

  test('AC2: URL input label reads "Ollama Server URL"', async ({ page }) => {
    await selectOllamaProvider(page)

    await expect(page.locator('label[for="api-key"]')).toHaveText('Ollama Server URL')
  })

  test('AC4: Advanced section contains Direct Connection toggle', async ({ page }) => {
    await selectOllamaProvider(page)

    // Advanced toggle button should be visible
    const advancedToggle = page.getByTestId('ollama-advanced-toggle')
    await expect(advancedToggle).toBeVisible()
    await expect(advancedToggle).toContainText('Advanced')

    // Open advanced section
    await advancedToggle.click()

    // Direct connection switch should appear
    await expect(page.getByTestId('ollama-direct-toggle')).toBeVisible()

    // Should show CORS info text
    await expect(page.locator('text=OLLAMA_ORIGINS')).toBeVisible()
  })

  test('AC3: Direct connection defaults to off (proxy mode)', async ({ page }) => {
    await selectOllamaProvider(page)
    await page.getByTestId('ollama-advanced-toggle').click()

    const directToggle = page.getByTestId('ollama-direct-toggle')
    await expect(directToggle).toHaveAttribute('aria-checked', 'false')
  })

  test('AC5: Saving Ollama URL persists to localStorage with correct fields', async ({ page }) => {
    await selectOllamaProvider(page)

    await page.getByTestId('ollama-url-input').fill('http://192.168.1.100:11434')
    await page.getByTestId('save-ai-config-button').click()

    // Wait for success feedback
    await expect(page.getByTestId('save-ai-config-button')).toHaveText('Saved!', {
      timeout: 5000,
    })

    // Verify localStorage
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('ai-configuration')
      return raw ? JSON.parse(raw) : null
    })
    expect(stored).not.toBeNull()
    expect(stored.provider).toBe('ollama')
    expect(stored.ollamaBaseUrl).toBe('http://192.168.1.100:11434')
    expect(stored.connectionStatus).toBe('connected')
    // URL should NOT be encrypted (stored plaintext)
    expect(stored.apiKeyEncrypted).toBeUndefined()
  })

  test('AC5: Saving Ollama URL updates CSP connect-src meta tag', async ({ page }) => {
    await selectOllamaProvider(page)

    await page.getByTestId('ollama-url-input').fill('http://192.168.1.100:11434')
    await page.getByTestId('save-ai-config-button').click()

    await expect(page.getByTestId('save-ai-config-button')).toHaveText('Saved!', {
      timeout: 5000,
    })

    const cspContent = await page.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      return meta?.getAttribute('content') ?? ''
    })
    expect(cspContent).toContain('http://192.168.1.100:11434')
  })

  test('AC2: Validation rejects non-URL input', async ({ page }) => {
    await selectOllamaProvider(page)

    await page.getByTestId('ollama-url-input').fill('not-a-valid-url')
    await page.getByTestId('save-ai-config-button').click()

    // Should show validation error
    const errorEl = page.getByTestId('connection-error')
    await expect(errorEl).toBeVisible()
    await expect(errorEl).toContainText('http://')
  })

  test('AC5: Ollama URL in localStorage is applied to CSP on page load', async ({ browser }) => {
    // Use a fresh browser context so beforeEach addInitScript doesn't interfere
    const context = await browser.newContext()
    const freshPage = await context.newPage()

    try {
      // Seed config before the page loads via addInitScript
      await freshPage.addInitScript(() => {
        localStorage.setItem('knowlune-sidebar-v1', 'false')
        localStorage.setItem(
          'ai-configuration',
          JSON.stringify({
            provider: 'ollama',
            ollamaBaseUrl: 'http://10.0.0.5:11434',
            connectionStatus: 'connected',
            consentSettings: {
              videoSummary: true,
              noteQA: true,
              learningPath: true,
              knowledgeGaps: true,
              noteOrganization: true,
              analytics: true,
            },
          })
        )
      })

      await freshPage.goto('/settings')
      await freshPage.waitForLoadState('domcontentloaded')

      const cspContent = await freshPage.evaluate(() => {
        const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
        return meta?.getAttribute('content') ?? ''
      })
      expect(cspContent).toContain('http://10.0.0.5:11434')
    } finally {
      await context.close()
    }
  })
})
