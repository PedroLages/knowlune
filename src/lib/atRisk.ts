import type { StudySession } from '@/data/types'
import type { MomentumScore } from './momentum'

export interface AtRiskStatus {
  isAtRisk: boolean
  daysSinceLastSession: number
  momentumScore: number
}

/**
 * Calculates at-risk status for a course based on session activity and momentum.
 *
 * A course is considered "at risk" when:
 * - 14+ days have passed since the last study session, AND
 * - The momentum score is below 20
 *
 * @param sessions - Array of study sessions for the course
 * @param momentumScore - Pre-calculated momentum score for the course
 * @param now - Optional timestamp for deterministic testing (defaults to Date.now())
 * @returns AtRiskStatus with isAtRisk flag and diagnostic metrics
 */
export function calculateAtRiskStatus(
  sessions: StudySession[],
  momentumScore: MomentumScore,
  now = Date.now()
): AtRiskStatus {
  // Calculate days since last session
  let daysSinceLastSession = Infinity

  if (sessions.length > 0) {
    // Find most recent session
    const latestMs = sessions.reduce((max, s) => {
      const t = new Date(s.startTime).getTime()
      return t > max ? t : max
    }, 0)

    // Calculate days elapsed
    daysSinceLastSession = (now - latestMs) / (1000 * 60 * 60 * 24)
  }

  // At-risk criteria: 14+ days inactivity AND momentum < 20
  const isAtRisk = daysSinceLastSession >= 14 && momentumScore.score < 20

  return {
    isAtRisk,
    daysSinceLastSession: Math.floor(daysSinceLastSession),
    momentumScore: momentumScore.score,
  }
}
