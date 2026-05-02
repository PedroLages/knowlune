import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeedbackSubmit } from '@/app/hooks/useFeedbackSubmit'
import type { FeedbackFormFields } from '@/lib/feedbackService'

// Deterministic date constant per ESLint test-patterns/deterministic-time rule
const FIXED_DATE = new Date('2026-04-21T10:00:00Z')

// Mock the auth store
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: null }) => unknown) =>
    selector({ user: null }),
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
    // Clear VITE_GITHUB_FEEDBACK_TOKEN from env
    vi.stubEnv('VITE_GITHUB_FEEDBACK_TOKEN', '')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('starts in idle status', () => {
    const { result } = renderHook(() => useFeedbackSubmit())
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  it('transitions to fallback when token is absent', async () => {
    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(bugFields)
    })

    expect(result.current.status).toBe('fallback')
    expect(result.current.fallbackText).toBeTruthy()
    expect(result.current.mailtoHref).toMatch(/^mailto:/)
  })

  it('transitions to fallback for feedback mode when token is absent', async () => {
    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(feedbackFields)
    })

    expect(result.current.status).toBe('fallback')
  })

  it('does not call fetch when token is absent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(bugFields)
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('transitions to success when token present and API returns 201', async () => {
    vi.stubEnv('VITE_GITHUB_FEEDBACK_TOKEN', 'test-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 201 } as Response)
    )

    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(bugFields)
    })

    expect(result.current.status).toBe('success')
    expect(result.current.error).toBeNull()
  })

  it('transitions to error with fallback text when API fails', async () => {
    vi.stubEnv('VITE_GITHUB_FEEDBACK_TOKEN', 'test-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response)
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

  it('reset() returns status to idle', async () => {
    const { result } = renderHook(() => useFeedbackSubmit())

    await act(async () => {
      await result.current.submit(bugFields)
    })

    expect(result.current.status).toBe('fallback')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.fallbackText).toBe('')
  })
})
