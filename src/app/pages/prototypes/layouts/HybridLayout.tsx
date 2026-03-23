import { type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Library,
  Notebook,
  Info,
  BarChart3,
  Settings,
  Search,
  Bell,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  name: string
  icon: LucideIcon
  path: string
}

const navItems: NavItem[] = [
  { name: 'Overview', icon: LayoutDashboard, path: '/prototypes/hybrid-overview' },
  { name: 'My Courses', icon: BookOpen, path: '#' },
  { name: 'Courses', icon: GraduationCap, path: '/prototypes/hybrid-courses' },
  { name: 'Library', icon: Library, path: '#' },
  { name: 'Messages', icon: Notebook, path: '#' },
  { name: 'Instructors', icon: Info, path: '#' },
  { name: 'Reports', icon: BarChart3, path: '#' },
  { name: 'Settings', icon: Settings, path: '#' },
]

export function HybridLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen light" style={{ colorScheme: 'light', background: '#FAF5EE' }}>
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col bg-white rounded-xl m-4 mr-0 shadow-xs">
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <Link to="/prototypes/hybrid-overview" className="flex items-center gap-2.5">
            <svg viewBox="0 0 60 60" className="w-7 h-7 text-brand" fill="currentColor">
              <rect x="0" y="40" width="60" height="20" />
              <rect x="24" y="22" width="36" height="18" />
              <rect x="34" y="6" width="12" height="16" />
              <polygon points="40,0 48,6 32,6" />
            </svg>
            <span
              className="text-base font-bold"
              style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            >
              Knowlune
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2">
          {navItems.map(item => {
            const isActive = pathname === item.path
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors relative mb-0.5
                  ${
                    isActive
                      ? 'text-brand font-semibold bg-brand-soft'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                  }
                `}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-brand rounded-r-full" />
                )}
                <item.icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-100">
          <Link
            to="/prototypes"
            className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            &larr; All Prototypes
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 m-4 mb-0 h-14 bg-white rounded-xl shadow-xs flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search..."
              className="text-sm bg-transparent outline-none flex-1 placeholder:text-neutral-400"
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-50 transition-colors">
              <Bell className="w-[18px] h-[18px]" />
            </button>
            <div className="w-px h-6 bg-neutral-100" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center text-xs font-semibold text-brand">
                S
              </div>
              <span className="text-sm font-medium text-neutral-700">Student</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
