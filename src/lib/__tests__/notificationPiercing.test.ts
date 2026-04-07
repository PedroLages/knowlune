import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  handleFocusModeNotification,
  flushSuppressedNotifications,
  clearSuppressedQueue,
} from '@/lib/notificationPiercing'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/focusModeState', () => ({
  isFocusModeActive: vi.fn(),
}))

import { toast } from 'sonner'
import { isFocusModeActive } from '@/lib/focusModeState'

beforeEach(() => {
  clearSuppressedQueue()
  vi.mocked(isFocusModeActive).mockReturnValue(false)
  vi.mocked(toast.warning).mockClear()
  vi.mocked(toast.info).mockClear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// handleFocusModeNotification
// ---------------------------------------------------------------------------

describe('handleFocusModeNotification', () => {
  it('returns false when focus mode is inactive', () => {
    vi.mocked(isFocusModeActive).mockReturnValue(false)
    const result = handleFocusModeNotification('course-complete', 'Done', 'Course finished')
    expect(result).toBe(false)
  })

  it('shows critical notifications immediately via toast.warning', () => {
    vi.mocked(isFocusModeActive).mockReturnValue(true)

    const result = handleFocusModeNotification('review-due', 'Review Due', 'Session expiring')
    expect(result).toBe(true)
    expect(toast.warning).toHaveBeenCalledWith(
      'Review Due',
      expect.objectContaining({
        description: 'Session expiring',
        duration: 8000,
      })
    )
  })

  it('treats srs-due as critical', () => {
    vi.mocked(isFocusModeActive).mockReturnValue(true)

    const result = handleFocusModeNotification('srs-due', 'SRS', 'Cards due')
    expect(result).toBe(true)
    expect(toast.warning).toHaveBeenCalled()
  })

  it('suppresses non-critical notifications', () => {
    vi.mocked(isFocusModeActive).mockReturnValue(true)

    const result = handleFocusModeNotification('course-complete', 'Done', 'Finished')
    expect(result).toBe(true)
    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('suppresses streak-milestone, import-finished, achievement-unlocked', () => {
    vi.mocked(isFocusModeActive).mockReturnValue(true)

    expect(handleFocusModeNotification('streak-milestone', 'A', 'B')).toBe(true)
    expect(handleFocusModeNotification('import-finished', 'A', 'B')).toBe(true)
    expect(handleFocusModeNotification('achievement-unlocked', 'A', 'B')).toBe(true)
  })

  it('returns false for unknown notification types during focus mode', () => {
    vi.mocked(isFocusModeActive).mockReturnValue(true)

    const result = handleFocusModeNotification('unknown-type' as never, 'X', 'Y')
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// flushSuppressedNotifications
// ---------------------------------------------------------------------------

describe('flushSuppressedNotifications', () => {
  it('does nothing when queue is empty', () => {
    flushSuppressedNotifications()
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('shows individual toasts for up to 5 queued notifications', () => {
    vi.mocked(isFocusModeActive).mockReturnValue(true)

    handleFocusModeNotification('course-complete', 'Course 1', 'Done')
    handleFocusModeNotification('streak-milestone', 'Streak', '7 days')
    handleFocusModeNotification('import-finished', 'Import', 'Complete')

    vi.mocked(isFocusModeActive).mockReturnValue(false)
    flushSuppressedNotifications()

    // Toasts are delayed via setTimeout
    vi.runAllTimers()
    expect(toast.info).toHaveBeenCalledTimes(3)
  })

  it('shows summary toast for more than 5 queued notifications', () => {
    vi.mocked(toast.info).mockClear()
    vi.mocked(isFocusModeActive).mockReturnValue(true)

    for (let i = 0; i < 6; i++) {
      handleFocusModeNotification('course-complete', `Course ${i}`, `Done ${i}`)
    }

    vi.mocked(isFocusModeActive).mockReturnValue(false)
    flushSuppressedNotifications()

    vi.runAllTimers()
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(toast.info).toHaveBeenCalledWith(
      '6 notifications while you were focused',
      expect.objectContaining({ duration: 8000 })
    )
  })

  it('empties the queue after flushing', () => {
    vi.mocked(toast.info).mockClear()
    vi.mocked(isFocusModeActive).mockReturnValue(true)
    handleFocusModeNotification('course-complete', 'A', 'B')

    flushSuppressedNotifications()
    vi.runAllTimers()
    vi.mocked(toast.info).mockClear()

    flushSuppressedNotifications()
    expect(toast.info).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// clearSuppressedQueue
// ---------------------------------------------------------------------------

describe('clearSuppressedQueue', () => {
  it('empties queued notifications without flushing', () => {
    vi.mocked(isFocusModeActive).mockReturnValue(true)
    handleFocusModeNotification('course-complete', 'A', 'B')
    handleFocusModeNotification('streak-milestone', 'C', 'D')

    clearSuppressedQueue()
    flushSuppressedNotifications()

    expect(toast.info).not.toHaveBeenCalled()
  })
})
