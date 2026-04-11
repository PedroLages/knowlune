/**
 * useKeyboardShortcuts — reusable hook for registering scoped keyboard shortcuts.
 *
 * Features:
 * - Input/textarea guard: shortcuts disabled when text inputs are focused (AC-5)
 * - IME composition guard: shortcuts disabled during IME input
 * - Chord support: sequential key presses with configurable timeout (e.g., G then L)
 * - Modifier key support: Cmd/Ctrl + key combinations
 * - Automatic cleanup on unmount
 *
 * @module useKeyboardShortcuts
 * @since E108-S03
 */
import { useEffect, useRef, useCallback } from 'react'

export interface KeyboardShortcut {
  /** Single key (e.g., 'n') or chord array (e.g., ['g', 'l']) */
  key: string | string[]
  /** Human-readable description for the shortcuts dialog */
  description: string
  /** Action to execute when shortcut is triggered */
  action: () => void
  /** Whether Cmd/Ctrl modifier is required */
  modifier?: boolean
}

/**
 * Registers keyboard shortcuts with input-focus and IME guards.
 *
 * @param shortcuts - Array of shortcut definitions
 * @param enabled - Whether shortcuts are active (default: true)
 * @param chordTimeout - Timeout in ms for chord sequences (default: 500)
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled = true,
  chordTimeout = 500
) {
  const chordBufferRef = useRef<string | null>(null)
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Intentional: store shortcuts in ref to avoid re-registering listener on every render
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  const clearChord = useCallback(() => {
    chordBufferRef.current = null
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current)
      chordTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: skip during IME composition (e.g., Japanese/Chinese input)
      if (e.isComposing) return

      // Guard: skip when text input is focused (AC-5)
      const target = e.target as HTMLElement
      const tagName = target.tagName.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) return

      const key = e.key.toLowerCase()
      const isMod = e.metaKey || e.ctrlKey

      // Check chord continuations first
      if (chordBufferRef.current) {
        const firstKey = chordBufferRef.current
        clearChord()

        for (const shortcut of shortcutsRef.current) {
          if (!Array.isArray(shortcut.key)) continue
          if (shortcut.key.length === 2 && shortcut.key[0] === firstKey && shortcut.key[1] === key) {
            e.preventDefault()
            shortcut.action()
            return
          }
        }
        // Wrong second key — fall through to check if it's a new shortcut
      }

      // Check single-key and chord-start shortcuts
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.modifier && isMod && key === (typeof shortcut.key === 'string' ? shortcut.key : shortcut.key[0])) {
          e.preventDefault()
          shortcut.action()
          return
        }

        if (!shortcut.modifier && !isMod) {
          if (Array.isArray(shortcut.key) && shortcut.key.length === 2 && shortcut.key[0] === key) {
            // Start chord sequence
            chordBufferRef.current = key
            chordTimerRef.current = setTimeout(clearChord, chordTimeout)
            return
          }

          if (typeof shortcut.key === 'string' && shortcut.key === key) {
            e.preventDefault()
            shortcut.action()
            return
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearChord()
    }
  }, [enabled, chordTimeout, clearChord])
}
