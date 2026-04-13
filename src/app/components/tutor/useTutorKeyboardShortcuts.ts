/**
 * useTutorKeyboardShortcuts (E73-S05)
 *
 * Registers keyboard shortcuts for the tutor chat:
 * - Cmd+H: toggle conversation history sheet
 * - Cmd+M: toggle memory indicator expand/collapse
 * - Cmd+1-5: switch tutor modes (socratic, explain, eli5, quiz, debug)
 *
 * Only active on desktop (skips if touch device detected).
 */

import { useEffect, useCallback } from 'react'
import type { TutorMode } from '@/ai/tutor/types'

const MODE_SHORTCUTS: Record<string, TutorMode> = {
  '1': 'socratic',
  '2': 'explain',
  '3': 'eli5',
  '4': 'quiz',
  '5': 'debug',
}

interface UseTutorKeyboardShortcutsOptions {
  onToggleHistory: () => void
  onToggleMemory: () => void
  onSwitchMode: (mode: TutorMode) => void
  disabled?: boolean
}

export function useTutorKeyboardShortcuts({
  onToggleHistory,
  onToggleMemory,
  onSwitchMode,
  disabled = false,
}: UseTutorKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return

      // Skip on mobile/touch devices
      if ('ontouchstart' in window && window.innerWidth < 640) return

      // Only handle Cmd (Mac) or Ctrl (Windows/Linux)
      if (!e.metaKey && !e.ctrlKey) return

      // Avoid conflicts when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Cmd+H even in inputs (browser doesn't use it in inputs)
        if (e.key !== 'h') return
      }

      // Cmd+H conflicts with macOS "Hide Window" but e.preventDefault() captures it in-browser per AC spec
      if (e.key === 'h') {
        e.preventDefault()
        onToggleHistory()
        return
      }

      if (e.key === 'm') {
        e.preventDefault()
        onToggleMemory()
        return
      }

      const mode = MODE_SHORTCUTS[e.key]
      if (mode) {
        e.preventDefault()
        onSwitchMode(mode)
      }
    },
    [disabled, onToggleHistory, onToggleMemory, onSwitchMode]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}
