import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock dashboardOrder lib
const mockConfig = {
  order: ['recommended-next', 'metrics-strip', 'quiz-performance'] as string[],
  pinnedSections: [] as string[],
  isManuallyOrdered: false,
}

vi.mock('@/lib/dashboardOrder', () => ({
  getOrderConfig: () => ({ ...mockConfig, pinnedSections: [...mockConfig.pinnedSections] }),
  saveOrderConfig: vi.fn(),
  getSectionStats: vi.fn(() => ({})),
  recordSectionView: vi.fn(),
  recordSectionTime: vi.fn(),
  computeAutoOrder: vi.fn(() => mockConfig.order),
  pinSection: vi.fn((id: string) => ({
    ...mockConfig,
    pinnedSections: [id],
  })),
  unpinSection: vi.fn((id: string) => ({
    ...mockConfig,
    pinnedSections: mockConfig.pinnedSections.filter((s: string) => s !== id),
  })),
  setManualOrder: vi.fn((order: string[]) => ({
    ...mockConfig,
    order,
    isManuallyOrdered: true,
  })),
  resetToDefaultOrder: vi.fn(() => ({
    ...mockConfig,
    isManuallyOrdered: false,
  })),
}))

import { useDashboardOrder } from '../useDashboardOrder'
import type { DashboardSectionId } from '@/lib/dashboardOrder'

describe('useDashboardOrder', () => {
  beforeEach(() => {
    mockConfig.order = ['recommended-next', 'metrics-strip', 'quiz-performance']
    mockConfig.pinnedSections = []
    mockConfig.isManuallyOrdered = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns initial section order from config', () => {
    const { result } = renderHook(() => useDashboardOrder())
    expect(result.current.sectionOrder).toEqual([
      'recommended-next',
      'metrics-strip',
      'quiz-performance',
    ])
  })

  it('returns empty pinnedSections set initially', () => {
    const { result } = renderHook(() => useDashboardOrder())
    expect(result.current.pinnedSections.size).toBe(0)
  })

  it('handlePin pins a section', () => {
    const { result } = renderHook(() => useDashboardOrder())
    act(() => {
      result.current.handlePin('metrics-strip' as DashboardSectionId)
    })
    expect(result.current.pinnedSections.has('metrics-strip' as DashboardSectionId)).toBe(true)
  })

  it('handleUnpin unpins a section', () => {
    mockConfig.pinnedSections = ['metrics-strip']
    const { result } = renderHook(() => useDashboardOrder())
    act(() => {
      result.current.handleUnpin('metrics-strip' as DashboardSectionId)
    })
    expect(result.current.pinnedSections.has('metrics-strip' as DashboardSectionId)).toBe(false)
  })

  it('handleReorder sets manual order', () => {
    const newOrder = [
      'quiz-performance',
      'recommended-next',
      'metrics-strip',
    ] as DashboardSectionId[]
    const { result } = renderHook(() => useDashboardOrder())
    act(() => {
      result.current.handleReorder(newOrder)
    })
    expect(result.current.sectionOrder).toEqual(newOrder)
    expect(result.current.isManuallyOrdered).toBe(true)
  })

  it('handleReset resets to default order', () => {
    const { result } = renderHook(() => useDashboardOrder())
    act(() => {
      result.current.handleReset()
    })
    expect(result.current.isManuallyOrdered).toBe(false)
  })

  it('manages isCustomizing state', () => {
    const { result } = renderHook(() => useDashboardOrder())
    expect(result.current.isCustomizing).toBe(false)
    act(() => {
      result.current.setIsCustomizing(true)
    })
    expect(result.current.isCustomizing).toBe(true)
  })

  it('createSectionRef returns a callback ref function', () => {
    const { result } = renderHook(() => useDashboardOrder())
    const ref = result.current.createSectionRef('metrics-strip' as DashboardSectionId)
    expect(typeof ref).toBe('function')
  })
})
