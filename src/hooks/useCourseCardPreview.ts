import { useState, useEffect, useRef, useCallback } from 'react'
import { useHoverPreview } from './useHoverPreview'
import { shouldReduceMotion } from '@/lib/settings'

export function useCourseCardPreview() {
  const { active: previewActive, handlers: previewHandlers } = useHoverPreview(1000)
  const [videoReady, setVideoReady] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const prefersReducedMotion = shouldReduceMotion()
  const showPreview = previewActive && !prefersReducedMotion

  useEffect(() => {
    if (!showPreview) setVideoReady(false)
  }, [showPreview])

  // Track popover dismissal so the click that closes the popover
  // doesn't also trigger navigation on the underlying card/link.
  const dismissingRef = useRef(false)

  const handleInfoOpenChange = useCallback((open: boolean) => {
    if (!open) {
      dismissingRef.current = true
      setTimeout(() => {
        dismissingRef.current = false
      }, 200)
    }
    setInfoOpen(open)
  }, [])

  /** Attach to the navigation wrapper's onClick to swallow dismiss-clicks. */
  const guardNavigation = useCallback((e: React.MouseEvent) => {
    if (dismissingRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  return {
    showPreview,
    videoReady,
    setVideoReady,
    previewHandlers,
    previewOpen,
    setPreviewOpen,
    infoOpen,
    setInfoOpen: handleInfoOpenChange,
    guardNavigation,
  } as const
}
