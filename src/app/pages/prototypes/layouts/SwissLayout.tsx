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
  type LucideIcon,
} from 'lucide-react'

const SWISS_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"
const ACCENT = '#DC2626' // red-600

interface NavItem {
  name: string
  icon: LucideIcon
  path: string
}

const navItems: NavItem[] = [
  { name: 'Overview', icon: LayoutDashboard, path: '/prototypes/swiss-overview' },
  { name: 'My Classes', icon: BookOpen, path: '#' },
  { name: 'Courses', icon: GraduationCap, path: '/prototypes/swiss-courses' },
  { name: 'Library', icon: Library, path: '#' },
  { name: 'Messages', icon: Notebook, path: '#' },
  { name: 'Instructors', icon: Info, path: '#' },
  { name: 'Reports', icon: BarChart3, path: '#' },
  { name: 'Settings', icon: Settings, path: '#' },
]

export function SwissLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  return (
    <div
      className="flex h-screen light"
      style={{ fontFamily: SWISS_FONT, colorScheme: 'light', background: '#FAFAFA' }}
    >
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 border-r border-black/10 flex flex-col bg-white">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-black/10">
          <Link to="/prototypes/swiss-overview" className="flex items-center gap-2">
            <svg viewBox="0 0 60 60" className="w-6 h-6 text-black" fill="currentColor">
              <rect x="0" y="40" width="60" height="20" />
              <rect x="24" y="22" width="36" height="18" />
              <rect x="34" y="6" width="12" height="16" />
              <polygon points="40,0 48,6 32,6" />
            </svg>
            <span className="text-sm font-bold uppercase tracking-[0.15em]">Knowlune</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navItems.map(item => {
            const isActive = pathname === item.path
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  flex items-center gap-3 px-6 py-2.5 text-sm transition-colors relative
                  ${isActive ? 'font-bold text-black' : 'text-neutral-500 hover:text-black'}
                `}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5"
                    style={{ background: ACCENT }}
                  />
                )}
                <item.icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 1.5} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/10">
          <Link
            to="/prototypes"
            className="text-xs text-neutral-400 hover:text-black transition-colors"
          >
            &larr; All Prototypes
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-black/10 bg-white flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search..."
              className="text-sm bg-transparent outline-none flex-1 placeholder:text-neutral-400"
              style={{ fontFamily: SWISS_FONT }}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold">
              S
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-8" style={{ background: '#FAFAFA' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
