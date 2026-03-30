/**
 * useTheaterMode — Manages theater mode state with localStorage persistence.
 *
 * Theater mode expands the video panel to full width by collapsing the side panel.
 * State is persisted so navigating between lessons preserves the user's preference.
 *
 * @see E91-S03
 */

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'lesson-theater-mode'

function readStoredValue(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'true'
  } catch {
    // silent-catch-ok — localStorage unavailable (private browsing); default to false
    return false
  }
}

export function useTheaterMode() {
  const [isTheater, setIsTheater] = useState(readStoredValue)

  // Sync to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isTheater))
    } catch {
      // silent-catch-ok — storage full or blocked; degrade gracefully
    }
  }, [isTheater])

  const toggleTheater = useCallback(() => {
    setIsTheater(prev => !prev)
  }, [])

  return { isTheater, toggleTheater } as const
}
