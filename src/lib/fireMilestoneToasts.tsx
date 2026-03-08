// @ts-nocheck — Dependencies (ChallengeMilestoneToast, challengeMilestones) not yet created
import { toast } from 'sonner'
import { ChallengeMilestoneToast } from '@/app/components/celebrations/ChallengeMilestoneToast'
import { getChallengeTierConfig } from '@/lib/challengeMilestones'
import type { Challenge } from '@/data/types'

/**
 * Fire staggered milestone toast notifications.
 * Returns an array of timer IDs for cleanup via `clearTimeout`.
 */
export function fireMilestoneToasts(
  milestoneMap: Map<string, number[]>,
  challenges: Challenge[]
): number[] {
  const entries: Array<{ challengeName: string; milestone: number }> = []

  for (const [challengeId, milestones] of milestoneMap) {
    const challenge = challenges.find(c => c.id === challengeId)
    if (!challenge) continue
    for (const milestone of milestones) {
      entries.push({ challengeName: challenge.name, milestone })
    }
  }

  return entries.map((entry, index) =>
    window.setTimeout(() => {
      const tierConfig = getChallengeTierConfig(entry.milestone)
      toast.custom(
        () => (
          <ChallengeMilestoneToast
            challengeName={entry.challengeName}
            milestone={entry.milestone}
            tierConfig={tierConfig}
          />
        ),
        { duration: 8000, closeButton: true }
      )
    }, index * 500)
  )
}
