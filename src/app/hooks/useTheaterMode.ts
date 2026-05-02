/**
 * useTheaterMode — Manages theater mode state with localStorage persistence.
 *
 * Theater mode expands the video panel to full width by collapsing the side panel.
 * State is persisted so navigating between lessons preserves the user's preference.
 *
 * Now a thin wrapper around useLessonChromeStore for backward compatibility.
 * New code should use useLessonChromeStore directly.
 *
 * @see E91-S03
 */

import { useLessonChromeStore } from '@/stores/useLessonChromeStore'

export function useTheaterMode() {
  const isTheater = useLessonChromeStore(s => s.isTheater)
  const toggleTheater = useLessonChromeStore(s => s.toggleTheater)

  return { isTheater, toggleTheater } as const
}
