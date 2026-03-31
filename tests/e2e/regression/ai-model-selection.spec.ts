/**
 * E2E Tests: E90-S11 — AI Model Selection Flows
 *
 * Covers:
 * - AC1: Zero-override backward compatibility (default models used when no featureModels)
 * - AC2: Global model picker updates model for all features
 * - AC3: Per-feature override takes precedence over global model
 * - AC4: "Reset to defaults" clears override, reverts to global
 * - AC5: Settings page renders model picker, overrides, temperature sliders without errors
 * - AC6: Multi-provider key entry and per-feature provider switch
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { TIMEOUTS } from '../../utils/constants'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ai-configuration'

/** Default AI config with no feature overrides — simulates fresh user */
const BASE_CONFIG = {
  provider: 'openai',
  connectionStatus: 'connected',
  consentSettings: {
    videoSummary: true,
    noteQA: true,
    learningPath: true,
    knowledgeGaps: true,
    noteOrganization: true,
    analytics: true,
  },
  _testApiKey: 'sk-test-1234567890abcdef',
}

/** Config with a per-feature override for videoSummary */
const CONFIG_WITH_OVERRIDE = {
  ...BASE_CONFIG,
  featureModels: {
    videoSummary: {
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      temperature: 0.3,
    },
  },
}

/** Config with multi-provider keys */
const CONFIG_MULTI_PROVIDER = {
  ...BASE_CONFIG,
  providerKeys: {
    openai: { ciphertext: 'mock', iv: 'mock', salt: 'mock' },
    anthropic: { ciphertext: 'mock', iv: 'mock', salt: 'mock' },
  },
}

/** Config with global model override */
const CONFIG_GLOBAL_OVERRIDE = {
  ...BASE_CONFIG,
  globalModelOverride: {
    openai: 'gpt-4-turbo',
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeds AI config in localStorage and navigates to Settings */
async function seedAndNavigate(page: Page, config: Record<string, unknown>) {
  // Seed AI config before page JS runs
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    },
    [STORAGE_KEY, config] as const
  )
  // navigateAndWait handles onboarding dismissal and sidebar seeding
  await navigateAndWait(page, '/settings')
  // Wait for the AI Configuration section to be visible
  await expect(page.getByText('AI Configuration')).toBeVisible({ timeout: TIMEOUTS.LONG })
}

/** Reads the current AI config from localStorage */
async function getStoredConfig(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }, STORAGE_KEY)
}

// ---------------------------------------------------------------------------
// AC1: Zero-override backward compatibility
// ---------------------------------------------------------------------------

test.describe('AC1: Default models without overrides', () => {
  test('config without featureModels uses FEATURE_DEFAULTS', async ({ page }) => {
    await seedAndNavigate(page, BASE_CONFIG)

    // Verify stored config has no featureModels
    const config = await getStoredConfig(page)
    expect(config.featureModels).toBeUndefined()

    // resolveFeatureModel should fall through to FEATURE_DEFAULTS
    // We verify this indirectly: the override toggles should all be OFF
    const overrideToggle = page.getByTestId('override-toggle-videoSummary')
    await expect(overrideToggle).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(overrideToggle).not.toBeChecked()
  })

  test('all consent toggles visible and enabled by default', async ({ page }) => {
    await seedAndNavigate(page, BASE_CONFIG)

    const toggles = page.getByTestId('consent-toggles')
    await expect(toggles).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Check that consent toggles for the features are checked
    for (const feature of ['videoSummary', 'noteQA', 'learningPath']) {
      const toggle = page.getByTestId(`consent-${feature}`)
      await expect(toggle).toBeChecked()
    }
  })
})

// ---------------------------------------------------------------------------
// AC2: Global model picker updates model used by all features
// ---------------------------------------------------------------------------

test.describe('AC2: Global model picker', () => {
  test('global model override persists to localStorage', async ({ page }) => {
    await seedAndNavigate(page, CONFIG_GLOBAL_OVERRIDE)

    const config = await getStoredConfig(page)
    expect(config.globalModelOverride).toBeDefined()
    expect(config.globalModelOverride.openai).toBe('gpt-4-turbo')
  })
})

// ---------------------------------------------------------------------------
// AC3: Per-feature override takes precedence over global
// ---------------------------------------------------------------------------

