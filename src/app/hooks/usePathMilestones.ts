import { useEffect, useRef } from 'react'
import { useChallengeStore } from '@/stores/useChallengeStore'
import { detectChallengeMilestones } from '@/lib/challengeMilestones'
import { fireMilestoneToasts } from '@/lib/fireMilestoneToasts'

interface UsePathMilestonesOptions {
  pathId: string
  pathName: string
  completionPct: number
}

/**
 * Watches path completion percentage and automatically creates/fires pathMilestone
 * challenges when thresholds (25%, 50%, 75%, 100%) are crossed.
 *
 * Handles jumps (R8): if completion jumps from 20% to 60%, both 25% and 50%
 * milestones fire in sequence.
 *
 * Idempotent: checks for existing challenge before creating, and tracks
 * celebrated milestones to avoid duplicate toasts.
 */
export function usePathMilestones({ pathId, pathName, completionPct }: UsePathMilestonesOptions) {
  const prevPctRef = useRef<number>(0)
  const initializedRef = useRef(false)

  useEffect(() => {
    // Skip if no path or no completion yet
    if (!pathId) return

    // On first run, seed previous percent and check for existing challenge
    if (!initializedRef.current) {
      prevPctRef.current = completionPct
      initializedRef.current = true

      // Check if a pathMilestone challenge already exists for this path
      const existingChallenge = useChallengeStore
        .getState()
        .challenges.find(c => c.type === 'pathMilestone' && c.pathId === pathId)

      if (!existingChallenge) {
        // Create the challenge (target is 100% completion)
        useChallengeStore
          .getState()
          .addChallenge({
            name: pathName,
            type: 'pathMilestone',
            targetValue: 100,
            deadline: new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000
            )
              .toISOString()
              .split('T')[0],
            pathId,
          })
          .catch(err => {
            console.error('[usePathMilestones] Failed to create challenge:', err)
          })
      }
      return
    }

    const prevPct = prevPctRef.current
    const currPct = completionPct

    // No change — nothing to do
    if (prevPct === currPct) return

    prevPctRef.current = currPct

    // Find the challenge for this path
    const challenge = useChallengeStore
      .getState()
      .challenges.find(c => c.type === 'pathMilestone' && c.pathId === pathId)

    if (!challenge) return

    // Progress went backward — nothing to fire (already celebrated milestones remain)
    if (currPct < prevPct) {
      // Update progress to reflect current (lower) state
      challenge.currentProgress = currPct
      return
    }

    // Progress increased — find ALL thresholds crossed between prev and curr
    // This handles jumps (R8): 20% -> 60% crosses 25% and 50%
    // detectChallengeMilestones returns thresholds at/below currPct not yet celebrated;
    // filter to keep only those above prevPct (crossed since last check)
    const allNewThresholds = detectChallengeMilestones(challenge, currPct)
    const crossedThresholds = allNewThresholds.filter(t => t > prevPct)

    if (crossedThresholds.length === 0) {
      // No new milestones, but update progress
      challenge.currentProgress = currPct
      return
    }

    // Update challenge progress
    challenge.currentProgress = currPct
    challenge.celebratedMilestones = [
      ...challenge.celebratedMilestones,
      ...crossedThresholds,
    ]

    // Persist updated challenge
    useChallengeStore.getState().updateChallenge(challenge.id, {
      currentProgress: currPct,
      celebratedMilestones: challenge.celebratedMilestones,
      completedAt: currPct >= 100 ? new Date().toISOString() : challenge.completedAt,
    })

    // Fire milestone toasts
    const milestoneMap = new Map<string, number[]>()
    milestoneMap.set(challenge.id, crossedThresholds)
    const timerIds = fireMilestoneToasts(
      milestoneMap,
      useChallengeStore.getState().challenges
    )

    return () => {
      timerIds.forEach(id => clearTimeout(id))
    }
  }, [pathId, pathName, completionPct])
}
