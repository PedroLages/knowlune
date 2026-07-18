import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyDashboardPreset,
  clearDashboardData,
  DASHBOARD_PREFERENCES_KEY,
  DEFAULT_ORDER,
  getDashboardPreferences,
  getPresetPreferences,
  resetDashboardPreferences,
  SECTION_LABELS,
  setManualOrder,
  setSectionVisibility,
  type DashboardSectionId,
} from '@/lib/dashboardOrder'

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key]
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

describe('dashboard preferences V2', () => {
  it('defines six unique replacement groups in the product order', () => {
    const expected: DashboardSectionId[] = [
      'focus',
      'pulse',
      'progress',
      'consistency',
      'insights',
      'library',
    ]
    expect(DEFAULT_ORDER).toEqual(expected)
    expect(new Set(DEFAULT_ORDER).size).toBe(DEFAULT_ORDER.length)
    expect(Object.keys(SECTION_LABELS).sort()).toEqual([...expected].sort())
  })

  it('uses Balanced when no preference exists', () => {
    expect(getDashboardPreferences()).toEqual({
      version: 2,
      preset: 'balanced',
      order: DEFAULT_ORDER,
      hidden: [],
    })
  })

  it('provides stable Focus and Analytics presets without shared arrays', () => {
    const focus = applyDashboardPreset('focus')
    const analytics = getPresetPreferences('analytics')
    focus.order.reverse()

    expect(focus.hidden).toEqual(['consistency', 'insights'])
    expect(analytics.order.slice(0, 4)).toEqual(['pulse', 'progress', 'consistency', 'insights'])
    expect(getPresetPreferences('focus').order[0]).toBe('focus')
    expect(getDashboardPreferences().preset).toBe('focus')
  })

  it('normalizes duplicate, missing, hidden, and stale V2 sections', () => {
    mockStorage[DASHBOARD_PREFERENCES_KEY] = JSON.stringify({
      version: 2,
      preset: 'custom',
      order: ['library', 'library', 'retired-widget'],
      hidden: ['insights', 'insights', 'retired-widget'],
    })

    const preferences = getDashboardPreferences()
    expect(preferences.order).toEqual([
      'library',
      'focus',
      'pulse',
      'progress',
      'consistency',
      'insights',
    ])
    expect(preferences.hidden).toEqual(['insights'])
  })

  it('marks manual reorder and visibility changes as custom', () => {
    applyDashboardPreset('analytics')
    const reordered = setManualOrder(['library', 'focus'])
    const hidden = setSectionVisibility('pulse', false)
    const shown = setSectionVisibility('pulse', true)

    expect(reordered.preset).toBe('custom')
    expect(reordered.order.slice(0, 2)).toEqual(['library', 'focus'])
    expect(hidden.preset).toBe('custom')
    expect(hidden.hidden).toContain('pulse')
    expect(shown.hidden).not.toContain('pulse')
  })

  it('resets a custom layout to Balanced', () => {
    setManualOrder([...DEFAULT_ORDER].reverse())
    setSectionVisibility('library', false)

    expect(resetDashboardPreferences()).toEqual({
      version: 2,
      preset: 'balanced',
      order: DEFAULT_ORDER,
      hidden: [],
    })
  })

  it('migrates the legacy order once into replacement groups and removes tracking stats', () => {
    mockStorage['dashboard-section-order'] = JSON.stringify({
      order: ['metrics-strip', 'quiz-performance', 'study-history', 'recommended-next'],
      pinnedSections: ['course-gallery'],
      isManuallyOrdered: true,
    })
    mockStorage['dashboard-section-stats'] = JSON.stringify({ 'metrics-strip': { views: 10 } })

    const migrated = getDashboardPreferences()
    expect(migrated.preset).toBe('custom')
    expect(migrated.order.slice(0, 5)).toEqual([
      'library',
      'pulse',
      'insights',
      'consistency',
      'focus',
    ])
    expect(mockStorage[DASHBOARD_PREFERENCES_KEY]).toBeDefined()
    expect(mockStorage['dashboard-section-order']).toBeUndefined()
    expect(mockStorage['dashboard-section-stats']).toBeUndefined()

    expect(getDashboardPreferences()).toEqual(migrated)
  })

  it('falls back from malformed legacy data and clears all dashboard keys on request', () => {
    mockStorage['dashboard-section-order'] = '{{invalid'
    mockStorage['dashboard-section-stats'] = '{}'
    expect(getDashboardPreferences().preset).toBe('balanced')

    applyDashboardPreset('focus')
    clearDashboardData()
    expect(mockStorage[DASHBOARD_PREFERENCES_KEY]).toBeUndefined()
    expect(localStorage.removeItem).toHaveBeenCalledWith('dashboard-section-order')
    expect(localStorage.removeItem).toHaveBeenCalledWith('dashboard-section-stats')
  })
})
