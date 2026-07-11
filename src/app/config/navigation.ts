import {
  LayoutDashboard,
  BookOpen,
  BookA,
  Highlighter,
  Search,
  StickyNote,
  RotateCcw,
  ShieldCheck,
  Users,
  Target,
  History,
  BarChart3,
  Sparkles,
  Brain,
  Map,
  Library,
  Layers,
  MessageSquare,
  Route,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import type { DisclosureKey } from '@/app/hooks/useProgressiveDisclosure'
import { readFromTrack } from '@/lib/locationState'

export interface NavigationItem {
  name: string
  path: string
  icon: LucideIcon
  tab?: string // optional: when set, link navigates to path?tab=tab and is active only when search matches
  /** When set, item is hidden until this key is unlocked via progressive disclosure. */
  disclosureKey?: DisclosureKey
  /** When true, item is hidden from the sidebar when the user is in guest mode. */
  guestHidden?: boolean
}

/** Pure function to calculate whether a navigation item is active given current location. */
export function getIsActive(
  item: Pick<NavigationItem, 'path' | 'tab'>,
  pathname: string,
  search: string
): boolean {
  if (item.tab) {
    const searchMatch = search === `?tab=${item.tab}`
    const isDefaultTab = item.tab === 'study' && search === '' && pathname === item.path
    return pathname === item.path && (searchMatch || isDefaultTab)
  }
  return item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)
}

/**
 * Resolves nav active state, overriding getIsActive when the user is viewing a
 * course through a learning track lens (location.state.fromTrack is present).
 *
 * When fromTrack exists:
 *   - /learning-tracks is forced active (track context takes priority)
 *   - /courses is forced inactive (we're in a track, not browsing all courses)
 */
export function resolveNavActive(
  item: Pick<NavigationItem, 'path' | 'tab'>,
  pathname: string,
  search: string,
  state: unknown
): boolean {
  const base = getIsActive(item, pathname, search)
  const fromTrack = readFromTrack(state)
  if (!fromTrack) return base
  // When viewing a course through a track lens, reroute nav highlighting
  if (item.path === '/learning-tracks') return true
  if (item.path === '/courses') return false
  return base
}

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

// Grouped navigation for sidebar
// Groups: Main (core content), Review (active learning), Insights (progress & analytics)
export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Main',
    items: [
      { name: 'Dashboard', path: '/overview', icon: LayoutDashboard },
      { name: 'Courses', path: '/courses', icon: BookOpen },
      { name: 'Learning Tracks', path: '/learning-tracks', icon: Route },
      { name: 'Books', path: '/library', icon: Library },
      { name: 'Authors', path: '/authors', icon: Users, disclosureKey: 'course-imported' },
    ],
  },
  {
    label: 'Review',
    items: [
      { name: 'Notes', path: '/notes', icon: StickyNote, disclosureKey: 'note-created' },
      { name: 'Flashcards', path: '/flashcards', icon: Layers },
      { name: 'Vocabulary', path: '/vocabulary', icon: BookA },
      { name: 'Highlights', path: '/highlight-review', icon: Highlighter },
      { name: 'Review', path: '/review', icon: RotateCcw, disclosureKey: 'review-used' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Search', path: '/search-annotations', icon: Search },
      { name: 'Knowledge Map', path: '/knowledge-map', icon: Map },
      { name: 'Reports', path: '/reports', icon: BarChart3, disclosureKey: 'lesson-completed' },
      { name: 'Challenges', path: '/challenges', icon: Target, disclosureKey: 'challenge-used' },
      {
        name: 'Knowledge Gaps',
        path: '/knowledge-gaps',
        icon: Brain,
        disclosureKey: 'ai-used',
        guestHidden: true,
      },
      { name: 'Retention', path: '/retention', icon: ShieldCheck, disclosureKey: 'review-used' },
      {
        name: 'Session History',
        path: '/session-history',
        icon: History,
        disclosureKey: 'challenge-used',
      },
      {
        name: 'Learning Path',
        path: '/ai-learning-path',
        icon: Sparkles,
        disclosureKey: 'ai-used',
        guestHidden: true,
      },
      {
        name: 'AI Tutor',
        path: '/tutor',
        icon: MessageSquare,
        disclosureKey: 'ai-used',
        guestHidden: true,
      },
    ],
  },
]

// Settings item (rendered separately at bottom)
export const settingsItem: NavigationItem = {
  name: 'Settings',
  path: '/settings',
  icon: SettingsIcon,
}

// Flat list of all navigation items (used by mobile bottom bar and search)
export const navigationItems: NavigationItem[] = [
  ...navigationGroups.flatMap(g => g.items),
  settingsItem,
]

// Paths for primary navigation (shown in mobile bottom bar).
// The bottom bar has exactly 4 slots — this list must stay at 4 entries.
export const primaryNavPaths = ['/overview', '/courses', '/learning-tracks', '/notes']

// Get primary navigation items (for mobile bottom bar)
export function getPrimaryNav(): NavigationItem[] {
  return navigationItems.filter(item => primaryNavPaths.includes(item.path))
}

// Get overflow navigation items (shown in mobile "More" drawer)
export function getOverflowNav(): NavigationItem[] {
  return navigationItems.filter(item => !primaryNavPaths.includes(item.path))
}
