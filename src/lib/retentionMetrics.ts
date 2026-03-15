/**
 * Retention metrics and engagement decay detection.
 *
 * Pure functions — no side effects, all accept `now: Date` for deterministic testing.
 * Used by the Knowledge Retention Dashboard (E11-S02).
 */
import type { Note, ReviewRecord, StudySession } from '@/data/types'
import { predictRetention, isDue } from '@/lib/spacedRepetition'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type RetentionLevel = 'strong' | 'fading' | 'weak'

export interface TopicRetention {
  topic: string
  retention: number // Average retention % (0–100)
  level: RetentionLevel
  lastReviewedAt: string // ISO 8601 of most recent review in topic
  noteCount: number
  dueCount: number
}

export type DecayType = 'frequency' | 'duration' | 'velocity'

export interface EngagementDecayAlert {
  type: DecayType
  message: string
  suggestion?: string
}

export interface RetentionStats {
  notesAtRisk: number // Notes with retention < 50%
  dueToday: number // Notes currently due for review
  avgRetention: number // Mean retention across all reviewed notes
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000

/** Retention thresholds for level classification */
const STRONG_THRESHOLD = 80
const FADING_THRESHOLD = 50

// ─────────────────────────────────────────────────────────
// Topic Retention
// ─────────────────────────────────────────────────────────

/** Classify retention percentage into a level */
export function getRetentionLevel(retention: number): RetentionLevel {
  if (retention >= STRONG_THRESHOLD) return 'strong'
  if (retention >= FADING_THRESHOLD) return 'fading'
  return 'weak'
}

/**
 * Group notes by their primary tag and calculate per-topic retention.
 *
 * Notes without review records are excluded from retention calculation
 * (they haven't entered the spaced repetition system yet).
 */
export function getTopicRetention(
  notes: Note[],
  reviews: ReviewRecord[],
  now: Date
): TopicRetention[] {
  // Build noteId → ReviewRecord lookup
  const reviewByNoteId = new Map<string, ReviewRecord>()
  for (const review of reviews) {
    reviewByNoteId.set(review.noteId, review)
  }

  // Group notes by primary tag
  const topicMap = new Map<string, { notes: Note[]; reviews: ReviewRecord[] }>()

  for (const note of notes) {
    if (note.deleted) continue
    const topic = note.tags[0] ?? 'General'
    const entry = topicMap.get(topic) ?? { notes: [], reviews: [] }
    entry.notes.push(note)
    const review = reviewByNoteId.get(note.id)
    if (review) entry.reviews.push(review)
    topicMap.set(topic, entry)
  }

  // Calculate per-topic metrics
  const results: TopicRetention[] = []
  for (const [topic, data] of topicMap) {
    if (data.reviews.length === 0) continue // Skip topics with no reviews

    const retentions = data.reviews.map(r => predictRetention(r, now))
    const avgRetention = Math.round(retentions.reduce((sum, r) => sum + r, 0) / retentions.length)

    const lastReviewedAt = data.reviews.reduce((latest, r) => {
      return r.reviewedAt > latest ? r.reviewedAt : latest
    }, data.reviews[0].reviewedAt)

    results.push({
      topic,
      retention: avgRetention,
      level: getRetentionLevel(avgRetention),
      lastReviewedAt,
      noteCount: data.notes.length,
      dueCount: data.reviews.filter(r => isDue(r, now)).length,
    })
  }

  // Sort: weakest topics first (most urgent)
  return results.sort((a, b) => a.retention - b.retention)
}

// ─────────────────────────────────────────────────────────
// Retention Stats
// ─────────────────────────────────────────────────────────

/** Calculate summary statistics across all review records */
export function getRetentionStats(reviews: ReviewRecord[], now: Date): RetentionStats {
  if (reviews.length === 0) {
    return { notesAtRisk: 0, dueToday: 0, avgRetention: 0 }
  }

  let totalRetention = 0
  let notesAtRisk = 0
  let dueToday = 0

  for (const review of reviews) {
    const retention = predictRetention(review, now)
    totalRetention += retention
    if (retention < FADING_THRESHOLD) notesAtRisk++
    if (isDue(review, now)) dueToday++
  }

  return {
    notesAtRisk,
    dueToday,
    avgRetention: Math.round(totalRetention / reviews.length),
  }
}

// ─────────────────────────────────────────────────────────
// Engagement Decay Detection
// ─────────────────────────────────────────────────────────

/** Count completed sessions per week, going back `weeks` from `now` */
function getWeeklySessionCounts(sessions: StudySession[], weeks: number, now: Date): number[] {
  const counts: number[] = []
  for (let w = 0; w < weeks; w++) {
    const weekEnd = new Date(now.getTime() - w * 7 * MS_PER_DAY)
    const weekStart = new Date(weekEnd.getTime() - 7 * MS_PER_DAY)
    const count = sessions.filter(s => {
      const t = new Date(s.startTime).getTime()
      return t >= weekStart.getTime() && t < weekEnd.getTime()
    }).length
    counts.unshift(count) // oldest first
  }
  return counts
}

/** Average session duration per week, going back `weeks` from `now` */
function getWeeklyAvgDurations(sessions: StudySession[], weeks: number, now: Date): number[] {
  const durations: number[] = []
  for (let w = 0; w < weeks; w++) {
    const weekEnd = new Date(now.getTime() - w * 7 * MS_PER_DAY)
    const weekStart = new Date(weekEnd.getTime() - 7 * MS_PER_DAY)
    const weekSessions = sessions.filter(s => {
      const t = new Date(s.startTime).getTime()
      return t >= weekStart.getTime() && t < weekEnd.getTime()
    })
    const avg =
      weekSessions.length > 0
        ? weekSessions.reduce((sum, s) => sum + s.duration, 0) / weekSessions.length
        : 0
    durations.unshift(avg) // oldest first
  }
  return durations
}

/**
 * Detect engagement decay conditions.
 *
 * - Frequency: current 2-week count < 50% of previous 2-week count
 * - Duration: latest week avg < 70% of 4-week overall avg
 * - Velocity: 0 completed sessions for 3+ consecutive recent weeks
 */
export function detectEngagementDecay(sessions: StudySession[], now: Date): EngagementDecayAlert[] {
  const alerts: EngagementDecayAlert[] = []

  // Need at least 4 weeks of data for meaningful analysis
  const completedSessions = sessions.filter(s => s.endTime)
  if (completedSessions.length === 0) return alerts

  // --- Frequency decay (AC3) ---
  const weeklyCounts = getWeeklySessionCounts(completedSessions, 4, now)
  // Previous 2 weeks = weeks[0] + weeks[1], current 2 weeks = weeks[2] + weeks[3]
  const previousTwoWeeks = weeklyCounts[0] + weeklyCounts[1]
  const currentTwoWeeks = weeklyCounts[2] + weeklyCounts[3]

  if (previousTwoWeeks > 0 && currentTwoWeeks < previousTwoWeeks * 0.5) {
    alerts.push({
      type: 'frequency',
      message: 'Your study frequency has dropped significantly over the past 2 weeks.',
      suggestion: 'Try scheduling short daily study sessions to rebuild momentum.',
    })
  }

  // --- Duration decay (AC4) ---
  const weeklyDurations = getWeeklyAvgDurations(completedSessions, 4, now)
  const nonZeroWeeks = weeklyDurations.filter(d => d > 0)
  const fourWeekAvg =
    nonZeroWeeks.length > 0 ? nonZeroWeeks.reduce((sum, d) => sum + d, 0) / nonZeroWeeks.length : 0
  const latestWeekDuration = weeklyDurations[weeklyDurations.length - 1]

  if (fourWeekAvg > 0 && latestWeekDuration < fourWeekAvg * 0.7) {
    alerts.push({
      type: 'duration',
      message: 'Your average session duration has declined more than 30% over 4 weeks.',
      suggestion: 'Consider longer focused sessions or reducing distractions.',
    })
  }

  // --- Velocity stall (AC5) ---
  // Check if 3+ consecutive recent weeks have zero or declining sessions
  const recentWeeks = weeklyCounts.slice(-3)
  const allStalled = recentWeeks.every(count => count === 0)

  if (allStalled && completedSessions.length > 0) {
    alerts.push({
      type: 'velocity',
      message: 'Your learning progress has stalled for 3 or more consecutive weeks.',
      suggestion: 'Consider revisiting incomplete material to rebuild progress.',
    })
  }

  return alerts
}

// ─────────────────────────────────────────────────────────
// Time Display Helper
// ─────────────────────────────────────────────────────────

/** Format elapsed days since a date into a human-readable string */
export function formatTimeSinceReview(reviewedAt: string, now: Date): string {
  const elapsedMs = now.getTime() - new Date(reviewedAt).getTime()
  const days = Math.floor(elapsedMs / MS_PER_DAY)

  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 60) return '1 month ago'
  return `${Math.floor(days / 30)} months ago`
}
