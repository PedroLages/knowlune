/**
 * Tests for useNoticeAcknowledgement and useSoftBlock — E119-S02 (AC-4, AC-6)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Hoisted mocks (must be declared with vi.hoisted before vi.mock) ────────

const { mockFrom, mockSelect, mockEq, mockOrder, mockLimit } = vi.hoisted(() => {
  const mockLimit = vi.fn()
  const mockOrder = vi.fn()
  const mockEq = vi.fn()
  const mockSelect = vi.fn()
  const chain = { select: mockSelect, eq: mockEq, order: mockOrder, limit: mockLimit }
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
  mockOrder.mockReturnValue(chain)
  const mockFrom = vi.fn(() => chain)
  return { mockFrom, mockSelect, mockEq, mockOrder, mockLimit }
})

// Mock Supabase client
vi.mock('@/lib/auth/supabase', () => ({
  supabase: { from: mockFrom },
}))

// Mock auth store — start with an authenticated user
const mockUser = { id: 'user-123', email: 'test@example.com' }
let currentUser: typeof mockUser | null = mockUser

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: typeof mockUser | null }) => unknown) =>
    selector({ user: currentUser }),
}))

// Mock CURRENT_NOTICE_VERSION — use a fixed date well in the past so
// staleDays is a known positive number in tests (> 30 days).
vi.mock('@/lib/compliance/noticeVersion', () => ({
  CURRENT_NOTICE_VERSION: '2025-01-15.1',
  NOTICE_DOCUMENT_ID: 'privacy',
  parseNoticeVersion: (version: string) => {
    const match = /^(\d{4}-\d{2}-\d{2})\.(\d+)$/.exec(version)
    if (!match) throw new Error(`Invalid version: ${version}`)
    return { isoDate: match[1], revision: parseInt(match[2], 10) }
  },
}))

// ── Import under test (after mocks) ───────────────────────────────────────
import { useNoticeAcknowledgement } from '../useNoticeAcknowledgement'
import { useSoftBlock } from '../useSoftBlock'

// ── Helpers ───────────────────────────────────────────────────────────────

function setupChain() {
  const chain = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
  }
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
  mockOrder.mockReturnValue(chain)
  mockFrom.mockReturnValue(chain)
}

function mockQueryResult(rows: Array<{ version: string }> | null, error?: { message: string }) {
  mockLimit.mockResolvedValueOnce({ data: rows, error: error ?? null })
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('useNoticeAcknowledgement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentUser = mockUser
    setupChain()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns fail-open defaults before query resolves', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockLimit.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useNoticeAcknowledgement())
    expect(result.current.acknowledged).toBe(true)
    expect(result.current.stale).toBe(false)
  })

  it('happy path: no rows → acknowledged:false, stale:false', async () => {
    mockQueryResult([])
    const { result } = renderHook(() => useNoticeAcknowledgement())
    await waitFor(() => expect(result.current.acknowledged).toBe(false))
    expect(result.current.stale).toBe(false)
    expect(typeof result.current.staleDays).toBe('number')
    expect(result.current.staleDays).toBeGreaterThanOrEqual(0)
  })

  it('happy path: row with CURRENT_NOTICE_VERSION → acknowledged:true, stale:false', async () => {
    mockQueryResult([{ version: '2025-01-15.1' }])
    const { result } = renderHook(() => useNoticeAcknowledgement())
    await waitFor(() => expect(result.current.acknowledged).toBe(true))
    expect(result.current.stale).toBe(false)
  })

  it('happy path: row with older version → acknowledged:false, stale:true', async () => {
    mockQueryResult([{ version: '2024-01-01.1' }])
    const { result } = renderHook(() => useNoticeAcknowledgement())
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.acknowledged).toBe(false)
    expect(result.current.staleDays).toBeGreaterThan(0)
  })

  it('edge case: unauthenticated user → fail-open, no query fired', () => {
    currentUser = null
    const { result } = renderHook(() => useNoticeAcknowledgement())
    expect(result.current.acknowledged).toBe(true)
    expect(result.current.stale).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('error path: Supabase query error → fail-open (acknowledged:true, stale:false)', async () => {
    mockQueryResult(null, { message: 'connection error' })
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useNoticeAcknowledgement())
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useNoticeAcknowledgement]'),
        expect.any(String),
      )
    })
    expect(result.current.acknowledged).toBe(true)
    expect(result.current.stale).toBe(false)
    consoleSpy.mockRestore()
  })

  it('refetch() re-runs the query', async () => {
    mockQueryResult([{ version: '2024-01-01.1' }])
    const { result } = renderHook(() => useNoticeAcknowledgement())
    await waitFor(() => expect(result.current.stale).toBe(true))

    // Simulate user re-acknowledging — next query returns current version
    setupChain()
    mockQueryResult([{ version: '2025-01-15.1' }])
    act(() => {
      result.current.refetch()
    })
    await waitFor(() => expect(result.current.acknowledged).toBe(true))
    expect(result.current.stale).toBe(false)
  })
})

describe('useSoftBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentUser = mockUser
    setupChain()
  })

  it('returns false when acknowledged (current version)', async () => {
    mockQueryResult([{ version: '2025-01-15.1' }])
    const { result } = renderHook(() => useSoftBlock())
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('returns true when stale and staleDays > 30 (notice date is 2025-01-15 = many days ago)', async () => {
    mockQueryResult([{ version: '2024-01-01.1' }]) // stale
    const { result } = renderHook(() => useSoftBlock())
    // CURRENT_NOTICE_VERSION is mocked to 2025-01-15.1 — well over 30 days ago
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('returns false for unauthenticated user', () => {
    currentUser = null
    const { result } = renderHook(() => useSoftBlock())
    expect(result.current).toBe(false)
  })

  it('returns false when no ack row at all (acknowledged:false, stale:false)', async () => {
    mockQueryResult([]) // no rows
    const { result } = renderHook(() => useSoftBlock())
    // stale=false → soft block is false even if staleDays > 30
    await waitFor(() => expect(result.current).toBe(false))
  })
})
