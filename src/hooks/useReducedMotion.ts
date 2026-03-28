import { useState, useEffect } from 'react'
import { getSettings, type ReduceMotion } from '@/lib/settings'

/**
 * Reads the `reduceMotion` preference from app settings and resolves
 * whether motion should be reduced.
 *
 * Three modes:
 * - `'system'`: follows `prefers-reduced-motion` media query
 * - `'on'`: always reduce motion (override OS)
 * - `'off'`: always allow motion (override OS)
 *
 * Listens for `settingsUpdated` custom events (dispatched by Settings page)
 * and `storage` events (cross-tab sync), following the same pattern as
 * useColorScheme.ts (E21-S04).
 *
 * @returns { shouldReduceMotion, preference }
 */
export function useReducedMotion(): {
  shouldReduceMotion: boolean
  preference: ReduceMotion
} {
  const [preference, setPreference] = useState<ReduceMotion>(() => {
    if (typeof window === 'undefined') return 'system'
    return getSettings().reduceMotion ?? 'system'
  })

  const [osReducedMotion, setOsReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  // Listen for app-level settings changes (settingsUpdated + storage events)
  useEffect(() => {
    const handler = () => {
      setPreference(getSettings().reduceMotion ?? 'system')
    }
    window.addEventListener('settingsUpdated', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('settingsUpdated', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  // Listen for OS-level prefers-reduced-motion changes
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => {
      setOsReducedMotion(e.matches)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const shouldReduceMotion =
    preference === 'on' ? true : preference === 'off' ? false : osReducedMotion

  return { shouldReduceMotion, preference }
}
