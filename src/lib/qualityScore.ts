import type { StudySession, QualityFactors, QualityTier, QualityTrend } from '@/data/types'

export interface QualityScoreResult {
  score: number // 0-100
  factors: QualityFactors
  tier: QualityTier
}

const WEIGHTS = {
  activeTime: 0.4,
  interactionDensity: 0.3,
  sessionLength: 0.15,
  breaks: 0.15,
} as const

/**
 * Calculate the active time ratio score.
 * Higher ratio of active time to total time = higher score.
 */
export function calcActiveTimeScore(duration: number, idleTime: number): number {
  const totalTime = duration + idleTime
  if (totalTime <= 0) return 0
  return Math.round(Math.min(100, Math.max(0, (duration / totalTime) * 100)))
}

/**
 * Calculate interaction density score.
 * ~5 meaningful interactions per active minute = 100.
 */
export function calcInteractionDensityScore(
  interactionCount: number,
  durationSeconds: number
): number {
  if (durationSeconds <= 0 || interactionCount <= 0) return 0
  const activeMinutes = durationSeconds / 60
  const density = interactionCount / activeMinutes
  // 5 interactions/min → 100, scales linearly
  return Math.round(Math.min(100, Math.max(0, (density / 5) * 100)))
}

/**
 * Calculate session length score using a bell curve.
 * Peak at 30-60 minutes. Very short (<5min) or very long (>120min) sessions score lower.
 */
export function calcSessionLengthScore(durationSeconds: number): number {
  const minutes = durationSeconds / 60
  if (minutes <= 0) return 0

  // Bell curve: peak at 45min, std dev ~30min
  // Short sessions (<5min) get very low scores
  // 30-60min is the sweet spot (score ~90-100)
  // >90min starts declining gently
  if (minutes < 5) return Math.round((minutes / 5) * 30) // 0-30 for <5min
  if (minutes <= 30) return Math.round(30 + ((minutes - 5) / 25) * 70) // 30-100 for 5-30min
  if (minutes <= 60) return 100 // Sweet spot
  if (minutes <= 120) return Math.round(100 - ((minutes - 60) / 60) * 30) // 100-70 for 60-120min
  return Math.round(Math.max(40, 70 - ((minutes - 120) / 60) * 15)) // Gradual decline, floor at 40
}

/**
 * Calculate breaks score.
 * 1-2 breaks for 30+ min sessions = optimal.
 * 0 breaks for long sessions or many breaks = lower score.
 */
export function calcBreaksScore(breakCount: number, durationSeconds: number): number {
  const minutes = durationSeconds / 60
  if (minutes <= 0) return 0

  // Short sessions (<15min): no breaks expected → full score
  if (minutes < 15) return breakCount === 0 ? 100 : Math.max(50, 100 - breakCount * 20)

  // Medium sessions (15-45min): 0-1 break optimal
  if (minutes <= 45) {
    if (breakCount === 0) return 90 // Slight penalty for no breaks in longer sessions
    if (breakCount === 1) return 100
    if (breakCount === 2) return 85
    return Math.max(40, 85 - (breakCount - 2) * 15)
  }

  // Long sessions (45min+): 1-2 breaks optimal
  if (breakCount === 0) return 70 // Should take breaks in long sessions
  if (breakCount === 1) return 95
  if (breakCount === 2) return 100
  if (breakCount === 3) return 85
  return Math.max(30, 85 - (breakCount - 3) * 15)
}

/**
 * Calculate the composite quality score for a study session.
 * Pure function — no DB calls, no side effects.
 */
export function calculateQualityScore(session: StudySession): QualityScoreResult {
  const activeTimeScore = calcActiveTimeScore(session.duration, session.idleTime)
  const interactionDensityScore = calcInteractionDensityScore(
    session.interactionCount ?? 0,
    session.duration
  )
  const sessionLengthScore = calcSessionLengthScore(session.duration)
  const breaksScore = calcBreaksScore(session.breakCount ?? 0, session.duration)

  const factors: QualityFactors = {
    activeTimeScore,
    interactionDensityScore,
    sessionLengthScore,
    breaksScore,
  }

  const score = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        activeTimeScore * WEIGHTS.activeTime +
          interactionDensityScore * WEIGHTS.interactionDensity +
          sessionLengthScore * WEIGHTS.sessionLength +
          breaksScore * WEIGHTS.breaks
      )
    )
  )

  return { score, factors, tier: getQualityTier(score) }
}

export function getQualityTier(score: number): QualityTier {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'needs-improvement'
}

export const QUALITY_TIER_LABELS: Record<QualityTier, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  'needs-improvement': 'Needs Improvement',
}

/**
 * Calculate quality trend from recent scores.
 * Compares average of latest 5 sessions vs previous 5.
 */
export function calculateQualityTrend(scores: number[]): QualityTrend {
  if (scores.length < 4) return 'stable' // Not enough data

  const recent = scores.slice(0, Math.min(5, Math.floor(scores.length / 2)))
  const previous = scores.slice(recent.length, recent.length * 2)

  if (previous.length === 0) return 'stable'

  const recentAvg = recent.reduce((sum, s) => sum + s, 0) / recent.length
  const previousAvg = previous.reduce((sum, s) => sum + s, 0) / previous.length
  const diff = recentAvg - previousAvg

  if (diff > 5) return 'improving'
  if (diff < -5) return 'declining'
  return 'stable'
}
