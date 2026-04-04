/**
 * ReadingModeDiscoveryTooltip — One-time tooltip that introduces reading mode
 * to first-time users on lesson pages.
 *
 * Shows near the reading mode button, auto-dismisses after 8 seconds or on click.
 * Uses localStorage flag to ensure it only appears once.
 *
 * @see E65-S05
 */

import { useState, useEffect, useCallback } from 'react'
import { BookOpen, X } from 'lucide-react'

const DISMISSED_KEY = 'reading-mode-tooltip-dismissed'

export function ReadingModeDiscoveryTooltip() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === 'true'
    } catch {
      // silent-catch-ok: localStorage unavailable
      dismissed = true
    }
    if (!dismissed) {
      setVisible(true)
    }
  }, [])

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => {
      dismiss()
    }, 8000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      // silent-catch-ok: localStorage unavailable
    }
  }, [])

  if (!visible) return null

  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
  const shortcut = isMac ? 'Cmd+Shift+R' : 'Ctrl+Shift+R'

  return (
    <div
      role="tooltip"
      className="animate-in fade-in-0 slide-in-from-top-2 fixed top-16 right-4 z-50 flex max-w-xs items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg duration-200"
      data-testid="reading-mode-discovery-tooltip"
    >
      <div className="rounded-full bg-brand-soft p-1.5 shrink-0">
        <BookOpen className="size-4 text-brand" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Try Reading Mode</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Distraction-free studying ({shortcut})
        </p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
        aria-label="Dismiss reading mode tip"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
