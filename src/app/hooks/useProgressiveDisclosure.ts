import { useState, useEffect, useCallback, useMemo } from 'react'
import type { NavigationGroup } from '@/app/config/navigation'

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'knowlune-sidebar-disclosure-v1'
const SHOW_ALL_KEY = 'knowlune-sidebar-show-all-v1'

/**
 * Disclosure keys that can be unlocked by user actions.
 *
 * Each key maps to a feature that, once used, reveals the corresponding
 * navigation items. Items without a disclosure key are always visible.
 */
export type DisclosureKey =
  | 'course-imported' // Authors section appears
  | 'lesson-completed' // Reports / analytics items appear
  | 'note-created' // Notes / bookmarks appear
  | 'review-used' // Review, Retention appear
  | 'challenge-used' // Challenges, Session History appear
  | 'ai-used' // AI Learning Path, Knowledge Gaps, AI Analytics appear

// ── Helpers ────────────────────────────────────────────────────────────────

function loadUnlocked(): Set<DisclosureKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as DisclosureKey[]
      return new Set(arr)
    }
  } catch {
    // silent-catch-ok: non-critical persistence error
    // corrupted — start fresh
  }
  return new Set()
}

function persistUnlocked(keys: Set<DisclosureKey>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]))
}

function loadShowAll(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_ALL_KEY)
    return raw === 'true'
  } catch {
    // silent-catch-ok: localStorage fallback is non-critical
    return false
  }
}

function persistShowAll(val: boolean) {
  localStorage.setItem(SHOW_ALL_KEY, val ? 'true' : 'false')
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useProgressiveDisclosure() {
  const [unlocked, setUnlocked] = useState<Set<DisclosureKey>>(loadUnlocked)
  const [showAll, setShowAll] = useState<boolean>(loadShowAll)

  // Persist unlocked keys
  useEffect(() => {
    persistUnlocked(unlocked)
  }, [unlocked])

  // Persist showAll preference
  useEffect(() => {
    persistShowAll(showAll)
  }, [showAll])

  // Listen for unlock events dispatched from anywhere in the app
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent<DisclosureKey>).detail
      if (key) {
        setUnlocked(prev => {
          if (prev.has(key)) return prev
          const next = new Set(prev)
          next.add(key)
          return next
        })
      }
    }
    window.addEventListener('sidebar-unlock', handler)
    return () => window.removeEventListener('sidebar-unlock', handler)
  }, [])

  // Listen for cross-tab storage changes
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setUnlocked(new Set(JSON.parse(e.newValue)))
        } catch {
          // silent-catch-ok: non-critical persistence error
          /* ignore */
        }
      }
      if (e.key === SHOW_ALL_KEY && e.newValue !== null) {
        setShowAll(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Listen for same-tab settings update (e.g. toggling "Show all" in Settings)
  useEffect(() => {
    const handler = () => {
      setShowAll(loadShowAll())
      setUnlocked(loadUnlocked())
    }
    window.addEventListener('disclosureUpdated', handler)
    return () => window.removeEventListener('disclosureUpdated', handler)
  }, [])

  const unlock = useCallback((key: DisclosureKey) => {
    setUnlocked(prev => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }, [])

  const toggleShowAll = useCallback((value: boolean) => {
    setShowAll(value)
    persistShowAll(value)
    window.dispatchEvent(new Event('disclosureUpdated'))
  }, [])

  const isVisible = useCallback(
    (disclosureKey?: DisclosureKey) => {
      if (showAll) return true
      if (!disclosureKey) return true // no key = always visible
      return unlocked.has(disclosureKey)
    },
    [showAll, unlocked]
  )

  /**
   * Filter navigation groups to only include visible items.
   * Empty groups are removed entirely.
   */
  const filterGroups = useCallback(
    (groups: NavigationGroup[]): NavigationGroup[] => {
      return groups
        .map(group => ({
          ...group,
          items: group.items.filter(item => isVisible(item.disclosureKey)),
        }))
        .filter(group => group.items.length > 0)
    },
    [isVisible]
  )

  return useMemo(
    () => ({
      unlocked,
      showAll,
      unlock,
      toggleShowAll,
      isVisible,
      filterGroups,
    }),
    [unlocked, showAll, unlock, toggleShowAll, isVisible, filterGroups]
  )
}

// ── Fire-and-forget helper for non-React code ──────────────────────────────

/**
 * Dispatch from anywhere (e.g., store actions, service modules) to unlock
 * a sidebar item. The hook picks it up via window event listener.
 */
export function unlockSidebarItem(key: DisclosureKey) {
  // Persist immediately (in case hook isn't mounted yet)
  const current = loadUnlocked()
  if (!current.has(key)) {
    current.add(key)
    persistUnlocked(current)
  }
  window.dispatchEvent(new CustomEvent('sidebar-unlock', { detail: key }))
}
