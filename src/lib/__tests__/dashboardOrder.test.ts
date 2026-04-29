import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSectionStats,
  saveSectionStats,
  recordSectionView,
  recordSectionTime,
  getOrderConfig,
  saveOrderConfig,
  computeRelevanceScore,
  computeAutoOrder,
  pinSection,
  unpinSection,
  setManualOrder,
  resetToDefaultOrder,
  clearDashboardData,
  DEFAULT_ORDER,
  SECTION_LABELS,
  type DashboardSectionId,
  type SectionStats,
} from '@/lib/dashboardOrder'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  // Clear mock storage
  Object.keys(mockStorage).forEach(k => delete mockStorage[k])

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key]
    }),
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('DEFAULT_ORDER contains 12 sections', () => {
    expect(DEFAULT_ORDER).toHaveLength(12)
  })

  it('SECTION_LABELS has entry for every default section', () => {
    for (const id of DEFAULT_ORDER) {
      expect(SECTION_LABELS[id]).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// getSectionStats / saveSectionStats
// ---------------------------------------------------------------------------

describe('getSectionStats', () => {
  it('returns default stats when nothing saved', () => {
    const stats = getSectionStats()
    for (const id of DEFAULT_ORDER) {
      expect(stats[id]).toEqual({ views: 0, timeSpentMs: 0, lastAccessedAt: '' })
    }
  })

  it('returns saved stats from localStorage', () => {
    const saved: Record<string, SectionStats> = {
      'recommended-next': { views: 5, timeSpentMs: 1000, lastAccessedAt: '2026-01-01T00:00:00Z' },
    }
    mockStorage['dashboard-section-stats'] = JSON.stringify(saved)

    const stats = getSectionStats()
    expect(stats['recommended-next'].views).toBe(5)
  })

  it('returns defaults on corrupted JSON', () => {
    mockStorage['dashboard-section-stats'] = '{{invalid'

    const stats = getSectionStats()
    expect(stats['recommended-next'].views).toBe(0)
  })
})

describe('saveSectionStats', () => {
  it('persists stats to localStorage', () => {
    const stats = getSectionStats()
    stats['quiz-performance'].views = 42
    saveSectionStats(stats)

    expect(mockStorage['dashboard-section-stats']).toBeDefined()
    const parsed = JSON.parse(mockStorage['dashboard-section-stats'])
    expect(parsed['quiz-performance'].views).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// recordSectionView / recordSectionTime
// ---------------------------------------------------------------------------

describe('recordSectionView', () => {
  it('increments view count', () => {
    recordSectionView('quiz-performance')
    recordSectionView('quiz-performance')

    const stats = getSectionStats()
    expect(stats['quiz-performance'].views).toBe(2)
  })

  it('sets lastAccessedAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))

    recordSectionView('metrics-strip')

    const stats = getSectionStats()
    expect(stats['metrics-strip'].lastAccessedAt).toBe('2026-04-06T12:00:00.000Z')

    vi.useRealTimers()
  })
})

describe('recordSectionTime', () => {
  it('accumulates time spent', () => {
    recordSectionTime('study-history', 5000)
    recordSectionTime('study-history', 3000)

    const stats = getSectionStats()
    expect(stats['study-history'].timeSpentMs).toBe(8000)
  })
})

// ---------------------------------------------------------------------------
// getOrderConfig / saveOrderConfig
// ---------------------------------------------------------------------------

describe('getOrderConfig', () => {
  it('returns default config when nothing saved', () => {
    const config = getOrderConfig()
    expect(config.order).toEqual(DEFAULT_ORDER)
    expect(config.pinnedSections).toEqual([])
    expect(config.isManuallyOrdered).toBe(false)
  })

  it('adds missing sections to saved config', () => {
    const partial = {
      order: ['recommended-next', 'metrics-strip'] as DashboardSectionId[],
      pinnedSections: [],
      isManuallyOrdered: false,
    }
    mockStorage['dashboard-section-order'] = JSON.stringify(partial)

    const config = getOrderConfig()
    // Should include all DEFAULT_ORDER sections
    expect(config.order.length).toBe(DEFAULT_ORDER.length)
    expect(config.order[0]).toBe('recommended-next')
    expect(config.order[1]).toBe('metrics-strip')
  })

  it('removes stale sections from saved config', () => {
    const stale = {
      order: [...DEFAULT_ORDER, 'nonexistent-section'] as unknown as DashboardSectionId[],
      pinnedSections: ['nonexistent-section'] as unknown as DashboardSectionId[],
      isManuallyOrdered: false,
    }
    mockStorage['dashboard-section-order'] = JSON.stringify(stale)

    const config = getOrderConfig()
    expect(config.order).not.toContain('nonexistent-section')
    expect(config.pinnedSections).not.toContain('nonexistent-section')
  })

  it('returns defaults on corrupted JSON', () => {
    mockStorage['dashboard-section-order'] = '{{invalid'
    const config = getOrderConfig()
    expect(config.order).toEqual(DEFAULT_ORDER)
  })
})

// ---------------------------------------------------------------------------
// computeRelevanceScore
// ---------------------------------------------------------------------------

describe('computeRelevanceScore', () => {
  it('returns 0 for no interactions', () => {
    const stats: SectionStats = { views: 0, timeSpentMs: 0, lastAccessedAt: '' }
    expect(computeRelevanceScore(stats)).toBeCloseTo(0, 2)
  })

  it('returns higher score for recent access', () => {
    // Uses real Date.now() intentionally: this test validates that the recency
    // decay function treats "now" as more relevant than "7 days ago". The
    // assertion only compares relative scores, so the absolute wall-clock time
    // does not affect correctness.
    const recent: SectionStats = {
      views: 1,
      timeSpentMs: 60000,
      lastAccessedAt: new Date().toISOString(),
    }
    const old: SectionStats = {
      views: 1,
      timeSpentMs: 60000,
      lastAccessedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
    expect(computeRelevanceScore(recent)).toBeGreaterThan(computeRelevanceScore(old))
  })

  it('returns higher score for more views', () => {
    const now = new Date().toISOString()
    const moreViews: SectionStats = { views: 100, timeSpentMs: 0, lastAccessedAt: now }
    const fewerViews: SectionStats = { views: 1, timeSpentMs: 0, lastAccessedAt: now }
    expect(computeRelevanceScore(moreViews)).toBeGreaterThan(computeRelevanceScore(fewerViews))
  })
})

// ---------------------------------------------------------------------------
// computeAutoOrder
// ---------------------------------------------------------------------------

describe('computeAutoOrder', () => {
  it('returns default order when no interactions', () => {
    const stats = getSectionStats()
    const order = computeAutoOrder(stats, [])
    expect(order).toEqual(DEFAULT_ORDER)
  })

  it('places pinned sections first', () => {
    const stats = getSectionStats()
    const order = computeAutoOrder(stats, ['course-gallery'])
    expect(order[0]).toBe('course-gallery')
  })

  it('sorts unpinned sections by relevance when interactions exist', () => {
    const stats = getSectionStats()
    stats['study-history'].views = 100
    stats['study-history'].lastAccessedAt = new Date().toISOString()
    stats['study-history'].timeSpentMs = 300000

    const order = computeAutoOrder(stats, [])
    expect(order[0]).toBe('study-history')
  })
})

// ---------------------------------------------------------------------------
// pinSection / unpinSection
// ---------------------------------------------------------------------------

describe('pinSection', () => {
  it('adds section to pinnedSections', () => {
    const config = pinSection('course-gallery')
    expect(config.pinnedSections).toContain('course-gallery')
    expect(config.order[0]).toBe('course-gallery')
  })

  it('does not duplicate already pinned section', () => {
    pinSection('course-gallery')
    const config = pinSection('course-gallery')
    expect(config.pinnedSections.filter(id => id === 'course-gallery')).toHaveLength(1)
  })
})

describe('unpinSection', () => {
  it('removes section from pinnedSections', () => {
    pinSection('course-gallery')
    const config = unpinSection('course-gallery')
    expect(config.pinnedSections).not.toContain('course-gallery')
  })
})

// ---------------------------------------------------------------------------
// setManualOrder / resetToDefaultOrder / clearDashboardData
// ---------------------------------------------------------------------------

describe('setManualOrder', () => {
  it('sets manual order and flags isManuallyOrdered', () => {
    const reversed = [...DEFAULT_ORDER].reverse() as DashboardSectionId[]
    const config = setManualOrder(reversed)
    expect(config.order).toEqual(reversed)
    expect(config.isManuallyOrdered).toBe(true)
  })
})

describe('resetToDefaultOrder', () => {
  it('resets to default and clears pins and manual flag', () => {
    pinSection('study-history')
    setManualOrder([...DEFAULT_ORDER].reverse() as DashboardSectionId[])

    const config = resetToDefaultOrder()
    expect(config.order).toEqual(DEFAULT_ORDER)
    expect(config.pinnedSections).toEqual([])
    expect(config.isManuallyOrdered).toBe(false)
  })
})

describe('clearDashboardData', () => {
  it('removes both storage keys', () => {
    saveSectionStats(getSectionStats())
    saveOrderConfig(getOrderConfig())

    clearDashboardData()

    expect(localStorage.removeItem).toHaveBeenCalledWith('dashboard-section-order')
    expect(localStorage.removeItem).toHaveBeenCalledWith('dashboard-section-stats')
  })
})
