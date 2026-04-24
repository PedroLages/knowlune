import {
  LayoutDashboard,
  BookOpen,
  BookA,
  Highlighter,
  Search,
  GraduationCap,
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
  Route,
  Library,
  Layers,
  MessageSquare,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import type { DisclosureKey } from '@/app/hooks/useProgressiveDisclosure'

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

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

// Grouped navigation for sidebar
// Groups: Library (browse content), Study (active learning), Track (progress & analytics)
export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Library',
    items: [
      { name: 'Overview', path: '/', icon: LayoutDashboard },
      { name: 'Courses', path: '/courses', icon: GraduationCap },
      { name: 'Learning Paths', path: '/learning-paths', icon: Route },
      { name: 'Books', path: '/library', icon: Library },
      { name: 'Authors', path: '/authors', icon: Users, disclosureKey: 'course-imported' },
    ],
  },
  {
    label: 'Study',
    items: [
      { name: 'My Courses', path: '/my-class', icon: BookOpen },
      { name: 'Notes', path: '/notes', icon: StickyNote, disclosureKey: 'note-created' },
      { name: 'Flashcards', path: '/flashcards', icon: Layers },
      { name: 'Vocabulary', path: '/vocabulary', icon: BookA },
      { name: 'Highlight Review', path: '/highlight-review', icon: Highlighter },
      { name: 'Cross-Book Search', path: '/search-annotations', icon: Search },
      { name: 'Review', path: '/review', icon: RotateCcw, disclosureKey: 'review-used' },
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
  {
    label: 'Track',
    items: [
      { name: 'Challenges', path: '/challenges', icon: Target, disclosureKey: 'challenge-used' },
      { name: 'Knowledge Map', path: '/knowledge-map', icon: Map },
      { name: 'Knowledge Gaps', path: '/knowledge-gaps', icon: Brain, disclosureKey: 'ai-used', guestHidden: true },
      { name: 'Retention', path: '/retention', icon: ShieldCheck, disclosureKey: 'review-used' },
      {
        name: 'Session History',
        path: '/session-history',
        icon: History,
        disclosureKey: 'challenge-used',
      },
      { name: 'Reports', path: '/reports', icon: BarChart3, disclosureKey: 'lesson-completed' },
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
export const primaryNavPaths = ['/', '/my-class', '/courses', '/notes']

// Get primary navigation items (for mobile bottom bar)
export function getPrimaryNav(): NavigationItem[] {
  return navigationItems.filter(item => primaryNavPaths.includes(item.path))
}

// Get overflow navigation items (shown in mobile "More" drawer)
export function getOverflowNav(): NavigationItem[] {
  return navigationItems.filter(item => !primaryNavPaths.includes(item.path))
}
