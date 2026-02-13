import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Library,
  Notebook,
  Info,
  BarChart3,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react"

export interface NavigationItem {
  name: string
  path: string
  icon: LucideIcon
}

// All navigation items for the application
export const navigationItems: NavigationItem[] = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "My Classes", path: "/my-class", icon: BookOpen },
  { name: "Courses", path: "/courses", icon: GraduationCap },
  { name: "Library", path: "/library", icon: Library },
  { name: "Messages", path: "/messages", icon: Notebook },
  { name: "Instructors", path: "/instructors", icon: Info },
  { name: "Reports", path: "/reports", icon: BarChart3 },
  { name: "Settings", path: "/settings", icon: SettingsIcon },
]

// Paths for primary navigation (shown in mobile bottom bar)
const primaryNavPaths = ["/", "/my-class", "/courses", "/library"]

// Get primary navigation items (for mobile bottom bar)
export function getPrimaryNav(): NavigationItem[] {
  return navigationItems.filter((item) => primaryNavPaths.includes(item.path))
}

// Get overflow navigation items (shown in mobile "More" drawer)
export function getOverflowNav(): NavigationItem[] {
  return navigationItems.filter((item) => !primaryNavPaths.includes(item.path))
}
