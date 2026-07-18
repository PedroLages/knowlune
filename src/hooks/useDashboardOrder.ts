import { useCallback, useMemo, useState } from 'react'
import {
  applyDashboardPreset,
  getDashboardPreferences,
  resetDashboardPreferences,
  setManualOrder,
  setSectionVisibility,
  type DashboardPreferencesV2,
  type DashboardPreset,
  type DashboardSectionId,
} from '@/lib/dashboardOrder'

export interface UseDashboardOrderReturn {
  preferences: DashboardPreferencesV2
  sectionOrder: DashboardSectionId[]
  hiddenSections: Set<DashboardSectionId>
  preset: DashboardPreset
  isCustomizing: boolean
  setIsCustomizing: (open: boolean) => void
  handlePreset: (preset: Exclude<DashboardPreset, 'custom'>) => void
  handleReorder: (newOrder: DashboardSectionId[]) => void
  handleVisibility: (sectionId: DashboardSectionId, visible: boolean) => void
  handleReset: () => void
}

export function useDashboardOrder(): UseDashboardOrderReturn {
  const [preferences, setPreferences] = useState<DashboardPreferencesV2>(getDashboardPreferences)
  const [isCustomizing, setIsCustomizing] = useState(false)

  const handlePreset = useCallback((preset: Exclude<DashboardPreset, 'custom'>) => {
    setPreferences(applyDashboardPreset(preset))
  }, [])

  const handleReorder = useCallback((newOrder: DashboardSectionId[]) => {
    setPreferences(setManualOrder(newOrder))
  }, [])

  const handleVisibility = useCallback((sectionId: DashboardSectionId, visible: boolean) => {
    setPreferences(setSectionVisibility(sectionId, visible))
  }, [])

  const handleReset = useCallback(() => {
    setPreferences(resetDashboardPreferences())
  }, [])

  const hiddenSections = useMemo(() => new Set(preferences.hidden), [preferences.hidden])

  return {
    preferences,
    sectionOrder: preferences.order,
    hiddenSections,
    preset: preferences.preset,
    isCustomizing,
    setIsCustomizing,
    handlePreset,
    handleReorder,
    handleVisibility,
    handleReset,
  }
}
