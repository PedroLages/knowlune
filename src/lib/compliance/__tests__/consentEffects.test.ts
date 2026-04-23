/**
 * Unit tests for consentEffects — E119-S08
 *
 * Tests atomic withdrawal and grant operations with mocked Dexie and syncableWrite.
 * Covers: atomicity, rollback on failure, per-purpose effects, idempotency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mock factory ──────────────────────────────────────────────────────

const { mockSyncableWrite, mockAbortAll } = vi.hoisted(() => {
  const mockSyncableWrite = vi.fn()
  const mockAbortAll = vi.fn()
  return { mockSyncableWrite, mockAbortAll }
})

vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: mockSyncableWrite,
}))

vi.mock('@/ai/lib/inFlightRegistry', () => ({
  abortAllInFlightAIRequests: mockAbortAll,
}))

vi.mock('@/db/schema', () => {
  // Re-declare inner mocks inline (vi.hoisted values not accessible in factory)
  const toArray = vi.fn()
  const equals = vi.fn(() => ({ toArray }))
  const where = vi.fn(() => ({ equals }))

  const lmToArray = vi.fn()
  const lmEquals = vi.fn(() => ({ toArray: lmToArray }))
  const lmWhere = vi.fn(() => ({ equals: lmEquals }))
  const lmBulkPut = vi.fn()

  const embClear = vi.fn()
  const auClear = vi.fn()

  // Store refs so tests can access them
  ;(globalThis as Record<string, unknown>).__testMocks = {
    userConsentsToArray: toArray,
    learnerModelsToArray: lmToArray,
    learnerModelsBulkPut: lmBulkPut,
    embeddingsClear: embClear,
    aiUsageEventsClear: auClear,
  }

  return {
    db: {
      userConsents: { where },
      embeddings: { clear: embClear },
      learnerModels: { where: lmWhere, bulkPut: lmBulkPut },
      aiUsageEvents: { clear: auClear },
    },
  }
})

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

function getMocks() {
  return (globalThis as Record<string, unknown>).__testMocks as {
    userConsentsToArray: ReturnType<typeof vi.fn>
    learnerModelsToArray: ReturnType<typeof vi.fn>
    learnerModelsBulkPut: ReturnType<typeof vi.fn>
    embeddingsClear: ReturnType<typeof vi.fn>
    aiUsageEventsClear: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  const m = getMocks()
  m.userConsentsToArray.mockResolvedValue([])
  m.learnerModelsToArray.mockResolvedValue([])
  m.embeddingsClear.mockResolvedValue(undefined)
  m.aiUsageEventsClear.mockResolvedValue(undefined)
  m.learnerModelsBulkPut.mockResolvedValue(undefined)
  mockSyncableWrite.mockResolvedValue(undefined)
  mockAbortAll.mockReturnValue(undefined)
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
    getMocks().userConsentsToArray.mockResolvedValue([existingRow])

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
    getMocks().userConsentsToArray.mockResolvedValue([row])

    const result = await withdrawConsent(USER_ID, 'ai_tutor')

    expect(result).toEqual({ success: true })
    const [, , record] = mockSyncableWrite.mock.calls[0]
    expect(record.withdrawnAt).toBeTruthy()
    expect(record.userId).toBe(USER_ID)
    expect(record.purpose).toBe('ai_tutor')
  })

  it('calls abortAllInFlightAIRequests for ai_tutor withdrawal', async () => {
    getMocks().userConsentsToArray.mockResolvedValue([makeRow('ai_tutor')])

    await withdrawConsent(USER_ID, 'ai_tutor')

    expect(mockAbortAll).toHaveBeenCalledOnce()
  })

  it('does NOT call abortAllInFlightAIRequests for other purposes', async () => {
    getMocks().userConsentsToArray.mockResolvedValue([makeRow('marketing_email')])

    await withdrawConsent(USER_ID, 'marketing_email')

    expect(mockAbortAll).not.toHaveBeenCalled()
  })

  it('deletes embeddings and freezes learner models for ai_embeddings', async () => {
    const m = getMocks()
    m.userConsentsToArray.mockResolvedValue([makeRow('ai_embeddings')])
    const model = { id: 'm1', courseId: 'c1', userId: USER_ID, updatedAt: '2026-04-23T08:00:00Z' }
    m.learnerModelsToArray.mockResolvedValue([model])

    const result = await withdrawConsent(USER_ID, 'ai_embeddings')

    expect(result.success).toBe(true)
    expect(m.embeddingsClear).toHaveBeenCalledOnce()
    expect(m.learnerModelsBulkPut).toHaveBeenCalledOnce()
    const [frozenModels] = m.learnerModelsBulkPut.mock.calls[0]
    expect(frozenModels[0].frozenReason).toBe('consent_withdrawn')
  })

  it('deletes analytics events for analytics_telemetry', async () => {
    const m = getMocks()
    m.userConsentsToArray.mockResolvedValue([makeRow('analytics_telemetry')])

    const result = await withdrawConsent(USER_ID, 'analytics_telemetry')

    expect(result.success).toBe(true)
    expect(m.aiUsageEventsClear).toHaveBeenCalledOnce()
  })

  it('voice_transcription is a no-op (no queue to clear)', async () => {
    const m = getMocks()
    m.userConsentsToArray.mockResolvedValue([makeRow('voice_transcription')])

    const result = await withdrawConsent(USER_ID, 'voice_transcription')

    expect(result.success).toBe(true)
    expect(m.embeddingsClear).not.toHaveBeenCalled()
    expect(m.aiUsageEventsClear).not.toHaveBeenCalled()
  })

  it('marketing_email requires no extra DB operations', async () => {
    const m = getMocks()
    m.userConsentsToArray.mockResolvedValue([makeRow('marketing_email')])

    const result = await withdrawConsent(USER_ID, 'marketing_email')

    expect(result.success).toBe(true)
    expect(m.embeddingsClear).not.toHaveBeenCalled()
  })

  it('is idempotent: re-withdrawing updates withdrawnAt timestamp without error', async () => {
    const alreadyWithdrawn = makeRow('ai_tutor', { withdrawnAt: '2026-04-23T08:00:00Z' })
    getMocks().userConsentsToArray.mockResolvedValue([alreadyWithdrawn])

    const result = await withdrawConsent(USER_ID, 'ai_tutor')

    expect(result.success).toBe(true)
    const [, , record] = mockSyncableWrite.mock.calls[0]
    expect(record.withdrawnAt).not.toBe(alreadyWithdrawn.withdrawnAt)
  })

  it('rolls back withdrawnAt when the effect throws', async () => {
    const m = getMocks()
    m.userConsentsToArray.mockResolvedValue([makeRow('ai_embeddings')])
    m.embeddingsClear.mockRejectedValueOnce(new Error('Dexie clear failed'))

    const result = await withdrawConsent(USER_ID, 'ai_embeddings')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Dexie clear failed')
    // syncableWrite called twice: once for withdraw, once for rollback
    expect(mockSyncableWrite).toHaveBeenCalledTimes(2)
    const [, , rollbackRecord] = mockSyncableWrite.mock.calls[1]
    expect(rollbackRecord.withdrawnAt).toBeNull()
  })

  it('returns failure when initial syncableWrite fails', async () => {
    getMocks().userConsentsToArray.mockResolvedValue([makeRow('ai_tutor')])
    mockSyncableWrite.mockRejectedValueOnce(new Error('DB unavailable'))

    const result = await withdrawConsent(USER_ID, 'ai_tutor')

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB unavailable')
    expect(mockAbortAll).not.toHaveBeenCalled()
  })

  it('works when no existing consent row is found (creates a new row)', async () => {
    getMocks().userConsentsToArray.mockResolvedValue([])

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
