import type { StudySession } from '@/data/types'

export interface MomentumInput {
  courseId: string
  totalLessons: number
  completionPercent: number // caller provides — keeps this function pure
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

/** Guard: skip corrupted sessions that would produce NaN in date/math ops */
function isValidSession(s: StudySession): boolean {
  if (!s || typeof s !== 'object') return false
  if (typeof s.courseId !== 'string' || !s.courseId) return false
  if (!s.startTime || isNaN(new Date(s.startTime).getTime())) return false
  if (typeof s.duration !== 'number' || !isFinite(s.duration) || s.duration < 0) return false
  return true
}

export function calculateMomentumScore(input: MomentumInput): MomentumScore {
  const { completionPercent, sessions = [] } = input
  const now = Date.now()

  // Filter out corrupted sessions before any date parsing
  const validSessions = (sessions ?? []).filter(isValidSession)
  if (validSessions.length < sessions.length) {
    console.warn(
      `[Momentum] Skipped ${sessions.length - validSessions.length} corrupted session(s) for course ${input.courseId}`
    )
  }

  // Recency score: 0 days = 100, 14+ days = 0
  let recencyScore = 0
  if (validSessions.length > 0) {
    const latestMs = validSessions.reduce((max, s) => {
      const t = new Date(s.startTime).getTime()
      return t > max ? t : max
    }, 0)
    const daysSinceLast = (now - latestMs) / (1000 * 60 * 60 * 24)
    recencyScore = Math.max(0, 100 - daysSinceLast * (100 / 14))
  }

  // Completion score: passed in by caller (pure)
  const completionScore = completionPercent

  // Frequency score: sessions in last 30 days (10/month = max)
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const sessionsInLast30Days = validSessions.filter(
    s => new Date(s.startTime).getTime() >= thirtyDaysAgo
  ).length
  const frequencyScore = Math.min(100, sessionsInLast30Days * 10)

  const score = Math.round(
    Math.min(100, Math.max(0, recencyScore * 0.4 + completionScore * 0.3 + frequencyScore * 0.3))
  )

  return { score, tier: getMomentumTier(score) }
}
