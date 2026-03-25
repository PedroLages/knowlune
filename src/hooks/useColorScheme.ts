import { useState, useEffect } from 'react'
import { getSettings } from '@/lib/settings'

/**
 * Reads the `colorScheme` preference from app settings and applies/removes
 * a `.vibrant` CSS class on `<html>`. The class activates the vibrant design
 * token overrides defined in theme.css.
 *
 * Listens for `settingsUpdated` custom events so the Settings page toggle
 * (E21-S05) can switch schemes at runtime without a reload.
 *
 * @returns The current color scheme value ('professional' | 'vibrant')
 */
export function useColorScheme() {
  const [colorScheme, setColorScheme] = useState<'professional' | 'vibrant'>(() => {
    return getSettings().colorScheme ?? 'professional'
  })

  // Apply / remove the `.vibrant` class on <html> whenever the preference changes
  useEffect(() => {
    const root = document.documentElement
    if (colorScheme === 'vibrant') {
      root.classList.add('vibrant')
    } else {
      root.classList.remove('vibrant')
    }

    return () => {
      root.classList.remove('vibrant')
    }
  }, [colorScheme])

  // Listen for settings changes dispatched by other components (e.g., Settings page)
  useEffect(() => {
    const handler = () => {
      setColorScheme(getSettings().colorScheme ?? 'professional')
    }
    window.addEventListener('settingsUpdated', handler)
    return () => window.removeEventListener('settingsUpdated', handler)
  }, [])

  return colorScheme
}
