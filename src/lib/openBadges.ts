/**
 * Open Badges v3.0 credential generator for LevelUp achievements.
 *
 * Synthesizes badges from:
 * - Completed challenges (Dexie challenges table)
 * - Streak milestones (localStorage streak-milestones)
 *
 * Reference: https://www.imsglobal.org/spec/ob/v3p0/
 */
import type { Challenge, StreakMilestone } from '@/data/types'
import { db } from '@/db/schema'
import { getSettings } from './settings'
import type { ExportProgressCallback } from './exportService'

// --- Open Badges v3.0 Types ---

export interface OpenBadgeCredential {
  '@context': string[]
  type: string[]
  issuer: {
    type: 'Profile'
    name: string
  }
  issuanceDate: string
  credentialSubject: {
    type: 'AchievementSubject'
    achievement: {
      type: 'Achievement'
      name: string
      description: string
      criteria: {
        narrative: string
      }
    }
  }
  evidence?: Array<{
    type: 'Evidence'
    narrative: string
  }>
}

// --- Badge Context URIs ---

const OB_CONTEXT = [
  'https://www.w3.org/ns/credentials/v2',
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
]

const OB_TYPE = ['VerifiableCredential', 'OpenBadgeCredential']

// --- Challenge Type Labels ---

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  completion: 'videos completed',
  time: 'study hours',
  streak: 'streak days',
}

// --- Badge Generators ---

function challengeToBadge(challenge: Challenge, issuerName: string): OpenBadgeCredential | null {
  if (!challenge.completedAt) return null

  const typeLabel = CHALLENGE_TYPE_LABELS[challenge.type] || challenge.type

  return {
    '@context': OB_CONTEXT,
    type: OB_TYPE,
    issuer: {
      type: 'Profile',
      name: issuerName,
    },
    issuanceDate: challenge.completedAt,
    credentialSubject: {
      type: 'AchievementSubject',
      achievement: {
        type: 'Achievement',
        name: `Completed: ${challenge.name}`,
        description: `Successfully completed the "${challenge.name}" ${challenge.type} challenge, achieving ${challenge.targetValue} ${typeLabel}.`,
        criteria: {
          narrative: `Achieve ${challenge.targetValue} ${typeLabel} by ${challenge.deadline}.`,
        },
      },
    },
    evidence: [
      {
        type: 'Evidence',
        narrative: `Challenge started on ${challenge.createdAt.split('T')[0]}, completed on ${challenge.completedAt.split('T')[0]}. Target: ${challenge.targetValue} ${typeLabel}. Final progress: ${challenge.currentProgress}/${challenge.targetValue}.`,
      },
    ],
  }
}

function streakMilestoneToBadge(
  milestone: StreakMilestone,
  issuerName: string
): OpenBadgeCredential {
  return {
    '@context': OB_CONTEXT,
    type: OB_TYPE,
    issuer: {
      type: 'Profile',
      name: issuerName,
    },
    issuanceDate: milestone.earnedAt,
    credentialSubject: {
      type: 'AchievementSubject',
      achievement: {
        type: 'Achievement',
        name: `${milestone.milestoneValue}-Day Study Streak`,
        description: `Achieved a ${milestone.milestoneValue}-day consecutive study streak, demonstrating consistent learning commitment.`,
        criteria: {
          narrative: `Study for ${milestone.milestoneValue} consecutive days.`,
        },
      },
    },
    evidence: [
      {
        type: 'Evidence',
        narrative: `Streak started on ${milestone.streakStartDate}, milestone earned on ${milestone.earnedAt.split('T')[0]}.`,
      },
    ],
  }
}

// --- Bulk Export ---

export async function exportAchievementsAsBadges(
  onProgress?: ExportProgressCallback
): Promise<OpenBadgeCredential[]> {
  const settings = getSettings()
  const issuerName = `LevelUp — ${settings.displayName}`
  const badges: OpenBadgeCredential[] = []

  // Completed challenges from IndexedDB
  onProgress?.(0, 'Loading challenges...')
  const challenges = await db.challenges.toArray()
  for (const challenge of challenges) {
    const badge = challengeToBadge(challenge, issuerName)
    if (badge) badges.push(badge)
  }

  // Streak milestones from localStorage
  onProgress?.(50, 'Loading streak milestones...')
  try {
    const raw = localStorage.getItem('streak-milestones')
    if (raw) {
      const milestones: StreakMilestone[] = JSON.parse(raw)
      for (const milestone of milestones) {
        badges.push(streakMilestoneToBadge(milestone, issuerName))
      }
    }
  } catch (error) {
    console.error('[OpenBadges] Failed to parse streak milestones:', error)
  }

  // Sort by issuance date
  badges.sort((a, b) => a.issuanceDate.localeCompare(b.issuanceDate))

  onProgress?.(100, 'Complete')
  return badges
}
