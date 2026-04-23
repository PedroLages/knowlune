/**
 * Unit tests for consentEffects — E119-S08
 *
 * Tests atomic withdrawal and grant operations with mocked Dexie and syncableWrite.
 * Covers: atomicity, rollback on failure, per-purpose effects, idempotency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock factory (avoids "before initialization" hoisting error) ─────

const {
  mockSyncableWrite,
  mockAbortAll,
  mockUserConsentsWhere,
  mockEmbeddingsClear,
  mockLearnerModelsWhere,
  mockLearnerModelsBulkPut,
  mockAiUsageEventsClear,
  mockUserConsentsFirst,
  mockLearnerModelsToArray,
} = vi.hoisted(() => {
  const mockUserConsentsFirst = vi.fn()
  const mockUserConsentsEquals = vi.fn(() => ({ first: mockUserConsentsFirst }))
  const mockUserConsentsWhere = vi.fn(() => ({ equals: mockUserConsentsEquals }))

  const mockLearnerModelsToArray = vi.fn()
  const mockLearnerModelsEquals = vi.fn(() => ({ toArray: mockLearnerModelsToArray }))
  const mockLearnerModelsWhere = vi.fn(() => ({ equals: mockLearnerModelsEquals }))
  const mockLearnerModelsBulkPut = vi.fn()

  const mockEmbeddingsClear = vi.fn()
  const mockAiUsageEventsClear = vi.fn()
  const mockSyncableWrite = vi.fn()
  const mockAbortAll = vi.fn()

  return {
    mockSyncableWrite,
    mockAbortAll,
    mockUserConsentsWhere,
    mockEmbeddingsClear,
    mockLearnerModelsWhere,
    mockLearnerModelsBulkPut,
    mockAiUsageEventsClear,
    mockUserConsentsFirst,
    mockLearnerModelsToArray,
  }
})

vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: mockSyncableWrite,
}))

vi.mock('@/ai/lib/inFlightRegistry', () => ({
  abortAllInFlightAIRequests: mockAbortAll,
}))

vi.mock('@/db/schema', () => ({
  db: {
    userConsents: { where: mockUserConsentsWhere },
    embeddings: { clear: mockEmbeddingsClear },
    learnerModels: {
      where: mockLearnerModelsWhere,
      bulkPut: mockLearnerModelsBulkPut,
    },
    aiUsageEvents: { clear: mockAiUsageEventsClear },
  },
}))

vi.mock('@/lib/compliance/noticeVersion', () => ({
  CURRENT_NOTICE_VERSION: '2026-04-23.1',
}))

import { grantConsent, withdrawConsent, CONSENT_PURPOSE_META } from '../consentEffects'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1'
const NOTICE = '2026-04-23.1'

function makeRow(purpose: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'consent-1',
    userId: USER_ID,
    purpose,
    grantedAt: '2026-04-23T10:00:00Z',
    withdrawnAt: null,
    noticeVersion: NOTICE,
    evidence: {},
    createdAt: '2026-04-23T10:00:00Z',
    updatedAt: '2026-04-23T10:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUserConsentsFirst.mockResolvedValue(undefined)
  mockSyncableWrite.mockResolvedValue(undefined)
  mockLearnerModelsToArray.mockResolvedValue([])
  mockEmbeddingsClear.mockResolvedValue(undefined)
  mockAiUsageEventsClear.mockResolvedValue(undefined)
  mockLearnerModelsBulkPut.mockResolvedValue(undefined)
})

// ─── grantConsent ─────────────────────────────────────────────────────────────

describe('grantConsent', () => {
  it('returns success:true and calls syncableWrite with grantedAt set', async () => {
    const result = await grantConsent(USER_ID, 'ai_tutor')

    expect(result).toEqual({ success: true })
    expect(mockSyncableWrite).toHaveBeenCalledOnce()
    const [table, op, record] = mockSyncableWrite.mock.calls[0]
    expect(table).toBe('userConsents')
    expect(op).toBe('put')
    expect(record.userId).toBe(USER_ID)
    expect(record.purpose).toBe('ai_tutor')
    expect(record.grantedAt).toBeTruthy()
    expect(record.withdrawnAt).toBeNull()
    expect(record.noticeVersion).toBe(NOTICE)
  })

  it('updates grantedAt and clears withdrawnAt when re-granting (idempotent)', async () => {
    const existingRow = makeRow('analytics_telemetry', { withdrawnAt: '2026-04-23T09:00:00Z' })
    mockUserConsentsFirst.mockResolvedValue(existingRow)

    const result = await grantConsent(USER_ID, 'analytics_telemetry')

    expect(result).toEqual({ success: true })
    const [, , record] = mockSyncableWrite.mock.calls[0]
    expect(record.withdrawnAt).toBeNull()
    expect(record.grantedAt).toBeTruthy()
    expect(record.id).toBe(existingRow.id)
    expect(record.createdAt).toBe(existingRow.createdAt)
  })

  it('returns success:false when syncableWrite throws', async () => {
    mockSyncableWrite.mockRejectedValueOnce(new Error('DB write failed'))

    const result = await grantConsent(USER_ID, 'ai_tutor')

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB write failed')
  })
})

// ─── withdrawConsent ──────────────────────────────────────────────────────────

describe('withdrawConsent', () => {
  it('returns success:true and sets withdrawnAt for ai_tutor', async () => {
    const row = makeRow('ai_tutor')
    mockUserConsentsFirst.mockResolvedValue(row)

    const result = await withdrawConsent(USER_ID, 'ai_tutor')

    expect(result).toEqual({ success: true })
    const [, , record] = mockSyncableWrite.mock.calls[0]
    expect(record.withdrawnAt).toBeTruthy()
    expect(record.userId).toBe(USER_ID)
    expect(record.purpose).toBe('ai_tutor')
  })

  it('calls abortAllInFlightAIRequests for ai_tutor withdrawal', async () => {
    mockUserConsentsFirst.mockResolvedValue(makeRow('ai_tutor'))

    await withdrawConsent(USER_ID, 'ai_tutor')

    expect(mockAbortAll).toHaveBeenCalledOnce()
  })

  it('does NOT call abortAllInFlightAIRequests for other purposes', async () => {
    mockUserConsentsFirst.mockResolvedValue(makeRow('marketing_email'))

    await withdrawConsent(USER_ID, 'marketing_email')

    expect(mockAbortAll).not.toHaveBeenCalled()
  })

  it('deletes embeddings and freezes learner models for ai_embeddings', async () => {
    const row = makeRow('ai_embeddings')
    mockUserConsentsFirst.mockResolvedValue(row)
    const model = { id: 'm1', courseId: 'c1', userId: USER_ID, updatedAt: '2026-04-23T08:00:00Z' }
    mockLearnerModelsToArray.mockResolvedValue([model])

    const result = await withdrawConsent(USER_ID, 'ai_embeddings')

    expect(result.success).toBe(true)
    expect(mockEmbeddingsClear).toHaveBeenCalledOnce()
    expect(mockLearnerModelsBulkPut).toHaveBeenCalledOnce()
    const [frozenModels] = mockLearnerModelsBulkPut.mock.calls[0]
    expect(frozenModels[0].frozenReason).toBe('consent_withdrawn')
  })

  it('deletes analytics events for analytics_telemetry', async () => {
    mockUserConsentsFirst.mockResolvedValue(makeRow('analytics_telemetry'))

    const result = await withdrawConsent(USER_ID, 'analytics_telemetry')

    expect(result.success).toBe(true)
    expect(mockAiUsageEventsClear).toHaveBeenCalledOnce()
  })

  it('voice_transcription is a no-op (no queue to clear)', async () => {
    mockUserConsentsFirst.mockResolvedValue(makeRow('voice_transcription'))

    const result = await withdrawConsent(USER_ID, 'voice_transcription')

    expect(result.success).toBe(true)
    expect(mockEmbeddingsClear).not.toHaveBeenCalled()
    expect(mockAiUsageEventsClear).not.toHaveBeenCalled()
  })

  it('marketing_email requires no extra DB operations', async () => {
    mockUserConsentsFirst.mockResolvedValue(makeRow('marketing_email'))

    const result = await withdrawConsent(USER_ID, 'marketing_email')

    expect(result.success).toBe(true)
    expect(mockEmbeddingsClear).not.toHaveBeenCalled()
  })

  it('is idempotent: re-withdrawing updates withdrawnAt timestamp without error', async () => {
    const alreadyWithdrawn = makeRow('ai_tutor', { withdrawnAt: '2026-04-23T08:00:00Z' })
    mockUserConsentsFirst.mockResolvedValue(alreadyWithdrawn)

    const result = await withdrawConsent(USER_ID, 'ai_tutor')

    expect(result.success).toBe(true)
    const [, , record] = mockSyncableWrite.mock.calls[0]
    expect(record.withdrawnAt).not.toBe(alreadyWithdrawn.withdrawnAt)
  })

  it('rolls back withdrawnAt when the effect throws', async () => {
    const row = makeRow('ai_embeddings')
    mockUserConsentsFirst.mockResolvedValue(row)
    mockEmbeddingsClear.mockRejectedValueOnce(new Error('Dexie clear failed'))

    const result = await withdrawConsent(USER_ID, 'ai_embeddings')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Dexie clear failed')
    // syncableWrite called twice: once for withdraw, once for rollback
    expect(mockSyncableWrite).toHaveBeenCalledTimes(2)
    const [, , rollbackRecord] = mockSyncableWrite.mock.calls[1]
    // Rollback restores original withdrawnAt (null in this case)
    expect(rollbackRecord.withdrawnAt).toBeNull()
  })

  it('returns failure when initial syncableWrite fails', async () => {
    mockUserConsentsFirst.mockResolvedValue(makeRow('ai_tutor'))
    mockSyncableWrite.mockRejectedValueOnce(new Error('DB unavailable'))

    const result = await withdrawConsent(USER_ID, 'ai_tutor')

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB unavailable')
    // Effect should not run if the initial write fails
    expect(mockAbortAll).not.toHaveBeenCalled()
  })

  it('works when no existing consent row is found (creates a new row)', async () => {
    mockUserConsentsFirst.mockResolvedValue(undefined)

    const result = await withdrawConsent(USER_ID, 'marketing_email')

    expect(result.success).toBe(true)
    const [, , record] = mockSyncableWrite.mock.calls[0]
    expect(record.id).toBeTruthy()
    expect(record.withdrawnAt).toBeTruthy()
  })
})

// ─── CONSENT_PURPOSE_META ─────────────────────────────────────────────────────

describe('CONSENT_PURPOSE_META', () => {
  it('contains entries for all five consent purposes', () => {
    const purposes = [
      'ai_tutor',
      'ai_embeddings',
      'voice_transcription',
      'analytics_telemetry',
      'marketing_email',
    ]
    for (const p of purposes) {
      expect(CONSENT_PURPOSE_META).toHaveProperty(p)
      const meta = CONSENT_PURPOSE_META[p as keyof typeof CONSENT_PURPOSE_META]
      expect(meta.label).toBeTruthy()
      expect(meta.withdrawalCopy).toBeTruthy()
      expect(meta.dataCategories).toBeTruthy()
    }
  })
})
