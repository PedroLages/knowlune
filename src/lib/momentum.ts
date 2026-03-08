import { getCourseCompletionPercent } from '@/lib/progress'
import type { StudySession } from '@/data/types'

export interface MomentumInput {
  courseId: string
  totalLessons: number
  sessions: StudySession[] // pre-loaded — avoids per-card DB calls
}

export type MomentumTier = 'hot' | 'warm' | 'cold'

export interface MomentumScore {
  score: number // 0–100
  tier: MomentumTier
}

export function getMomentumTier(score: number): MomentumTier {
  if (score >= 70) return 'hot'
  if (score >= 30) return 'warm'
  return 'cold'
}

export function calculateMomentumScore(input: MomentumInput): MomentumScore {
  const { courseId, totalLessons, sessions } = input
  const now = Date.now()

  // Recency score: 0 days = 100, 14+ days = 0
  let recencyScore = 0
  if (sessions.length > 0) {
    const latestMs = Math.max(...sessions.map(s => new Date(s.startTime).getTime()))
    const daysSinceLast = (now - latestMs) / (1000 * 60 * 60 * 24)
    recencyScore = Math.max(0, 100 - daysSinceLast * (100 / 14))
  }

  // Completion score: directly from localStorage progress
  const completionScore = getCourseCompletionPercent(courseId, totalLessons)

  // Frequency score: sessions in last 30 days (10/month = max)
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const sessionsInLast30Days = sessions.filter(
    s => new Date(s.startTime).getTime() >= thirtyDaysAgo
  ).length
  const frequencyScore = Math.min(100, sessionsInLast30Days * 10)

  const score = Math.round(
    Math.min(100, Math.max(0, recencyScore * 0.4 + completionScore * 0.3 + frequencyScore * 0.3))
  )

  return { score, tier: getMomentumTier(score) }
}
