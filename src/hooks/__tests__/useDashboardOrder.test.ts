import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  preferences: {
    version: 2 as const,
    preset: 'balanced' as 'balanced' | 'focus' | 'analytics' | 'custom',
    order: ['focus', 'pulse', 'progress', 'consistency', 'insights', 'library'],
    hidden: [] as string[],
  },
  applyPreset: vi.fn(),
  setManualOrder: vi.fn(),
  setVisibility: vi.fn(),
  reset: vi.fn(),
}))

vi.mock('@/lib/dashboardOrder', () => ({
  getDashboardPreferences: () => ({
    ...mocks.preferences,
    order: [...mocks.preferences.order],
    hidden: [...mocks.preferences.hidden],
  }),
  applyDashboardPreset: mocks.applyPreset,
  setManualOrder: mocks.setManualOrder,
  setSectionVisibility: mocks.setVisibility,
  resetDashboardPreferences: mocks.reset,
}))

import { useDashboardOrder } from '../useDashboardOrder'
import type { DashboardPreferencesV2, DashboardSectionId } from '@/lib/dashboardOrder'

const customPreferences: DashboardPreferencesV2 = {
  version: 2,
  preset: 'custom',
  order: ['library', 'focus', 'pulse', 'progress', 'consistency', 'insights'],
  hidden: ['insights'],
}

beforeEach(() => {
  mocks.preferences.preset = 'balanced'
  mocks.preferences.order = ['focus', 'pulse', 'progress', 'consistency', 'insights', 'library']
  mocks.preferences.hidden = []
  mocks.applyPreset.mockReset().mockReturnValue({ ...customPreferences, preset: 'focus' })
  mocks.setManualOrder.mockReset().mockReturnValue(customPreferences)
  mocks.setVisibility.mockReset().mockReturnValue(customPreferences)
  mocks.reset.mockReset().mockReturnValue({
    version: 2,
    preset: 'balanced',
    order: ['focus', 'pulse', 'progress', 'consistency', 'insights', 'library'],
    hidden: [],
  })
})

describe('useDashboardOrder', () => {
  it('exposes the saved preset, order, and hidden section set', () => {
    mocks.preferences.preset = 'custom'
    mocks.preferences.hidden = ['insights']
    const { result } = renderHook(() => useDashboardOrder())

    expect(result.current.preset).toBe('custom')
    expect(result.current.sectionOrder[0]).toBe('focus')
    expect(result.current.hiddenSections.has('insights')).toBe(true)
  })

  it('applies presets without viewport-driven reordering', () => {
    const { result } = renderHook(() => useDashboardOrder())
    act(() => result.current.handlePreset('focus'))

    expect(mocks.applyPreset).toHaveBeenCalledWith('focus')
    expect(result.current.preset).toBe('focus')
  })

  it('updates manual order and visibility as custom preferences', () => {
    const { result } = renderHook(() => useDashboardOrder())
    const newOrder = customPreferences.order as DashboardSectionId[]

    act(() => result.current.handleReorder(newOrder))
    expect(mocks.setManualOrder).toHaveBeenCalledWith(newOrder)
    expect(result.current.sectionOrder[0]).toBe('library')

    act(() => result.current.handleVisibility('insights', false))
    expect(mocks.setVisibility).toHaveBeenCalledWith('insights', false)
    expect(result.current.hiddenSections.has('insights')).toBe(true)
  })

  it('resets to Balanced and manages the customization panel', () => {
    const { result } = renderHook(() => useDashboardOrder())

    act(() => result.current.setIsCustomizing(true))
    expect(result.current.isCustomizing).toBe(true)

    act(() => result.current.handleReset())
    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(result.current.preset).toBe('balanced')
  })
})
