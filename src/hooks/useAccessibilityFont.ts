import { useEffect } from 'react'
import { toast } from 'sonner'
import { getSettings, saveSettings } from '@/lib/settings'
import { loadAccessibilityFont, unloadAccessibilityFont } from '@/lib/accessibilityFont'

/**
 * Applies or removes the Atkinson Hyperlegible accessibility font based on
 * the `accessibilityFont` setting in localStorage.
 *
 * Must be called once at app root (App.tsx). Listens for 'settingsUpdated'
 * and 'storage' events so the font swaps immediately when toggled.
 *
 * On load failure the setting is reverted to `false`, a `settingsUpdated`
 * event is dispatched so the UI switch flips back, and an error toast is shown.
 */
export function useAccessibilityFont() {
  useEffect(() => {
    let ignore = false

    async function applyFont() {
      if (ignore) return
      const settings = getSettings()
      if (settings.accessibilityFont) {
        try {
          await loadAccessibilityFont()
        } catch (err) {
          console.error('[useAccessibilityFont] Failed to load font:', err)
          // Revert setting so the UI switch flips back
          saveSettings({ accessibilityFont: false })
          window.dispatchEvent(new Event('settingsUpdated'))
          toast.error('Could not load accessibility font. Please try again.')
        }
      } else {
        unloadAccessibilityFont()
      }
    }

    // Apply on mount
    applyFont()

    // Re-apply when settings change
    const handler = () => {
      applyFont()
    }
    window.addEventListener('settingsUpdated', handler)
    window.addEventListener('storage', handler)

    return () => {
      ignore = true
      window.removeEventListener('settingsUpdated', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])
}
