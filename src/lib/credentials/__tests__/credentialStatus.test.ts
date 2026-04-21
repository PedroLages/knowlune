/**
 * Tests for credential status aggregator — E97-S05 Unit 1.
 *
 * Tests the banner-eligible "missing" list and per-id status map logic,
 * including AI user-level trigger, per-provider badges, OPDS, and ABS.
 *
 * @since E97-S05
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCheckCredential, mockGetConfiguredProviderIds } = vi.hoisted(() => ({
  mockCheckCredential: vi.fn(),
  mockGetConfiguredProviderIds: vi.fn(),
}))

vi.mock('@/lib/vaultCredentials', () => ({
  checkCredential: mockCheckCredential,
}))

vi.mock('@/lib/aiConfiguration', () => ({
  getConfiguredProviderIds: mockGetConfiguredProviderIds,
}))

import { aggregateCredentialStatus } from '@/lib/credentials/credentialStatus'
import type { OpdsCatalog, AudiobookshelfServer } from '@/data/types'
import type { AIConfigurationSettings } from '@/lib/aiConfiguration'

function makeAiConfig(overrides: Partial<AIConfigurationSettings> = {}): AIConfigurationSettings {
  return {
    provider: 'openai',
    connectionStatus: 'unconfigured',
    consentSettings: {
      videoSummary: false,
      noteQA: false,
      learningPath: false,
      knowledgeGaps: false,
      noteOrganization: false,
      analytics: false,
    },
    ...overrides,
  } as AIConfigurationSettings
}

function makeOpds(overrides: Partial<OpdsCatalog> = {}): OpdsCatalog {
  return {
    id: 'cat-1',
    name: 'My Library',
    url: 'https://example.com/opds',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeAbs(overrides: Partial<AudiobookshelfServer> = {}): AudiobookshelfServer {
  return {
    id: 'srv-1',
    name: 'Home Server',
    url: 'http://192.168.1.50:13378',
    libraryIds: [],
    status: 'connected',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockCheckCredential.mockReset()
  mockGetConfiguredProviderIds.mockReset()
})

describe('aggregateCredentialStatus — happy paths', () => {
  it('returns empty missing when all credentials are vault-backed', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue(['openai'])
    mockCheckCredential.mockImplementation(async (kind: string, id: string) => {
      if (kind === 'ai-provider' && id === 'openai') return true
      if (kind === 'opds-catalog' && id === 'cat-1') return true
      if (kind === 'abs-server' && id === 'srv-1') return true
      return false
    })

    const result = await aggregateCredentialStatus({
      catalogs: [makeOpds({ auth: { username: 'user' } })],
      servers: [makeAbs()],
      aiConfig: makeAiConfig({ providerKeys: { openai: { encrypted: 'enc', salt: 's', iv: 'i' } as any } }),
    })

    expect(result.missing).toHaveLength(0)
    expect(result.statusByKey['ai-provider:openai']).toBe('vault')
    expect(result.statusByKey['opds-catalog:cat-1']).toBe('vault')
    expect(result.statusByKey['abs-server:srv-1']).toBe('vault')
  })

  it('per-provider badge: AI provider with Vault credential → vault status', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue(['openai'])
    mockCheckCredential.mockResolvedValue(true)

    const result = await aggregateCredentialStatus({
      catalogs: [],
      servers: [],
      aiConfig: makeAiConfig({ providerKeys: { openai: { encrypted: 'enc', salt: 's', iv: 'i' } as any } }),
    })

    expect(result.statusByKey['ai-provider:openai']).toBe('vault')
    expect(result.missing).toHaveLength(0)
  })
})

describe('aggregateCredentialStatus — AI banner trigger logic', () => {
  it('Vault-configured, no local: NO synthetic AI entry', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue(['openai'])
    mockCheckCredential.mockResolvedValue(true)

    const result = await aggregateCredentialStatus({
      catalogs: [],
      servers: [],
      aiConfig: makeAiConfig({ providerKeys: undefined }),
    })

    expect(result.missing).toHaveLength(0)
  })

  it('local-only (banner eligible): exactly ONE synthetic AI entry', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([])
    // Vault says no for openai
    mockCheckCredential.mockImplementation(async (kind: string, id: string) => {
      if (kind === 'ai-provider' && id === 'openai') return false
      return false
    })

    const result = await aggregateCredentialStatus({
      catalogs: [],
      servers: [],
      aiConfig: makeAiConfig({
        providerKeys: { openai: { encrypted: 'enc', salt: 's', iv: 'i' } as any },
      }),
    })

    expect(result.missing).toHaveLength(1)
    expect(result.missing[0]).toMatchObject({
      kind: 'ai-provider',
      id: '__ai-section__',
      displayName: 'AI provider keys',
      status: 'missing',
    })
    expect(result.statusByKey['ai-provider:openai']).toBe('local')
  })

  it('both Vault and local (already synced): NO synthetic AI entry', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue(['openai'])
    mockCheckCredential.mockResolvedValue(true)

    const result = await aggregateCredentialStatus({
      catalogs: [],
      servers: [],
      aiConfig: makeAiConfig({
        providerKeys: { openai: { encrypted: 'enc', salt: 's', iv: 'i' } as any },
      }),
    })

    expect(result.missing).toHaveLength(0)
    expect(result.statusByKey['ai-provider:openai']).toBe('vault')
  })

  it('nothing configured: NO synthetic AI entry', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([])
    mockCheckCredential.mockResolvedValue(false)

    const result = await aggregateCredentialStatus({
      catalogs: [],
      servers: [],
      aiConfig: makeAiConfig({ providerKeys: undefined, apiKeyEncrypted: undefined }),
    })

    expect(result.missing).toHaveLength(0)
  })

  it('legacy apiKeyEncrypted variant: counts as local, synthetic AI entry IS added', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([])
    mockCheckCredential.mockImplementation(async (kind: string, id: string) => {
      if (kind === 'ai-provider' && id === 'openai') return false
      return false
    })

    const result = await aggregateCredentialStatus({
      catalogs: [],
      servers: [],
      aiConfig: makeAiConfig({
        apiKeyEncrypted: { encrypted: 'enc', salt: 's', iv: 'i' } as any,
        provider: 'openai',
        providerKeys: undefined,
      }),
    })

    expect(result.missing).toHaveLength(1)
    expect(result.missing[0].id).toBe('__ai-section__')
    expect(result.statusByKey['ai-provider:openai']).toBe('local')
  })

  it('per-provider badge: legacy apiKeyEncrypted → local for matching provider', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([])
    mockCheckCredential.mockResolvedValue(false)

    const result = await aggregateCredentialStatus({
      catalogs: [],
      servers: [],
      aiConfig: makeAiConfig({
        provider: 'openai',
        apiKeyEncrypted: { encrypted: 'enc', salt: 's', iv: 'i' } as any,
        providerKeys: undefined,
      }),
    })

    expect(result.statusByKey['ai-provider:openai']).toBe('local')
  })
})

describe('aggregateCredentialStatus — OPDS', () => {
  it('anonymous catalog (no auth.username) → anonymous status', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([])
    mockCheckCredential.mockResolvedValue(false)

    const result = await aggregateCredentialStatus({
      catalogs: [makeOpds({ auth: undefined })],
      servers: [],
      aiConfig: makeAiConfig(),
    })

    expect(result.statusByKey['opds-catalog:cat-1']).toBe('anonymous')
    expect(result.missing).toHaveLength(0)
  })

  it('auth.username set + checkCredential false → missing, added to list', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([])
    mockCheckCredential.mockImplementation(async (kind: string) => {
      if (kind === 'opds-catalog') return false
      return false
    })

    const result = await aggregateCredentialStatus({
      catalogs: [makeOpds({ auth: { username: 'user' } })],
      servers: [],
      aiConfig: makeAiConfig(),
    })

    expect(result.statusByKey['opds-catalog:cat-1']).toBe('missing')
    expect(result.missing.some(m => m.kind === 'opds-catalog' && m.id === 'cat-1')).toBe(true)
  })
})

describe('aggregateCredentialStatus — ABS', () => {
  it('ABS server with checkCredential false → missing, added to list', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([])
    mockCheckCredential.mockImplementation(async (kind: string) => {
      if (kind === 'abs-server') return false
      return false
    })

    const result = await aggregateCredentialStatus({
      catalogs: [],
      servers: [makeAbs()],
      aiConfig: makeAiConfig(),
    })

    expect(result.statusByKey['abs-server:srv-1']).toBe('missing')
    expect(result.missing.some(m => m.kind === 'abs-server' && m.id === 'srv-1')).toBe(true)
  })
})

describe('aggregateCredentialStatus — error paths', () => {
  it('checkCredential throws → status missing with transient:true, does not throw', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([])
    // Make inner impl throw for opds
    mockCheckCredential.mockImplementation(async (kind: string) => {
      if (kind === 'opds-catalog') throw new Error('network error')
      return false
    })

    const result = await aggregateCredentialStatus({
      catalogs: [makeOpds({ auth: { username: 'user' } })],
      servers: [],
      aiConfig: makeAiConfig(),
    })

    expect(result.missing.some(m => m.kind === 'opds-catalog' && m.transient === true)).toBe(true)
  })

  it('unauthenticated: getConfiguredProviderIds returns [] and checkCredential returns false → empty missing', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([])
    mockCheckCredential.mockResolvedValue(false)

    const result = await aggregateCredentialStatus({
      catalogs: [],
      servers: [],
      aiConfig: makeAiConfig({ providerKeys: undefined }),
    })

    expect(result.missing).toHaveLength(0)
  })
})

describe('aggregateCredentialStatus — integration: mixed state', () => {
  it('AI local-only (banner eligible) + 1 OPDS missing + anon OPDS + 2 ABS ok → missing.length === 2', async () => {
    mockGetConfiguredProviderIds.mockResolvedValue([]) // no Vault AI
    mockCheckCredential.mockImplementation(async (kind: string, id: string) => {
      if (kind === 'ai-provider') return false
      if (kind === 'opds-catalog' && id === 'cat-missing') return false
      if (kind === 'opds-catalog' && id === 'cat-anon') return true // won't be called (anon)
      if (kind === 'abs-server') return true // both ABS are ok
      return false
    })

    const result = await aggregateCredentialStatus({
      catalogs: [
        makeOpds({ id: 'cat-missing', name: 'Protected', auth: { username: 'user' } }),
        makeOpds({ id: 'cat-anon', name: 'Public', url: 'https://pub.example.com/opds' }),
      ],
      servers: [
        makeAbs({ id: 'srv-a', name: 'Server A' }),
        makeAbs({ id: 'srv-b', name: 'Server B' }),
      ],
      aiConfig: makeAiConfig({
        providerKeys: { openai: { encrypted: 'enc', salt: 's', iv: 'i' } as any },
      }),
    })

    // 1 synthetic AI + 1 OPDS = 2
    expect(result.missing).toHaveLength(2)
    expect(result.missing.some(m => m.kind === 'ai-provider')).toBe(true)
    expect(result.missing.some(m => m.kind === 'opds-catalog' && m.id === 'cat-missing')).toBe(true)

    // statusByKey has correct keys
    expect(result.statusByKey['opds-catalog:cat-anon']).toBe('anonymous')
    expect(result.statusByKey['abs-server:srv-a']).toBe('vault')
    expect(result.statusByKey['abs-server:srv-b']).toBe('vault')
  })
})
