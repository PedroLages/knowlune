import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeedbackSubmit } from '@/app/hooks/useFeedbackSubmit'
import type { FeedbackFormFields } from '@/lib/feedbackService'

// Deterministic date constant per ESLint test-patterns/deterministic-time rule
const FIXED_DATE = new Date('2026-04-21T10:00:00Z')

// Mock the auth store
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: null }) => unknown) => selector({ user: null }),
}))

// Mock supabase client — return a valid session by default
const mockGetSession = vi.fn()
vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}))

const bugFields: FeedbackFormFields = {
  mode: 'bug',
  title: 'Test bug',
  description: 'Something broke',
}

const feedbackFields: FeedbackFormFields = {
  mode: 'feedback',
  message: 'Great app!',
}

describe('useFeedbackSubmit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
    // Default: authenticated session
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-jwt' } },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts in idle status', () => {
    const { result } = renderHook(() => useFeedbackSubmit())
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  it('transitions to success when Edge Function returns ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      } as Response)
    )

    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(bugFields)
    })

    expect(result.current.status).toBe('success')
    expect(result.current.error).toBeNull()
  })

  it('transitions to success for feedback mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      } as Response)
    )

    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(feedbackFields)
    })

    expect(result.current.status).toBe('success')
  })

  it('transitions to error with fallback text when Edge Function fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ ok: false, error: 'GitHub returned 500' }),
      } as Response)
    )

    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(bugFields)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeTruthy()
    expect(result.current.fallbackText).toBeTruthy()
    expect(result.current.mailtoHref).toMatch(/^mailto:/)
  })

  it('transitions to fallback when Edge Function returns 401 (unauthenticated)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ ok: false, error: 'Unauthorized — valid Supabase JWT required' }),
      } as Response)
    )

    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(bugFields)
    })

    expect(result.current.status).toBe('fallback')
    expect(result.current.fallbackText).toBeTruthy()
    expect(result.current.mailtoHref).toMatch(/^mailto:/)
  })

  it('reset() returns status to idle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      } as Response)
    )

    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(bugFields)
    })

    expect(result.current.status).toBe('success')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.fallbackText).toBe('')
  })
})
