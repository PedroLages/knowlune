import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { SettingsPageProvider } from '@/app/components/settings/SettingsPageContext'
import { SettingsLayout } from '@/app/components/settings/layout/SettingsLayout'
import { SettingsSearch } from '@/app/components/settings/layout/SettingsSearch'
import type { SettingsCategorySlug } from '@/app/components/settings/layout/settingsCategories'
import { getSettings, DISPLAY_DEFAULTS } from '@/lib/settings'

/**
 * Detect which categories have non-default settings.
 * Returns a Set of category slugs where the user has customized something.
 */
function getModifiedCategories(): Set<SettingsCategorySlug> {
  const s = getSettings()
  const modified = new Set<SettingsCategorySlug>()

  // Profile: non-default name, bio, or avatar
  if (s.displayName !== 'Learner' || s.bio !== '' || s.profilePhotoUrl) {
    modified.add('profile')
  }

  // Appearance: theme, font, accessibility, reading mode, color scheme
  if (
    s.theme !== 'system' ||
    (s.fontSize && s.fontSize !== 'medium') ||
    s.colorScheme !== 'professional' ||
    s.accessibilityFont !== DISPLAY_DEFAULTS.accessibilityFont ||
    s.contentDensity !== DISPLAY_DEFAULTS.contentDensity ||
    s.reduceMotion !== DISPLAY_DEFAULTS.reduceMotion ||
    (s.readingFontSize && s.readingFontSize !== DISPLAY_DEFAULTS.readingFontSize) ||
    (s.readingLineHeight && s.readingLineHeight !== DISPLAY_DEFAULTS.readingLineHeight) ||
    (s.readingTheme && s.readingTheme !== DISPLAY_DEFAULTS.readingTheme)
  ) {
    modified.add('appearance')
  }

  // Learning: focus mode defaults changed
  if (
    s.focusAutoQuiz !== DISPLAY_DEFAULTS.focusAutoQuiz ||
    s.focusAutoFlashcard !== DISPLAY_DEFAULTS.focusAutoFlashcard
  ) {
    modified.add('learning')
  }

  return modified
}

export default function Settings() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [, setSearchParams] = useSearchParams()
  const [modifiedCategories, setModifiedCategories] = useState(() => getModifiedCategories())

  // Listen for settings changes to update modified indicators
  useEffect(() => {
    function handleSettingsUpdate() {
      setModifiedCategories(getModifiedCategories())
    }
    window.addEventListener('settingsUpdated', handleSettingsUpdate)
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate)
  }, [])

  // Cmd+F keyboard shortcut for search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        // Only capture when Settings page is focused (not in an input)
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchNavigate = useCallback(
    (category: SettingsCategorySlug) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        if (category === 'account') {
          next.delete('section')
        } else {
          next.set('section', category)
        }
        return next
      })
    },
    [setSearchParams]
  )

  return (
    <SettingsPageProvider>
      <SettingsLayout
        modifiedCategories={modifiedCategories}
        onSearchOpen={() => setSearchOpen(true)}
      />
      <SettingsSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={handleSearchNavigate}
      />
    </SettingsPageProvider>
  )
}
