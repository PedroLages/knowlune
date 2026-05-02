/**
 * E119-S07: consentService unit tests
 *
 * Tests the fail-closed gatekeeper functions with a mocked Dexie database.
 * Covers: isGranted, listForUser, isGrantedForProvider.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Dexie db ────────────────────────────────────────────────────────────

const { mockUserConsentsWhere } = vi.hoisted(() => {
  const mockToArray = vi.fn()
  const mockEquals = vi.fn(() => ({ toArray: mockToArray }))
  const mockWhere = vi.fn(() => ({ equals: mockEquals }))
  return { mockUserConsentsWhere: { where: mockWhere, mockToArray, mockEquals } }
})

vi.mock('@/db/schema', () => ({
  db: {
    userConsents: {
      where: mockUserConsentsWhere.where,
    },
  },
}))

import {
  isGranted,
  listForUser,
  isGrantedForProvider,
  CONSENT_PURPOSES,
} from '../consentService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1'
const NOTICE = '2026-04-23.1'

function makeGrantedRow(purpose: string, overrides: Record<string, unknown> = {}) {
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

function mockRows(rows: unknown[]) {
  mockUserConsentsWhere.mockToArray.mockResolvedValue(rows)
}

function mockError(err: Error) {
  mockUserConsentsWhere.mockToArray.mockRejectedValue(err)
}

// ─── isGranted ────────────────────────────────────────────────────────────────

describe('isGranted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when consent row is granted (grantedAt set, withdrawnAt null)', async () => {
    mockRows([makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR)])
    expect(await isGranted(USER_ID, CONSENT_PURPOSES.AI_TUTOR)).toBe(true)
  })

  it('returns false when consent is withdrawn (withdrawnAt set)', async () => {
    mockRows([
      makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR, {
        withdrawnAt: '2026-04-23T11:00:00Z',
      }),
    ])
    expect(await isGranted(USER_ID, CONSENT_PURPOSES.AI_TUTOR)).toBe(false)
  })

  it('returns false when no consent row exists', async () => {
    mockRows([])
    expect(await isGranted(USER_ID, CONSENT_PURPOSES.AI_TUTOR)).toBe(false)
  })

  it('returns false when grantedAt is null (never granted)', async () => {
    mockRows([
      makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR, {
        grantedAt: null,
        withdrawnAt: null,
      }),
    ])
    expect(await isGranted(USER_ID, CONSENT_PURPOSES.AI_TUTOR)).toBe(false)
  })

  it('returns false and warns for unknown purpose (fail-closed)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await isGranted(USER_ID, 'unknown_purpose')).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown purpose "unknown_purpose"'),
    )
    warnSpy.mockRestore()
  })

  it('returns false and logs error on DB failure (fail-closed)', async () => {
    mockError(new Error('IndexedDB unavailable'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await isGranted(USER_ID, CONSENT_PURPOSES.AI_EMBEDDINGS)).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failing closed'),
    )
    errorSpy.mockRestore()
  })
})

// ─── listForUser ──────────────────────────────────────────────────────────────

describe('listForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all consent rows for the user', async () => {
    const rows = [
      makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR),
      makeGrantedRow(CONSENT_PURPOSES.AI_EMBEDDINGS),
    ]
    mockRows(rows)
    const result = await listForUser(USER_ID)
    expect(result).toHaveLength(2)
    expect(result[0].purpose).toBe(CONSENT_PURPOSES.AI_TUTOR)
  })

  it('returns empty array on DB error', async () => {
    mockError(new Error('DB error'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await listForUser(USER_ID)).toEqual([])
    errorSpy.mockRestore()
  })
})

// ─── isGrantedForProvider ─────────────────────────────────────────────────────

describe('isGrantedForProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when consent granted for the correct provider', async () => {
    mockRows([
      makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR, {
        evidence: { provider_id: 'openai' },
      }),
    ])
    expect(await isGrantedForProvider(USER_ID, CONSENT_PURPOSES.AI_TUTOR, 'openai')).toBe(true)
  })

  it('returns false when consent granted but for a different provider', async () => {
    mockRows([
      makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR, {
        evidence: { provider_id: 'openai' },
      }),
    ])
    // Called twice: once for isGranted, once for provider check
    mockUserConsentsWhere.mockToArray
      .mockResolvedValueOnce([makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR, { evidence: { provider_id: 'openai' } })])
      .mockResolvedValueOnce([makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR, { evidence: { provider_id: 'openai' } })])
    expect(await isGrantedForProvider(USER_ID, CONSENT_PURPOSES.AI_TUTOR, 'anthropic')).toBe(false)
  })

  it('returns false when consent granted but no provider_id in evidence (legacy row)', async () => {
    mockUserConsentsWhere.mockToArray
      .mockResolvedValueOnce([makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR)])
      .mockResolvedValueOnce([makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR)])
    expect(
      await isGrantedForProvider(USER_ID, CONSENT_PURPOSES.AI_TUTOR, 'openai'),
    ).toBe(false)
  })

  it('returns false when base consent is withdrawn (delegates to isGranted)', async () => {
    mockRows([
      makeGrantedRow(CONSENT_PURPOSES.AI_TUTOR, {
        withdrawnAt: '2026-04-23T11:00:00Z',
        evidence: { provider_id: 'openai' },
      }),
    ])
    expect(
      await isGrantedForProvider(USER_ID, CONSENT_PURPOSES.AI_TUTOR, 'openai'),
    ).toBe(false)
  })

  it('returns false for unknown purpose (fail-closed)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await isGrantedForProvider(USER_ID, 'bad_purpose', 'openai')).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown purpose "bad_purpose"'),
    )
    warnSpy.mockRestore()
  })
})
