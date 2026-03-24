/**
 * React hook for managing dashboard section ordering.
 *
 * Provides:
 * - Current section order (auto-computed or manual)
 * - Section interaction tracking (IntersectionObserver)
 * - Pin/unpin, drag-reorder, and reset actions
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  type DashboardSectionId,
  type DashboardOrderConfig,
  getOrderConfig,
  saveOrderConfig,
  getSectionStats,
  recordSectionView,
  recordSectionTime,
  computeAutoOrder,
  pinSection,
  unpinSection,
  setManualOrder,
  resetToDefaultOrder,
} from '@/lib/dashboardOrder'

export interface UseDashboardOrderReturn {
  /** Current ordered list of section IDs */
  sectionOrder: DashboardSectionId[]
  /** Set of pinned section IDs */
  pinnedSections: Set<DashboardSectionId>
  /** Whether user has manually reordered */
  isManuallyOrdered: boolean
  /** Whether the customize panel is open */
  isCustomizing: boolean
  /** Toggle customize panel */
  setIsCustomizing: (open: boolean) => void
  /** Pin a section to the top */
  handlePin: (sectionId: DashboardSectionId) => void
  /** Unpin a section */
  handleUnpin: (sectionId: DashboardSectionId) => void
  /** Set new manual order (from drag-and-drop) */
  handleReorder: (newOrder: DashboardSectionId[]) => void
  /** Reset to default order */
  handleReset: () => void
  /** Create a ref callback that tracks section visibility */
  createSectionRef: (sectionId: DashboardSectionId) => (el: HTMLElement | null) => void
}

export function useDashboardOrder(): UseDashboardOrderReturn {
  const [config, setConfig] = useState<DashboardOrderConfig>(getOrderConfig)
  const [isCustomizing, setIsCustomizing] = useState(false)

  // Track visibility timers per section
  const visibilityTimers = useRef<Map<DashboardSectionId, number>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sectionElements = useRef<Map<DashboardSectionId, HTMLElement>>(new Map())

  // Auto-reorder on mount if not manually ordered (and enough data exists)
  useEffect(() => {
    if (!config.isManuallyOrdered) {
      const stats = getSectionStats()
      const hasInteractions = Object.values(stats).some(s => s.views > 0)
      if (hasInteractions) {
        const autoOrder = computeAutoOrder(stats, config.pinnedSections)
        const newConfig = { ...config, order: autoOrder }
        saveOrderConfig(newConfig)
        setConfig(newConfig)
      }
    }
    // Only run on mount - intentionally empty deps
  }, [])

  // Set up IntersectionObserver for tracking views and time
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const sectionId = entry.target.getAttribute(
            'data-section-id'
          ) as DashboardSectionId | null
          if (!sectionId) continue

          if (entry.isIntersecting) {
            // Record view
            recordSectionView(sectionId)
            // Start timer — Date.now() acceptable: elapsed-time delta, not display
            visibilityTimers.current.set(sectionId, Date.now())
          } else {
            // Record time spent
            const startTime = visibilityTimers.current.get(sectionId)
            if (startTime) {
              const duration = Date.now() - startTime
              recordSectionTime(sectionId, duration)
              visibilityTimers.current.delete(sectionId)
            }
          }
        }
      },
      { threshold: 0.3 }
    )

    // Observe all registered elements
    for (const el of sectionElements.current.values()) {
      observerRef.current.observe(el)
    }

    return () => {
      // Record remaining time for visible sections
      for (const [sectionId, startTime] of visibilityTimers.current.entries()) {
        const duration = Date.now() - startTime
        recordSectionTime(sectionId, duration)
      }
      visibilityTimers.current.clear()
      observerRef.current?.disconnect()
    }
  }, [])

  const createSectionRef = useCallback(
    (sectionId: DashboardSectionId) => (el: HTMLElement | null) => {
      if (el) {
        el.setAttribute('data-section-id', sectionId)
        sectionElements.current.set(sectionId, el)
        observerRef.current?.observe(el)
      } else {
        const prev = sectionElements.current.get(sectionId)
        if (prev) {
          observerRef.current?.unobserve(prev)
          sectionElements.current.delete(sectionId)
        }
      }
    },
    []
  )

  const handlePin = useCallback((sectionId: DashboardSectionId) => {
    const newConfig = pinSection(sectionId)
    setConfig({ ...newConfig })
  }, [])

  const handleUnpin = useCallback((sectionId: DashboardSectionId) => {
    const newConfig = unpinSection(sectionId)
    setConfig({ ...newConfig })
  }, [])

  const handleReorder = useCallback((newOrder: DashboardSectionId[]) => {
    const newConfig = setManualOrder(newOrder)
    setConfig({ ...newConfig })
  }, [])

  const handleReset = useCallback(() => {
    const newConfig = resetToDefaultOrder()
    setConfig({ ...newConfig })
  }, [])

  const pinnedSectionsSet = useMemo(() => new Set(config.pinnedSections), [config.pinnedSections])

  return {
    sectionOrder: config.order,
    pinnedSections: pinnedSectionsSet,
    isManuallyOrdered: config.isManuallyOrdered,
    isCustomizing,
    setIsCustomizing,
    handlePin,
    handleUnpin,
    handleReorder,
    handleReset,
    createSectionRef,
  }
}
