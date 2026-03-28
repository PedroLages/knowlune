import { useState, useEffect } from 'react'
import { getSettings, type ContentDensity } from '@/lib/settings'

/**
 * Reads the `contentDensity` preference from app settings and applies/removes
 * a `.spacious` CSS class on `<html>`. The class activates the spacious content
 * density token overrides defined in theme.css.
 *
 * Listens for `settingsUpdated` custom events so the Settings page toggle
 * can switch density at runtime without a reload.
 *
 * Follows the same pattern as useColorScheme.ts (E21-S04).
 *
 * @returns The current content density value ('default' | 'spacious')
 */
export function useContentDensity() {
  const [contentDensity, setContentDensity] = useState<ContentDensity>(() => {
    return getSettings().contentDensity ?? 'default'
  })

  // Apply / remove the `.spacious` class on <html> whenever the preference changes
  useEffect(() => {
    const root = document.documentElement
    if (contentDensity === 'spacious') {
      root.classList.add('spacious')
    } else {
      root.classList.remove('spacious')
    }

    return () => {
      root.classList.remove('spacious')
    }
  }, [contentDensity])

  // Listen for settings changes dispatched by other components (e.g., Settings page)
  useEffect(() => {
    const handler = () => {
      setContentDensity(getSettings().contentDensity ?? 'default')
    }
    window.addEventListener('settingsUpdated', handler)
    return () => window.removeEventListener('settingsUpdated', handler)
  }, [])

  return contentDensity
}
