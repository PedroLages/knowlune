import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Challenge, ChallengeType } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { calculateProgress } from '@/lib/challengeProgress'
import { detectChallengeMilestones } from '@/lib/challengeMilestones'
import { toastWithUndo, toastError } from '@/lib/toastHelpers'
import { appEventBus } from '@/lib/eventBus'

interface NewChallengeData {
  name: string
  type: ChallengeType
  targetValue: number
  deadline: string // ISO 8601 date
}

interface ChallengeState {
  challenges: Challenge[]
  isLoading: boolean
  isRefreshing: boolean
  error: string | null

  loadChallenges: () => Promise<void>
  refreshAllProgress: () => Promise<Map<string, number[]>>
  addChallenge: (data: NewChallengeData) => Promise<void>
  deleteChallenge: (id: string) => Promise<void>
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenges: [],
  isLoading: false,
  isRefreshing: false,
  error: null,

  loadChallenges: async () => {
    set({ isLoading: true, error: null })
    try {
      const challenges = await db.challenges.orderBy('createdAt').reverse().toArray()
      set({ challenges, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load challenges' })
      console.error('[ChallengeStore] Failed to load challenges:', error)
    }
  },

  refreshAllProgress: async () => {
    const { challenges, isRefreshing } = get()
    const milestoneMap = new Map<string, number[]>()
    if (isRefreshing || challenges.length === 0) return milestoneMap

    set({ isRefreshing: true })
    try {
      const updated = await Promise.all(
        challenges.map(async challenge => {
          const raw = await calculateProgress(challenge)
          const currentProgress = Math.min(raw, challenge.targetValue)
          const justCompleted =
            currentProgress >= challenge.targetValue && !challenge.completedAt
          const completedAt = justCompleted ? new Date().toISOString() : challenge.completedAt

          // E43-S07: Emit achievement event for newly completed challenges
          if (justCompleted) {
            appEventBus.emit({
              type: 'achievement:unlocked',
              achievementId: challenge.id,
              achievementName: challenge.name,
            })
          }

          const newMilestones = detectChallengeMilestones(challenge, currentProgress)
          if (newMilestones.length > 0) {
            milestoneMap.set(challenge.id, newMilestones)
          }

          return {
            ...challenge,
            currentProgress,
            completedAt,
            celebratedMilestones: [...(challenge.celebratedMilestones ?? []), ...newMilestones],
          }
        })
      )

      await db.challenges.bulkPut(updated)
      set({ challenges: updated })
    } catch (error) {
      console.error('[ChallengeStore] Failed to refresh progress:', error)
      toast.error('Progress update may not have saved')
      milestoneMap.clear()
    } finally {
      set({ isRefreshing: false })
    }

    return milestoneMap
  },

  addChallenge: async (data: NewChallengeData) => {
    const challenge: Challenge = {
      id: crypto.randomUUID(),
      name: data.name,
      type: data.type,
      targetValue: data.targetValue,
      deadline: data.deadline,
      createdAt: new Date().toISOString(),
      currentProgress: 0,
      celebratedMilestones: [],
    }

    const { challenges } = get()

    // Optimistic update
    set({
      challenges: [challenge, ...challenges],
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.challenges.add(challenge)
      })
    } catch (error) {
      // Rollback on failure
      set({
        challenges,
        error: 'Failed to create challenge',
      })
      console.error('[ChallengeStore] Failed to persist challenge:', error)
      throw error
    }
  },

  deleteChallenge: async (id: string) => {
    const { challenges } = get()
    const deletedChallenge = challenges.find(c => c.id === id)
    if (!deletedChallenge) return

    // Optimistic update
    set({
      challenges: challenges.filter(c => c.id !== id),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.challenges.delete(id)
      })

      toastWithUndo({
        message: `Challenge "${deletedChallenge.name}" deleted`,
        onUndo: async () => {
          await db.challenges.add(deletedChallenge)
          set({ challenges: [...get().challenges, deletedChallenge] })
          toast.success('Challenge restored')
        },
        duration: 5000,
      })
    } catch (error) {
      // Rollback to full snapshot preserving original order
      set({
        challenges,
        error: 'Failed to delete challenge',
      })
      toastError.deleteFailed('challenge')
      throw error
    }
  },
}))
