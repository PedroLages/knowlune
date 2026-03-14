import { db } from '@/db'
import { isFeatureEnabled } from '@/lib/aiConfiguration'
import type { AIFeatureType, AIUsageEvent } from '@/data/types'

/** All trackable AI features (order matches dashboard display) */
/** AI features shown on the dashboard (excludes auto_analysis which is backend-only) */
export const AI_FEATURES: readonly AIFeatureType[] = [
  'summary',
  'qa',
  'learning_path',
  'note_organization',
  'knowledge_gaps',
] as const

/** Human-readable labels for AI feature types */
export const AI_FEATURE_LABELS: Record<AIFeatureType, string> = {
  summary: 'Summaries Generated',
  qa: 'Q&A Questions Asked',
  learning_path: 'Learning Paths Created',
  note_organization: 'Notes Organized',
  knowledge_gaps: 'Gaps Detected',
  auto_analysis: 'Auto-Analyses Run',
}

export type TrendDirection = 'up' | 'down' | 'stable'

export type TimePeriod = 'daily' | 'weekly' | 'monthly'

export interface FeatureStats {
  featureType: AIFeatureType
  count: number
  trend: TrendDirection
  previousCount: number
}

export interface AIUsageStats {
  period: TimePeriod
  features: FeatureStats[]
  totalEvents: number
}

/**
 * Records an AI feature usage event to IndexedDB.
 *
 * No-op if the user has disabled the analytics consent toggle.
 * Errors are logged but never thrown — tracking must not disrupt AI features.
 */
export async function trackAIUsage(
  featureType: AIFeatureType,
  options: {
    courseId?: string
    durationMs?: number
    status?: 'success' | 'error'
    metadata?: Record<string, unknown>
  } = {}
): Promise<void> {
  try {
    if (!isFeatureEnabled('analytics')) return

    const event: AIUsageEvent = {
      id: crypto.randomUUID(),
      featureType,
      courseId: options.courseId,
      timestamp: new Date().toISOString(),
      durationMs: options.durationMs,
      status: options.status ?? 'success',
      metadata: options.metadata,
    }

    await db.aiUsageEvents.add(event)
  } catch (error) {
    // Tracking must never block AI features
    console.warn('[AI Tracking] Failed to record event:', error)
  }
}

/**
 * Returns the start of the current and previous period as ISO strings.
 */
function getPeriodBounds(
  period: TimePeriod,
  referenceDate?: Date
): {
  currentStart: string
  previousStart: string
  previousEnd: string
} {
  const now = referenceDate ?? new Date()
  let currentStart: Date
  let previousStart: Date
  let previousEnd: Date

  switch (period) {
    case 'daily': {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      previousEnd = new Date(currentStart)
      previousStart = new Date(currentStart)
      previousStart.setDate(previousStart.getDate() - 1)
      break
    }
    case 'weekly': {
      const dayOfWeek = now.getDay()
      // Week starts on Monday (ISO standard)
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
      previousEnd = new Date(currentStart)
      previousStart = new Date(currentStart)
      previousStart.setDate(previousStart.getDate() - 7)
      break
    }
    case 'monthly': {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1)
      previousEnd = new Date(currentStart)
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      break
    }
  }

  return {
    currentStart: currentStart.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  }
}

/**
 * Calculates trend direction by comparing current vs previous period counts.
 */
function calculateTrend(current: number, previous: number): TrendDirection {
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'stable'
}

/**
 * Aggregates AI usage statistics for the selected time period.
 *
 * Queries IndexedDB for events in the current and previous periods,
 * groups by feature type, and calculates trend indicators.
 */
export async function getAIUsageStats(period: TimePeriod): Promise<AIUsageStats> {
  const { currentStart, previousStart, previousEnd } = getPeriodBounds(period)

  // Fetch events for current and previous periods in parallel
  const [currentEvents, previousEvents] = await Promise.all([
    db.aiUsageEvents.where('timestamp').aboveOrEqual(currentStart).toArray(),
    db.aiUsageEvents.where('timestamp').between(previousStart, previousEnd, true, false).toArray(),
  ])

  // Count events per feature for each period
  const currentCounts = new Map<AIFeatureType, number>()
  const previousCounts = new Map<AIFeatureType, number>()

  for (const event of currentEvents) {
    currentCounts.set(event.featureType, (currentCounts.get(event.featureType) ?? 0) + 1)
  }
  for (const event of previousEvents) {
    previousCounts.set(event.featureType, (previousCounts.get(event.featureType) ?? 0) + 1)
  }

  const features: FeatureStats[] = AI_FEATURES.map(featureType => {
    const count = currentCounts.get(featureType) ?? 0
    const previousCount = previousCounts.get(featureType) ?? 0
    return {
      featureType,
      count,
      trend: calculateTrend(count, previousCount),
      previousCount,
    }
  })

  return {
    period,
    features,
    totalEvents: currentEvents.length,
  }
}

/**
 * Returns raw AI usage events for a given time period, for chart rendering.
 * Events are sorted by timestamp ascending.
 */
export async function getAIUsageTimeline(period: TimePeriod): Promise<AIUsageEvent[]> {
  const { currentStart } = getPeriodBounds(period)

  return db.aiUsageEvents.where('timestamp').aboveOrEqual(currentStart).sortBy('timestamp')
}
