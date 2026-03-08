import type { StudySession } from '@/data/types'

export interface CompletionEstimate {
  sessionsNeeded: number
  estimatedDays: number
  averageSessionMinutes: number
  remainingMinutes: number
}

/**
 * Calculates estimated completion time based on user's study pace and remaining content.
 *
 * Uses the last 30 days of sessions to determine average session duration.
 * Falls back to a default 30 minutes per session for new users with no history.
 *
 * @param sessions - Array of study sessions for the course
 * @param remainingContentMinutes - Minutes of uncompleted content
 * @param now - Optional timestamp for deterministic testing (defaults to Date.now())
 * @returns CompletionEstimate with sessions needed, estimated days, and diagnostic metrics
 */
export function calculateCompletionEstimate(
  sessions: StudySession[],
  remainingContentMinutes: number,
  now = Date.now()
): CompletionEstimate {
  const DEFAULT_SESSION_MINUTES = 30 // AC4: Default pace for new users
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  // Clamp negative remainingContentMinutes to 0
  const clampedRemainingMinutes = Math.max(0, remainingContentMinutes)

  // Filter sessions to last 30 days
  const recentSessions = sessions.filter(s => new Date(s.startTime).getTime() >= thirtyDaysAgo)

  // Calculate average session duration
  let averageSessionMinutes: number

  if (recentSessions.length === 0) {
    // No sessions: use default pace
    averageSessionMinutes = DEFAULT_SESSION_MINUTES
  } else {
    // Calculate average from recent sessions
    const totalMinutes = recentSessions.reduce((sum, s) => sum + s.duration / 60, 0)
    averageSessionMinutes = totalMinutes / recentSessions.length

    // Guard against division by zero when all sessions have duration: 0
    if (averageSessionMinutes <= 0) {
      averageSessionMinutes = DEFAULT_SESSION_MINUTES
    }
  }

  // Calculate sessions needed
  const sessionsNeeded = Math.ceil(clampedRemainingMinutes / averageSessionMinutes)

  // Estimate days (assuming 1 session per day)
  const estimatedDays = sessionsNeeded

  return {
    sessionsNeeded,
    estimatedDays,
    averageSessionMinutes: Math.round(averageSessionMinutes),
    remainingMinutes: clampedRemainingMinutes,
  }
}