test.describe('AC3: Per-feature override precedence', () => {
  test('feature with override shows override config in UI', async ({ page }) => {
    await seedAndNavigate(page, CONFIG_WITH_OVERRIDE)

    // The override toggle for videoSummary should be ON
    const overrideToggle = page.getByTestId('override-toggle-videoSummary')
    await expect(overrideToggle).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(overrideToggle).toBeChecked()

    // The override panel should be expanded with provider select visible
    const providerSelect = page.getByTestId('override-provider-videoSummary')
    await expect(providerSelect).toBeVisible()
  })

  test('feature override persists in localStorage', async ({ page }) => {
    await seedAndNavigate(page, CONFIG_WITH_OVERRIDE)

    const config = await getStoredConfig(page)
    expect(config.featureModels?.videoSummary).toBeDefined()
    expect(config.featureModels.videoSummary.provider).toBe('anthropic')
    expect(config.featureModels.videoSummary.model).toBe('claude-haiku-4-5')
  })

  test('non-overridden feature stays at default (toggle off)', async ({ page }) => {
    await seedAndNavigate(page, CONFIG_WITH_OVERRIDE)

    // noteQA has no override — toggle should be OFF
    const noteQAToggle = page.getByTestId('override-toggle-noteQA')
    await expect(noteQAToggle).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(noteQAToggle).not.toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// AC4: Reset to defaults clears override
// ---------------------------------------------------------------------------

test.describe('AC4: Reset to defaults', () => {
  test('clicking reset clears override from localStorage', async ({ page }) => {
    await seedAndNavigate(page, CONFIG_WITH_OVERRIDE)

    // Verify override is active
    const overrideToggle = page.getByTestId('override-toggle-videoSummary')
    await expect(overrideToggle).toBeChecked({ timeout: TIMEOUTS.LONG })

    // Click Reset to defaults
    const resetButton = page.getByTestId('override-reset-videoSummary')
    await expect(resetButton).toBeVisible()
    await resetButton.click()

    // Override toggle should now be OFF
    await expect(overrideToggle).not.toBeChecked({ timeout: TIMEOUTS.MEDIUM })

    // localStorage should no longer have the override
    const config = await getStoredConfig(page)
    expect(config.featureModels?.videoSummary).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// AC5: Settings page renders without console errors
// ---------------------------------------------------------------------------

test.describe('AC5: Settings page rendering', () => {
  test('renders model picker, overrides, and temperature controls without errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await seedAndNavigate(page, CONFIG_WITH_OVERRIDE)

    // Model override panel for videoSummary should be expanded
    const overridePanel = page.getByTestId('feature-override-videoSummary')
    await expect(overridePanel).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Temperature slider should be visible in the override panel
    const tempSlider = page.getByTestId('override-temperature-videoSummary')
    await expect(tempSlider).toBeVisible()

    // Max tokens input should be visible
    const maxTokens = page.getByTestId('override-max-tokens-videoSummary')
    await expect(maxTokens).toBeVisible()

    // Provider dropdown should be visible
    const providerSelect = page.getByTestId('override-provider-videoSummary')
    await expect(providerSelect).toBeVisible()

    // No console errors related to our components
    const relevantErrors = consoleErrors.filter(
      err =>
        err.includes('model') ||
        err.includes('override') ||
        err.includes('temperature') ||
        err.includes('Cannot read')
    )
    expect(relevantErrors).toHaveLength(0)
  })

  test('consent toggles section is visible', async ({ page }) => {
    await seedAndNavigate(page, BASE_CONFIG)

    const toggles = page.getByTestId('consent-toggles')
    await expect(toggles).toBeVisible({ timeout: TIMEOUTS.LONG })
  })
})

// ---------------------------------------------------------------------------
// AC6: Multi-provider key entry
// ---------------------------------------------------------------------------

test.describe('AC6: Multi-provider key management', () => {
  test('provider key accordion renders for configured providers', async ({ page }) => {
    await seedAndNavigate(page, CONFIG_MULTI_PROVIDER)

    const accordion = page.getByTestId('provider-key-accordion')
    await expect(accordion).toBeVisible({ timeout: TIMEOUTS.LONG })
  })

  test('provider key inputs accept values', async ({ page }) => {
    await seedAndNavigate(page, BASE_CONFIG)

    // The provider key accordion should be visible
    const accordion = page.getByTestId('provider-key-accordion')
    await expect(accordion).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Expand OpenAI provider section
    const openaiProvider = page.getByTestId('provider-openai')
    await expect(openaiProvider).toBeVisible()
    await openaiProvider.locator('button').first().click()

    // API key input should appear
    const apiKeyInput = page.getByTestId('api-key-input-openai')
    await expect(apiKeyInput).toBeVisible({ timeout: TIMEOUTS.MEDIUM })
    expect(await apiKeyInput.getAttribute('type')).toBe('password')
  })

  test('multi-provider config persists providerKeys in localStorage', async ({ page }) => {
    await seedAndNavigate(page, CONFIG_MULTI_PROVIDER)

    const config = await getStoredConfig(page)
    expect(config.providerKeys).toBeDefined()
    expect(config.providerKeys.openai).toBeDefined()
    expect(config.providerKeys.anthropic).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Integration: Enable override via toggle interaction
// ---------------------------------------------------------------------------

test.describe('Integration: Toggle override on/off', () => {
  test('enabling override toggle expands panel with provider select', async ({ page }) => {
    await seedAndNavigate(page, BASE_CONFIG)

    // Find the noteQA override toggle (should be OFF initially)
    const toggle = page.getByTestId('override-toggle-noteQA')
    await expect(toggle).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(toggle).not.toBeChecked()

    // Enable the override
    await toggle.click()
    await expect(toggle).toBeChecked({ timeout: TIMEOUTS.MEDIUM })

    // Provider select should appear (panel expanded)
    const providerSelect = page.getByTestId('override-provider-noteQA')
    await expect(providerSelect).toBeVisible({ timeout: TIMEOUTS.MEDIUM })

    // Temperature controls should appear
    const tempSection = page.getByTestId('override-temperature-noteQA')
    await expect(tempSection).toBeVisible()
  })

  test('disabling override toggle collapses panel', async ({ page }) => {
    await seedAndNavigate(page, CONFIG_WITH_OVERRIDE)

    const toggle = page.getByTestId('override-toggle-videoSummary')
    await expect(toggle).toBeChecked({ timeout: TIMEOUTS.LONG })

    // Disable the override
    await toggle.click()
    await expect(toggle).not.toBeChecked({ timeout: TIMEOUTS.MEDIUM })

    // Provider select should no longer be visible (panel collapsed)
    const providerSelect = page.getByTestId('override-provider-videoSummary')
    await expect(providerSelect).not.toBeVisible({ timeout: TIMEOUTS.MEDIUM })
  })
})
