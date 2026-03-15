import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  StickyNote,
  RotateCcw,
  MessageSquare,
  Users,
  Target,
  History,
  BarChart3,
  Sparkles,
  Brain,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'

export interface NavigationItem {
  name: string
  path: string
  icon: LucideIcon
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
      { name: 'My Classes', path: '/my-class', icon: BookOpen },
      { name: 'Courses', path: '/courses', icon: GraduationCap },
      { name: 'Learning Path', path: '/ai-learning-path', icon: Sparkles },
      { name: 'Knowledge Gaps', path: '/knowledge-gaps', icon: Brain },
      { name: 'Notes', path: '/notes', icon: StickyNote },
      { name: 'Review', path: '/review', icon: RotateCcw },
    ],
  },
  {
    label: 'Connect',
    items: [
      { name: 'Messages', path: '/messages', icon: MessageSquare },
      { name: 'Instructors', path: '/instructors', icon: Users },
    ],
  },
  {
    label: 'Track',
    items: [
      { name: 'Challenges', path: '/challenges', icon: Target },
      { name: 'Session History', path: '/session-history', icon: History },
      { name: 'Reports', path: '/reports', icon: BarChart3 },
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

// Paths for primary navigation (shown in mobile bottom bar)
const primaryNavPaths = ['/', '/my-class', '/courses', '/notes']

// Get primary navigation items (for mobile bottom bar)
export function getPrimaryNav(): NavigationItem[] {
  return navigationItems.filter(item => primaryNavPaths.includes(item.path))
}

// Get overflow navigation items (shown in mobile "More" drawer)
export function getOverflowNav(): NavigationItem[] {
  return navigationItems.filter(item => !primaryNavPaths.includes(item.path))
}
