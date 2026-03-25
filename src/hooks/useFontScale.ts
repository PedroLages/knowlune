import { useEffect } from 'react'
import { getSettings, FONT_SIZE_PX, type FontSize } from '@/lib/settings'

/**
 * Applies font scaling by setting the `--font-size` CSS custom property on `<html>`.
 * All `rem` values scale proportionally because the root font-size drives everything.
 *
 * Must be called once at app root (App.tsx). Also listens for 'settingsUpdated'
 * events so the scale updates immediately when changed in Settings.
 */
export function useFontScale() {
  useEffect(() => {
    function applyFontScale() {
      const settings = getSettings()
      const fontSize: FontSize = settings.fontSize ?? 'medium'
      const px = FONT_SIZE_PX[fontSize] ?? 16
      document.documentElement.style.setProperty('--font-size', `${px}px`)
    }

    // Apply immediately on mount
    applyFontScale()

    // Re-apply when settings change (dispatched from Settings page)
    window.addEventListener('settingsUpdated', applyFontScale)
    // Also listen for storage changes from other tabs
    window.addEventListener('storage', applyFontScale)

    return () => {
      window.removeEventListener('settingsUpdated', applyFontScale)
      window.removeEventListener('storage', applyFontScale)
    }
  }, [])
}
