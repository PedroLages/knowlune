import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Challenge } from '@/data/types'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { custom: vi.fn() },
}))

// Mock the toast component to avoid importing React component tree
vi.mock('@/app/components/celebrations/ChallengeMilestoneToast', () => ({
  ChallengeMilestoneToast: () => null,
}))

import { fireMilestoneToasts } from '@/lib/fireMilestoneToasts'

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'ch-1',
    name: 'Watch 4 Videos',
    type: 'completion',
    targetValue: 4,
    deadline: '2030-12-31',
    createdAt: new Date().toISOString(),
    currentProgress: 0,
    celebratedMilestones: [],
    ...overrides,
  }
}

describe('fireMilestoneToasts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty array for empty milestone map', () => {
    const result = fireMilestoneToasts(new Map(), [])
    expect(result).toEqual([])
  })

  it('returns timer IDs that can be cleared', () => {
    const challenges = [makeChallenge()]
    const milestoneMap = new Map([['ch-1', [25, 50]]])

    const timerIds = fireMilestoneToasts(milestoneMap, challenges)

    expect(timerIds).toHaveLength(2)
    // Timer IDs should be defined and clearable without throwing
    timerIds.forEach(id => {
      expect(id).toBeDefined()
      expect(() => clearTimeout(id)).not.toThrow()
    })
  })

  it('fires toasts with 500ms stagger', async () => {
    const { toast } = await import('sonner')
    const challenges = [makeChallenge()]
    const milestoneMap = new Map([['ch-1', [25, 50, 75]]])

    fireMilestoneToasts(milestoneMap, challenges)

    // No toasts fired yet (first fires at 0ms)
    expect(toast.custom).not.toHaveBeenCalled()

    // Advance to first toast (0ms)
    vi.advanceTimersByTime(0)
    expect(toast.custom).toHaveBeenCalledTimes(1)

    // Advance to second toast (500ms)
    vi.advanceTimersByTime(500)
    expect(toast.custom).toHaveBeenCalledTimes(2)

    // Advance to third toast (1000ms)
    vi.advanceTimersByTime(500)
    expect(toast.custom).toHaveBeenCalledTimes(3)
  })

  it('skips unknown challenge IDs', () => {
    const challenges = [makeChallenge({ id: 'ch-1' })]
    const milestoneMap = new Map([['unknown-id', [25]]])

    const timerIds = fireMilestoneToasts(milestoneMap, challenges)
    expect(timerIds).toEqual([])
  })

  it('cleanup cancels pending toasts', async () => {
    const { toast } = await import('sonner')
    vi.mocked(toast.custom).mockClear()

    const challenges = [makeChallenge()]
    const milestoneMap = new Map([['ch-1', [25, 50]]])

    const timerIds = fireMilestoneToasts(milestoneMap, challenges)

    // Fire first toast
    vi.advanceTimersByTime(0)
    expect(toast.custom).toHaveBeenCalledTimes(1)

    // Clear remaining timers (simulating useEffect cleanup)
    timerIds.forEach(id => clearTimeout(id))

    // Advance past second toast — it should NOT fire
    vi.advanceTimersByTime(1000)
    expect(toast.custom).toHaveBeenCalledTimes(1)
  })
})
