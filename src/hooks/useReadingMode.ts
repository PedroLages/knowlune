import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useAriaLiveAnnouncer } from '@/hooks/useAriaLiveAnnouncer'

/**
 * Manages reading mode — a distraction-free view that hides chrome (sidebar,
 * header, bottom nav) and centers lesson content in a narrow column.
 *
 * Toggles a `.reading-mode` CSS class on `<html>`. The class drives layout
 * changes defined in theme.css (same pattern as `useContentDensity`).
 *
 * @param isLessonPage - Whether the current route is a lesson page.
 *   If false, the keyboard shortcut shows a toast instead of activating.
 */
export function useReadingMode(isLessonPage: boolean) {
  const [isReadingMode, setIsReadingMode] = useState(false)
  const savedScrollRef = useRef(0)
  const [announcement, announce] = useAriaLiveAnnouncer(3000)

  // Apply / remove the `.reading-mode` class on <html>
  useEffect(() => {
    const root = document.documentElement
    if (isReadingMode) {
      root.classList.add('reading-mode')
    } else {
      root.classList.remove('reading-mode')
    }
    return () => {
      root.classList.remove('reading-mode')
    }
  }, [isReadingMode])

  const toggleReadingMode = useCallback(() => {
    if (!isLessonPage) {
      toast.info('Reading mode is available on lesson pages')
      return
    }

    const next = !isReadingMode
    if (next) {
      // Entering reading mode — save scroll position
      savedScrollRef.current = window.scrollY
      announce('Reading mode activated. Press Escape to exit.')
    } else {
      // Exiting reading mode — restore scroll after DOM reflow
      const saved = savedScrollRef.current
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, saved)
        })
      })
      announce('Reading mode deactivated.')
    }
    setIsReadingMode(next)
  }, [isLessonPage, isReadingMode, announce])

  const exitReadingMode = useCallback(() => {
    if (!isReadingMode) return
    const saved = savedScrollRef.current
    setIsReadingMode(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, saved)
      })
    })
    announce('Reading mode deactivated.')
  }, [isReadingMode, announce])

  // Keyboard shortcut: Cmd+Shift+R / Ctrl+Shift+R to toggle, Escape to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+R or Ctrl+Shift+R
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        toggleReadingMode()
        return
      }
      // Escape to exit reading mode
      if (e.key === 'Escape' && isReadingMode) {
        exitReadingMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleReadingMode, exitReadingMode, isReadingMode])

  return { isReadingMode, toggleReadingMode, exitReadingMode, announcement }
}
