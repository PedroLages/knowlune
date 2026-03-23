import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  StickyNote,
  RotateCcw,
  ShieldCheck,
  Users,
  Target,
  History,
  BarChart3,
  ClipboardList,
  BrainCircuit,
  Sparkles,
  Brain,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'

export interface NavigationItem {
  name: string
  path: string
  icon: LucideIcon
  tab?: string // optional: when set, link navigates to path?tab=tab and is active only when search matches
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
export const navigationGroups: NavigationGroup[] = [
  {
    label: 'Learn',
    items: [
      { name: 'Overview', path: '/', icon: LayoutDashboard },
      { name: 'My Courses', path: '/my-class', icon: BookOpen },
      { name: 'Courses', path: '/courses', icon: GraduationCap },
      { name: 'Authors', path: '/authors', icon: Users },
      { name: 'Notes', path: '/notes', icon: StickyNote },
    ],
  },
  {
    // Note: group label 'Review' intentionally shares the name with the nav item 'Review'
    // (path /review). They serve different roles: the label names the group, the item is a link.
    label: 'Review',
    items: [
      { name: 'Learning Path', path: '/ai-learning-path', icon: Sparkles },
      { name: 'Knowledge Gaps', path: '/knowledge-gaps', icon: Brain },
      { name: 'Review', path: '/review', icon: RotateCcw },
      { name: 'Retention', path: '/retention', icon: ShieldCheck },
    ],
  },
  {
    label: 'Track',
    items: [
      { name: 'Challenges', path: '/challenges', icon: Target },
      { name: 'Session History', path: '/session-history', icon: History },
      { name: 'Study Analytics', path: '/reports', tab: 'study', icon: BarChart3 },
      { name: 'Quiz Analytics', path: '/reports', tab: 'quizzes', icon: ClipboardList },
      { name: 'AI Analytics', path: '/reports', tab: 'ai', icon: BrainCircuit },
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
