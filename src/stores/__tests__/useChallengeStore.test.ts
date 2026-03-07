import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createChallenge } from '../../../tests/support/fixtures/factories/challenge-factory'

// Mock persistWithRetry to run operation once (no retries).
// Retry logic is tested in persistWithRetry's own tests.
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
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
    const { db } = await import('@/db')
    vi.spyOn(db.challenges, 'add').mockRejectedValue(new Error('DB write failed'))
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

    const { db } = await import('@/db')
    const id = useChallengeStore.getState().challenges[0].id
    vi.spyOn(db.challenges, 'delete').mockRejectedValue(new Error('DB delete failed'))
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
