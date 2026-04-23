/**
 * Tests for writeNoticeAck — E119-S02 (AC-3)
 *
 * Verifies that the insert payload includes user_id (the NOT NULL FK column
 * that RLS enforces) and that failures propagate correctly to callers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const { mockInsert, mockGetUser } = vi.hoisted(() => {
  const mockInsert = vi.fn()
  const mockGetUser = vi.fn()
  return { mockInsert, mockGetUser }
})

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    from: () => ({ insert: mockInsert }),
    auth: { getUser: mockGetUser },
  },
}))

vi.mock('@/lib/compliance/noticeVersion', () => ({
  NOTICE_DOCUMENT_ID: 'privacy',
}))

import { writeNoticeAck } from '../noticeAck'

describe('writeNoticeAck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes user_id in the insert payload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-abc-123' } } })
    mockInsert.mockResolvedValue({ error: null })

    await writeNoticeAck('2026-04-23.1')

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-abc-123' }),
    )
  })

  it('includes document_id, version, and acknowledged_at in the insert payload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-abc-123' } } })
    mockInsert.mockResolvedValue({ error: null })

    await writeNoticeAck('2026-04-23.1')

    const payload = mockInsert.mock.calls[0][0]
    expect(payload.document_id).toBe('privacy')
    expect(payload.version).toBe('2026-04-23.1')
    expect(typeof payload.acknowledged_at).toBe('string')
  })

  it('throws when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await expect(writeNoticeAck('2026-04-23.1')).rejects.toThrow(
      /no authenticated user/,
    )
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('throws when supabase insert returns an error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-abc-123' } } })
    mockInsert.mockResolvedValue({ error: { message: 'db error' } })

    await expect(writeNoticeAck('2026-04-23.1')).rejects.toThrow(/db error/)
  })

  it('does not throw when insert succeeds', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-abc-123' } } })
    mockInsert.mockResolvedValue({ error: null })

    await expect(writeNoticeAck('2026-04-23.1')).resolves.toBeUndefined()
  })
})
