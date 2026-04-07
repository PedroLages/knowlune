import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getRetentionSettings, saveRetentionSettings, TTL_OPTIONS } from '@/lib/dataPruning'

// ---------------------------------------------------------------------------
// Mock Dexie db
// ---------------------------------------------------------------------------

vi.mock('@/db', () => ({
  db: {
    studySessions: {
      where: vi.fn().mockReturnValue({
        below: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(0),
        }),
      }),
    },
    aiUsageEvents: {
      where: vi.fn().mockReturnValue({
        below: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(0),
        }),
      }),
    },
    embeddings: {
      toArray: vi.fn().mockResolvedValue([]),
      bulkDelete: vi.fn().mockResolvedValue(undefined),
    },
    notes: {
      toCollection: vi.fn().mockReturnValue({
        primaryKeys: vi.fn().mockResolvedValue([]),
      }),
    },
  },
}))

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k])
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key]
    }),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// TTL_OPTIONS
// ---------------------------------------------------------------------------

describe('TTL_OPTIONS', () => {
  it('contains expected retention period values', () => {
    const values = TTL_OPTIONS.map(o => o.value)
    expect(values).toEqual([30, 60, 90, 180, 0])
  })

  it('includes "Keep forever" for value 0', () => {
    const forever = TTL_OPTIONS.find(o => o.value === 0)
    expect(forever?.label).toBe('Keep forever')
  })
})

// ---------------------------------------------------------------------------
// getRetentionSettings
// ---------------------------------------------------------------------------

describe('getRetentionSettings', () => {
  it('returns defaults when nothing saved', () => {
    const settings = getRetentionSettings()
    expect(settings.studySessionsTTL).toBe(90)
    expect(settings.aiUsageEventsTTL).toBe(90)
    expect(settings.pruneOrphanedEmbeddings).toBe(true)
  })

  it('merges saved settings with defaults', () => {
    mockStorage['data-retention-settings'] = JSON.stringify({ studySessionsTTL: 30 })
    const settings = getRetentionSettings()
    expect(settings.studySessionsTTL).toBe(30)
    expect(settings.aiUsageEventsTTL).toBe(90) // default preserved
  })

  it('returns defaults on corrupted JSON', () => {
    mockStorage['data-retention-settings'] = '{{invalid'
    const settings = getRetentionSettings()
    expect(settings.studySessionsTTL).toBe(90)
  })
})

// ---------------------------------------------------------------------------
// saveRetentionSettings
// ---------------------------------------------------------------------------

describe('saveRetentionSettings', () => {
  it('saves partial updates merged with current settings', () => {
    const result = saveRetentionSettings({ studySessionsTTL: 60 })
    expect(result.studySessionsTTL).toBe(60)
    expect(result.aiUsageEventsTTL).toBe(90) // default preserved
    expect(mockStorage['data-retention-settings']).toBeDefined()
  })

  it('returns updated settings', () => {
    saveRetentionSettings({ studySessionsTTL: 30 })
    const result = saveRetentionSettings({ aiUsageEventsTTL: 180 })
    expect(result.studySessionsTTL).toBe(30)
    expect(result.aiUsageEventsTTL).toBe(180)
  })
})

// ---------------------------------------------------------------------------
// runDataPruning
// ---------------------------------------------------------------------------

describe('runDataPruning', () => {
  it('can be imported and called', async () => {
    const { runDataPruning } = await import('@/lib/dataPruning')
    const result = await runDataPruning()
    expect(result).toHaveProperty('studySessionsPruned')
    expect(result).toHaveProperty('aiUsageEventsPruned')
    expect(result).toHaveProperty('embeddingsPruned')
  })

  it('returns zero counts when nothing to prune', async () => {
    const { runDataPruning } = await import('@/lib/dataPruning')
    const result = await runDataPruning()
    expect(result.studySessionsPruned).toBe(0)
    expect(result.aiUsageEventsPruned).toBe(0)
    expect(result.embeddingsPruned).toBe(0)
  })

  it('skips pruning when TTL is 0 (keep forever)', async () => {
    saveRetentionSettings({ studySessionsTTL: 0, aiUsageEventsTTL: 0 })
    const { runDataPruning } = await import('@/lib/dataPruning')

    const result = await runDataPruning()

    expect(result.studySessionsPruned).toBe(0)
    expect(result.aiUsageEventsPruned).toBe(0)
  })

  it('skips orphaned embeddings when disabled', async () => {
    saveRetentionSettings({ pruneOrphanedEmbeddings: false })
    const { runDataPruning } = await import('@/lib/dataPruning')

    const result = await runDataPruning()
    expect(result.embeddingsPruned).toBe(0)
  })
})
