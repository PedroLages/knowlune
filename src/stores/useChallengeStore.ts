import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Challenge, ChallengeType } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { calculateProgress } from '@/lib/challengeProgress'
import { detectChallengeMilestones } from '@/lib/challengeMilestones'
import { toastWithUndo, toastError } from '@/lib/toastHelpers'
import { appEventBus } from '@/lib/eventBus'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

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

  /**
   * Replace Dexie + in-memory collection from a validated remote snapshot.
   *
   * E96-S02: called by `hydrateP3P4FromSupabase`. Pure setter — uses
   * `db.challenges.bulkPut` directly (never `syncableWrite`) so it does NOT
   * enqueue any syncQueue row. Echo-loop guard per E93 retrospective.
   *
   * AC5 disposition: `isAllDefaults` guard is vacuously satisfied —
   * `challenges` is a collection keyed by id, not a singleton. Monotonic
   * conflict resolution on `currentProgress` is applied by the upload engine
   * during push, not at hydrate time.
   */
  hydrateFromRemote: (rows: Challenge[]) => Promise<void>
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
          const justCompleted = currentProgress >= challenge.targetValue && !challenge.completedAt
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

      // E96-S02: enqueue each updated row individually through
      // syncableWrite. The `challenges` registry entry uses
      // `conflictStrategy: 'monotonic'` with `monotonicFields: ['currentProgress']`;
      // monotonicity is enforced by the upload engine, not the call site.
      for (const row of updated) {
        await syncableWrite('challenges', 'put', row as unknown as SyncableRecord)
      }
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
        await syncableWrite('challenges', 'add', challenge as unknown as SyncableRecord)
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
        await syncableWrite('challenges', 'delete', id)
      })

      toastWithUndo({
        message: `Challenge "${deletedChallenge.name}" deleted`,
        onUndo: async () => {
          await syncableWrite('challenges', 'add', deletedChallenge as unknown as SyncableRecord)
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

  hydrateFromRemote: async rows => {
    if (!rows || rows.length === 0) return
    // Direct Dexie write — NEVER through syncableWrite. The remote is already
    // authoritative in Supabase; enqueueing here would create an echo loop.
    //
    // F1 monotonic guard (E96-S02): for currentProgress, never regress a local
    // value that is ahead of the remote snapshot. This protects offline mutations
    // that are still queued in syncQueue — a plain bulkPut would overwrite them.
    for (const remoteRow of rows) {
      const local = await db.challenges.get(remoteRow.id)
      if (local !== undefined && local.currentProgress > remoteRow.currentProgress) {
        // Local is ahead — keep the local currentProgress, merge everything else.
        await db.challenges.put({ ...remoteRow, currentProgress: local.currentProgress })
      } else {
        await db.challenges.put(remoteRow)
      }
    }
    const challenges = await db.challenges.orderBy('createdAt').reverse().toArray()
    set({ challenges })
  },
}))
