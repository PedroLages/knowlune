/**
 * E97-S05 Unit 6: Tests for ProviderKeyAccordion vault status badge wiring.
 *
 * These tests verify that the E97-S05 additions (vault/local/missing badges)
 * render correctly based on useMissingCredentials statusByKey.
 *
 * @since E97-S05
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockStatusByKey, mockGetAIConfiguration } = vi.hoisted(() => ({
  mockStatusByKey: vi.fn(() => ({})),
  mockGetAIConfiguration: vi.fn().mockReturnValue({
    provider: 'openai',
    connectionStatus: 'connected',
    consentSettings: {},
    providerKeys: { openai: { encrypted: 'enc', salt: 's', iv: 'i' } },
    apiKeyEncrypted: undefined,
  }),
}))

vi.mock('@/app/hooks/useMissingCredentials', () => ({
  useMissingCredentials: () => ({
    missing: [],
    statusByKey: mockStatusByKey(),
    loading: false,
  }),
}))

vi.mock('@/lib/aiConfiguration', () => ({
  AI_PROVIDERS: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      hasFreeModels: false,
      validateApiKey: (k: string) => k.startsWith('sk-'),
      testConnection: vi.fn().mockResolvedValue(true),
    },
    anthropic: {
      id: 'anthropic',
      name: 'Anthropic',
      hasFreeModels: false,
      validateApiKey: (k: string) => k.startsWith('sk-ant'),
      testConnection: vi.fn().mockResolvedValue(true),
    },
    groq: {
      id: 'groq',
      name: 'Groq',
      hasFreeModels: true,
      validateApiKey: () => true,
      testConnection: vi.fn().mockResolvedValue(true),
    },
    google: {
      id: 'google',
      name: 'Google Gemini',
      hasFreeModels: true,
      validateApiKey: () => true,
      testConnection: vi.fn().mockResolvedValue(true),
    },
  },
  getAIConfiguration: mockGetAIConfiguration,
  getDecryptedApiKeyForProvider: vi.fn().mockResolvedValue('sk-test'),
  saveProviderApiKey: vi.fn().mockResolvedValue(undefined),
  deleteProviderApiKey: vi.fn().mockResolvedValue(undefined),
  testAIConnection: vi.fn().mockResolvedValue(true),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { ProviderKeyAccordion } from '../ProviderKeyAccordion'

beforeEach(() => {
  mockStatusByKey.mockReturnValue({})
  vi.clearAllMocks()
})

describe('ProviderKeyAccordion — E97-S05 vault status badge', () => {
  it('vault status → renders vault badge (Synced via Vault) for OpenAI', () => {
    mockStatusByKey.mockReturnValue({ 'ai-provider:openai': 'vault' })

    render(<ProviderKeyAccordion onConfigChanged={vi.fn()} />)

    // The badge is rendered with showLabel=false, so aria-label is the accessible name
    const vaultBadge = screen.getByRole('img', { name: 'Synced via Vault' })
    expect(vaultBadge).toBeInTheDocument()
  })

  it('local status → renders "Local only" badge for OpenAI', () => {
    mockStatusByKey.mockReturnValue({ 'ai-provider:openai': 'local' })

    render(<ProviderKeyAccordion onConfigChanged={vi.fn()} />)

    expect(screen.getByRole('img', { name: 'Local only' })).toBeInTheDocument()
  })

  it('missing status → renders "Not configured" badge for OpenAI', () => {
    mockStatusByKey.mockReturnValue({ 'ai-provider:openai': 'missing' })

    render(<ProviderKeyAccordion onConfigChanged={vi.fn()} />)

    expect(screen.getByRole('img', { name: 'Not configured' })).toBeInTheDocument()
  })

  it('no status in map → no vault badge rendered', () => {
    mockStatusByKey.mockReturnValue({})

    render(<ProviderKeyAccordion onConfigChanged={vi.fn()} />)

    expect(screen.queryByRole('img', { name: 'Synced via Vault' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Local only' })).not.toBeInTheDocument()
  })
})
