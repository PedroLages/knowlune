import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createChallenge } from '../../../tests/support/fixtures/factories/challenge-factory'

// Mock persistWithRetry to run operation once (no retries).
// Retry logic is tested in persistWithRetry's own tests.
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

// Mock sonner toast for error assertions
// toast is used both as a function (toastWithUndo) and as an object with methods (toast.error)
vi.mock('sonner', () => {
  const toastFn = vi.fn() as ReturnType<typeof vi.fn> & {
    error: ReturnType<typeof vi.fn>
    success: ReturnType<typeof vi.fn>
    custom: ReturnType<typeof vi.fn>
    promise: ReturnType<typeof vi.fn>
  }
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  toastFn.custom = vi.fn()
  toastFn.promise = vi.fn()
  return { toast: toastFn }
})

// Mock challengeProgress so refreshAllProgress tests are isolated
vi.mock('@/lib/challengeProgress', () => ({
  calculateProgress: vi.fn().mockResolvedValue(0),
}))

// Import store AFTER mock is set up
const { useChallengeStore } = await import('@/stores/useChallengeStore')

beforeEach(async () => {
  vi.restoreAllMocks()
  useChallengeStore.setState({ challenges: [], isLoading: false, error: null })
  const { db } = await import('@/db')
  await db.challenges.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useChallengeStore initial state', () => {
  it('should have empty initial state', () => {
    const state = useChallengeStore.getState()
    expect(state.challenges).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})

describe('addChallenge', () => {
  it('should add a challenge optimistically', async () => {
    await act(async () => {
      await useChallengeStore.getState().addChallenge({
        name: 'Watch 10 videos',
        type: 'completion',
        targetValue: 10,
        deadline: '2030-12-31',
      })
    })

    const state = useChallengeStore.getState()
    expect(state.challenges).toHaveLength(1)
    expect(state.challenges[0].name).toBe('Watch 10 videos')
    expect(state.challenges[0].type).toBe('completion')
    expect(state.challenges[0].targetValue).toBe(10)
    expect(state.challenges[0].currentProgress).toBe(0)
    expect(state.challenges[0].celebratedMilestones).toEqual([])
    expect(state.error).toBeNull()
  })

  it('should persist challenge to IndexedDB with correct fields', async () => {
    await act(async () => {
      await useChallengeStore.getState().addChallenge({
        name: 'Study 20 hours',
        type: 'time',
        targetValue: 20,
        deadline: '2030-06-15',
      })
    })

    const { db } = await import('@/db')
    const all = await db.challenges.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBeTruthy()
    expect(all[0].name).toBe('Study 20 hours')
    expect(all[0].type).toBe('time')
    expect(all[0].targetValue).toBe(20)
    expect(all[0].deadline).toBe('2030-06-15')
    expect(all[0].createdAt).toBeTruthy()
    expect(all[0].currentProgress).toBe(0)
    expect(all[0].celebratedMilestones).toEqual([])
  })

  it('should generate a UUID id and ISO createdAt', async () => {
    await act(async () => {
      await useChallengeStore.getState().addChallenge({
        name: 'Streak 7 days',
        type: 'streak',
        targetValue: 7,
        deadline: '2030-01-01',
      })
    })

    const challenge = useChallengeStore.getState().challenges[0]
    expect(challenge.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(new Date(challenge.createdAt).toISOString()).toBe(challenge.createdAt)
  })

  it('should rollback on persistence failure', async () => {
    const swModule = await import('@/lib/sync/syncableWrite')
    vi.spyOn(swModule, 'syncableWrite').mockRejectedValue(new Error('DB write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      useChallengeStore.getState().addChallenge({
        name: 'Fail challenge',
        type: 'completion',
        targetValue: 5,
        deadline: '2030-01-01',
      })
    ).rejects.toThrow('DB write failed')

    const state = useChallengeStore.getState()
    expect(state.challenges).toHaveLength(0)
    expect(state.error).toBe('Failed to create challenge')
  })
})

describe('deleteChallenge', () => {
  it('should remove challenge from state', async () => {
    await act(async () => {
      await useChallengeStore.getState().addChallenge({
        name: 'To delete',
        type: 'completion',
        targetValue: 5,
        deadline: '2030-01-01',
      })
    })

    const id = useChallengeStore.getState().challenges[0].id

    await act(async () => {
      await useChallengeStore.getState().deleteChallenge(id)
    })

    expect(useChallengeStore.getState().challenges).toHaveLength(0)
  })

  it('should remove challenge from IndexedDB', async () => {
    await act(async () => {
      await useChallengeStore.getState().addChallenge({
        name: 'Persist then delete',
        type: 'time',
        targetValue: 10,
        deadline: '2030-01-01',
      })
    })

    const { db } = await import('@/db')
    const id = useChallengeStore.getState().challenges[0].id

    await act(async () => {
      await useChallengeStore.getState().deleteChallenge(id)
    })

    const remaining = await db.challenges.toArray()
    expect(remaining).toHaveLength(0)
  })

  it('should rollback and toast on persistence failure', async () => {
    await act(async () => {
      await useChallengeStore.getState().addChallenge({
        name: 'Sticky challenge',
        type: 'streak',
        targetValue: 30,
        deadline: '2030-01-01',
      })
    })

    const id = useChallengeStore.getState().challenges[0].id
    const swModuleD = await import('@/lib/sync/syncableWrite')
    vi.spyOn(swModuleD, 'syncableWrite').mockRejectedValue(new Error('DB delete failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(useChallengeStore.getState().deleteChallenge(id)).rejects.toThrow(
      'DB delete failed'
    )

    const state = useChallengeStore.getState()
    expect(state.challenges).toHaveLength(1)
    expect(state.challenges[0].name).toBe('Sticky challenge')
    expect(state.error).toBe('Failed to delete challenge')
  })
})

describe('loadChallenges', () => {
  it('should load challenges from IndexedDB', async () => {
    const { db } = await import('@/db')
    await db.challenges.add(
      createChallenge({
        name: 'Preexisting challenge',
        type: 'completion',
        targetValue: 5,
        deadline: '2030-01-01',
        currentProgress: 2,
      })
    )

    await act(async () => {
      await useChallengeStore.getState().loadChallenges()
    })

    const state = useChallengeStore.getState()
    expect(state.challenges).toHaveLength(1)
    expect(state.challenges[0].name).toBe('Preexisting challenge')
    expect(state.isLoading).toBe(false)
  })

  it('should set error on failure', async () => {
    const { db } = await import('@/db')
    vi.spyOn(db.challenges, 'orderBy').mockImplementation(() => {
      throw new Error('DB read failed')
    })

    await act(async () => {
      await useChallengeStore.getState().loadChallenges()
    })

    const state = useChallengeStore.getState()
    expect(state.error).toBe('Failed to load challenges')
    expect(state.isLoading).toBe(false)
  })
})

describe('refreshAllProgress', () => {
  it('should update challenge progress from calculated values', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(5)

    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'Test',
      type: 'completion',
      targetValue: 10,
      currentProgress: 0,
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    await act(async () => {
      await useChallengeStore.getState().refreshAllProgress()
    })

    const state = useChallengeStore.getState()
    expect(state.challenges[0].currentProgress).toBe(5)
  })

  it('should cap progress at targetValue', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(15) // exceeds target of 10

    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'Over target',
      type: 'completion',
      targetValue: 10,
      currentProgress: 0,
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    await act(async () => {
      await useChallengeStore.getState().refreshAllProgress()
    })

    const state = useChallengeStore.getState()
    expect(state.challenges[0].currentProgress).toBe(10) // capped at targetValue
  })

  it('should set completedAt when progress reaches target', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(10) // matches target

    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'Almost done',
      type: 'completion',
      targetValue: 10,
      currentProgress: 9,
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    await act(async () => {
      await useChallengeStore.getState().refreshAllProgress()
    })

    const state = useChallengeStore.getState()
    expect(state.challenges[0].completedAt).toBeTruthy()
  })

  it('should not overwrite existing completedAt', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(10)

    const originalCompletedAt = '2026-01-15T12:00:00.000Z'
    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'Already completed',
      type: 'completion',
      targetValue: 10,
      currentProgress: 10,
      completedAt: originalCompletedAt,
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    await act(async () => {
      await useChallengeStore.getState().refreshAllProgress()
    })

    const state = useChallengeStore.getState()
    expect(state.challenges[0].completedAt).toBe(originalCompletedAt)
  })

  it('should persist updated progress to IndexedDB', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(7)

    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'Persisted',
      type: 'completion',
      targetValue: 10,
      currentProgress: 0,
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    await act(async () => {
      await useChallengeStore.getState().refreshAllProgress()
    })

    const dbChallenge = await db.challenges.get(challenge.id)
    expect(dbChallenge?.currentProgress).toBe(7)
  })

  it('should show toast on DB write failure', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(3)

    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'Fail persist',
      type: 'completion',
      targetValue: 10,
      currentProgress: 0,
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    const swModuleBP = await import('@/lib/sync/syncableWrite')
    vi.spyOn(swModuleBP, 'syncableWrite').mockRejectedValue(new Error('DB write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      await useChallengeStore.getState().refreshAllProgress()
    })

    // State should not be updated since DB write failed
    const state = useChallengeStore.getState()
    expect(state.challenges[0].currentProgress).toBe(0)

    // toast.error should notify the user
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('Progress update may not have saved')
  })

  it('should return milestoneMap with detected milestones', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(3) // 3/4 = 75%

    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'Milestone test',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [],
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    let result: Map<string, number[]> = new Map()
    await act(async () => {
      result = await useChallengeStore.getState().refreshAllProgress()
    })

    expect(result.get(challenge.id)).toEqual([25, 50, 75])
  })

  it('should append new milestones to celebratedMilestones', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(2) // 2/4 = 50%

    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'Append test',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [25],
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    await act(async () => {
      await useChallengeStore.getState().refreshAllProgress()
    })

    const state = useChallengeStore.getState()
    expect(state.challenges[0].celebratedMilestones).toEqual([25, 50])

    const dbRecord = await db.challenges.get(challenge.id)
    expect(dbRecord?.celebratedMilestones).toEqual([25, 50])
  })

  it('should return empty milestoneMap when no new milestones crossed', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(0)

    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'No milestones',
      type: 'completion',
      targetValue: 10,
      currentProgress: 0,
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    let result: Map<string, number[]> = new Map()
    await act(async () => {
      result = await useChallengeStore.getState().refreshAllProgress()
    })

    expect(result.size).toBe(0)
  })

  it('should return empty milestoneMap on DB write failure', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockResolvedValue(3)

    const { db } = await import('@/db')
    const challenge = createChallenge({
      name: 'Fail milestone',
      type: 'completion',
      targetValue: 4,
      currentProgress: 0,
      celebratedMilestones: [],
    })
    await db.challenges.add(challenge)
    useChallengeStore.setState({ challenges: [challenge] })

    const swModuleBP = await import('@/lib/sync/syncableWrite')
    vi.spyOn(swModuleBP, 'syncableWrite').mockRejectedValue(new Error('DB write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    let result: Map<string, number[]> = new Map()
    await act(async () => {
      result = await useChallengeStore.getState().refreshAllProgress()
    })

    expect(result.size).toBe(0)
  })

  it('should be a no-op when challenges array is empty', async () => {
    const { calculateProgress } = await import('@/lib/challengeProgress')
    vi.mocked(calculateProgress).mockClear()

    await act(async () => {
      await useChallengeStore.getState().refreshAllProgress()
    })

    expect(calculateProgress).not.toHaveBeenCalled()
  })
})
