/**
 * Unit Tests: aiEventTracking.ts
 *
 * Tests AI usage event tracking, aggregation, and timeline queries.
 * Covers: trackAIUsage, getAIUsageStats, getAIUsageTimeline, constants.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FIXED_DATE, FIXED_TIMESTAMP } from '../../../tests/utils/test-time'
import type { AIUsageEvent } from '@/data/types'

// --- Mocks ---

const mockIsFeatureEnabled = vi.fn()
vi.mock('@/lib/aiConfiguration', () => ({
  isFeatureEnabled: (...args: unknown[]) => mockIsFeatureEnabled(...args),
}))

const mockAdd = vi.fn()
const mockWhereBetween = vi.fn()
const mockToArray = vi.fn()
const mockSortBy = vi.fn()

vi.mock('@/db', () => ({
  db: {
    aiUsageEvents: {
      add: (...args: unknown[]) => mockAdd(...args),
      where: (field: string) => ({
        aboveOrEqual: (val: string) => ({
          toArray: () => mockToArray(field, 'aboveOrEqual', val),
          sortBy: (key: string) => mockSortBy(field, val, key),
        }),
        between: (start: string, end: string, startInclusive: boolean, endInclusive: boolean) => ({
          toArray: () => mockWhereBetween(start, end, startInclusive, endInclusive),
        }),
      }),
    },
  },
}))

// --- Import SUT after mocks ---
import {
  trackAIUsage,
  getAIUsageStats,
  getAIUsageTimeline,
  AI_FEATURES,
  AI_FEATURE_LABELS,
  type TimePeriod,
} from '../aiEventTracking'

describe('aiEventTracking.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TIMESTAMP)

    // Default: randomUUID returns a stable value
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-1234',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('constants', () => {
    it('exports AI_FEATURES without auto_analysis (dashboard-only)', () => {
      expect(AI_FEATURES).toEqual([
        'summary',
        'qa',
        'learning_path',
        'note_organization',
        'knowledge_gaps',
      ])
      expect(AI_FEATURES).not.toContain('auto_analysis')
    })

    it('exports AI_FEATURE_LABELS for all feature types including auto_analysis', () => {
      expect(AI_FEATURE_LABELS.summary).toBe('Summaries Generated')
      expect(AI_FEATURE_LABELS.qa).toBe('Q&A Questions Asked')
      expect(AI_FEATURE_LABELS.learning_path).toBe('Learning Paths Created')
      expect(AI_FEATURE_LABELS.note_organization).toBe('Notes Organized')
      expect(AI_FEATURE_LABELS.knowledge_gaps).toBe('Gaps Detected')
      expect(AI_FEATURE_LABELS.auto_analysis).toBe('Auto-Analyses Run')
    })
  })

  describe('trackAIUsage', () => {
    it('adds event to IndexedDB when analytics is enabled', async () => {
      mockIsFeatureEnabled.mockReturnValue(true)
      mockAdd.mockResolvedValue(undefined)

      await trackAIUsage('summary', { courseId: 'course-1', durationMs: 500 })

      expect(mockAdd).toHaveBeenCalledWith({
        id: 'test-uuid-1234',
        featureType: 'summary',
        courseId: 'course-1',
        timestamp: FIXED_DATE,
        durationMs: 500,
        status: 'success',
        metadata: undefined,
      })
    })

    it('defaults status to success when not specified', async () => {
      mockIsFeatureEnabled.mockReturnValue(true)
      mockAdd.mockResolvedValue(undefined)

      await trackAIUsage('qa')

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' })
      )
    })

    it('uses provided status when specified', async () => {
      mockIsFeatureEnabled.mockReturnValue(true)
      mockAdd.mockResolvedValue(undefined)

      await trackAIUsage('learning_path', { status: 'error' })

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error' })
      )
    })

    it('includes metadata when provided', async () => {
      mockIsFeatureEnabled.mockReturnValue(true)
      mockAdd.mockResolvedValue(undefined)

      await trackAIUsage('note_organization', {
        metadata: { noteCount: 5, method: 'auto' },
      })

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { noteCount: 5, method: 'auto' },
        })
      )
    })

    it('is a no-op when analytics is disabled', async () => {
      mockIsFeatureEnabled.mockReturnValue(false)

      await trackAIUsage('summary')

      expect(mockAdd).not.toHaveBeenCalled()
    })

    it('never throws on DB error (logs warning)', async () => {
      mockIsFeatureEnabled.mockReturnValue(true)
      mockAdd.mockRejectedValue(new Error('DB write failed'))

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Should not throw
      await expect(trackAIUsage('qa')).resolves.toBeUndefined()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AI Tracking] Failed to record event:',
        expect.any(Error)
      )

      consoleWarnSpy.mockRestore()
    })

    it('accepts no options at all', async () => {
      mockIsFeatureEnabled.mockReturnValue(true)
      mockAdd.mockResolvedValue(undefined)

      await trackAIUsage('knowledge_gaps')

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          featureType: 'knowledge_gaps',
          courseId: undefined,
          durationMs: undefined,
          status: 'success',
          metadata: undefined,
        })
      )
    })
  })

  describe('getAIUsageStats', () => {
    const buildEvents = (
      features: Array<{ type: string; count: number }>,
      baseTimestamp: string = FIXED_DATE
    ): AIUsageEvent[] => {
      const events: AIUsageEvent[] = []
      for (const { type, count } of features) {
        for (let i = 0; i < count; i++) {
          events.push({
            id: `event-${type}-${i}`,
            featureType: type as AIUsageEvent['featureType'],
            timestamp: baseTimestamp,
            status: 'success',
          })
        }
      }
      return events
    }

    it('returns stats for all AI_FEATURES with counts and trends', async () => {
      const currentEvents = buildEvents([
        { type: 'summary', count: 5 },
        { type: 'qa', count: 3 },
      ])
      const previousEvents = buildEvents([
        { type: 'summary', count: 2 },
        { type: 'qa', count: 3 },
      ])

      mockToArray.mockResolvedValueOnce(currentEvents)
      mockWhereBetween.mockResolvedValueOnce(previousEvents)

      const stats = await getAIUsageStats('daily')

      expect(stats.period).toBe('daily')
      expect(stats.totalEvents).toBe(8)
      expect(stats.features).toHaveLength(AI_FEATURES.length)

      const summaryStats = stats.features.find(f => f.featureType === 'summary')
      expect(summaryStats).toEqual({
        featureType: 'summary',
        count: 5,
        trend: 'up',
        previousCount: 2,
      })

      const qaStats = stats.features.find(f => f.featureType === 'qa')
      expect(qaStats).toEqual({
        featureType: 'qa',
        count: 3,
        trend: 'stable',
        previousCount: 3,
      })
    })

    it('returns zero counts for features with no events', async () => {
      mockToArray.mockResolvedValueOnce([])
      mockWhereBetween.mockResolvedValueOnce([])

      const stats = await getAIUsageStats('weekly')

      expect(stats.totalEvents).toBe(0)
      for (const feature of stats.features) {
        expect(feature.count).toBe(0)
        expect(feature.previousCount).toBe(0)
        expect(feature.trend).toBe('stable')
      }
    })

    it('calculates "down" trend when previous > current', async () => {
      const currentEvents = buildEvents([{ type: 'summary', count: 1 }])
      const previousEvents = buildEvents([{ type: 'summary', count: 5 }])

      mockToArray.mockResolvedValueOnce(currentEvents)
      mockWhereBetween.mockResolvedValueOnce(previousEvents)

      const stats = await getAIUsageStats('monthly')

      const summaryStats = stats.features.find(f => f.featureType === 'summary')
      expect(summaryStats?.trend).toBe('down')
    })

    it('supports all time periods', async () => {
      const periods: TimePeriod[] = ['daily', 'weekly', 'monthly']
      for (const period of periods) {
        mockToArray.mockResolvedValueOnce([])
        mockWhereBetween.mockResolvedValueOnce([])

        const stats = await getAIUsageStats(period)
        expect(stats.period).toBe(period)
      }
    })
  })

  describe('getAIUsageTimeline', () => {
    it('returns events sorted by timestamp for the current period', async () => {
      const events: AIUsageEvent[] = [
        {
          id: 'e1',
          featureType: 'summary',
          timestamp: FIXED_DATE,
          status: 'success',
        },
        {
          id: 'e2',
          featureType: 'qa',
          timestamp: FIXED_DATE,
          status: 'success',
        },
      ]

      mockSortBy.mockResolvedValueOnce(events)

      const result = await getAIUsageTimeline('daily')

      expect(result).toEqual(events)
      // Verify it queries timestamp field and sorts by timestamp
      expect(mockSortBy).toHaveBeenCalledWith(
        'timestamp',
        expect.any(String),
        'timestamp'
      )
    })

    it('works for weekly period', async () => {
      mockSortBy.mockResolvedValueOnce([])

      const result = await getAIUsageTimeline('weekly')

      expect(result).toEqual([])
      expect(mockSortBy).toHaveBeenCalled()
    })

    it('works for monthly period', async () => {
      mockSortBy.mockResolvedValueOnce([])

      const result = await getAIUsageTimeline('monthly')

      expect(result).toEqual([])
      expect(mockSortBy).toHaveBeenCalled()
    })
  })
})
