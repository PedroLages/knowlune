import { type ReactNode } from 'react'
import { GraduationCap, Search, Bell, Sun, ChevronDown, Menu } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar'
import { navigationItems } from '@/app/config/navigation'

interface PageLayoutProps {
  children: ReactNode
  activePath?: string
  /** Hide sidebar for stacked layouts like Lesson Player */
  hideSidebar?: boolean
  /** Show bottom nav for mobile stories */
  showBottomNav?: boolean
}

function Sidebar({ activePath = '/' }: { activePath: string }) {
  return (
    <aside
      className="w-[220px] shrink-0 bg-card rounded-[24px] m-6 p-6 flex flex-col"
      aria-label="Sidebar"
    >
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl">Eduvi</span>
      </div>
      <nav className="flex-1" aria-label="Main navigation">
        <ul className="space-y-2">
          {navigationItems.map(item => {
            const isActive = item.path === activePath
            const Icon = item.icon
            return (
              <li key={item.path}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </nav>
      {/* Progress Widget */}
      <div className="mt-auto bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
        <svg width={100} height={100} className="mx-auto transform -rotate-90 mb-2">
          <circle
            cx={50}
            cy={50}
            r={42}
            fill="none"
            stroke="currentColor"
            strokeWidth={7}
            className="text-muted/20"
          />
          <circle
            cx={50}
            cy={50}
            r={42}
            fill="none"
            stroke="currentColor"
            strokeWidth={7}
            strokeDasharray={264}
            strokeDashoffset={264 * 0.62}
            strokeLinecap="round"
            className="text-blue-600"
          />
          <text
            x={50}
            y={50}
            textAnchor="middle"
            dy="0.3em"
            className="fill-current text-lg font-bold transform rotate-90"
            style={{ transformOrigin: 'center' }}
          >
            38%
          </text>
        </svg>
        <p className="text-sm font-semibold">3/8 courses</p>
        <p className="text-xs text-muted-foreground mt-1">142 lessons done</p>
      </div>
    </aside>
  )
}

function Header({ showHamburger }: { showHamburger?: boolean }) {
  return (
    <header className="bg-card rounded-[24px] m-6 mb-0 p-4 px-6 flex items-center gap-4 justify-between">
      {showHamburger && (
        <button className="p-2 rounded-lg hover:bg-accent" aria-label="Open menu">
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
      )}
      <button className="flex items-center w-80 pl-10 pr-4 py-2 bg-muted rounded-md text-sm text-muted-foreground hover:bg-accent text-left relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <span>Search...</span>
        <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </button>
      <div className="flex items-center gap-4">
        <button className="p-2 rounded-lg hover:bg-accent" aria-label="Toggle theme">
          <Sun className="w-5 h-5 text-muted-foreground" />
        </button>
        <button className="relative p-2 rounded-lg hover:bg-accent" aria-label="Notifications">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <Avatar className="w-10 h-10">
            <AvatarFallback>P</AvatarFallback>
          </Avatar>
          <div className="text-left">
            <div className="font-semibold text-sm">Pedro</div>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  )
}

export function PageLayout({
  children,
  activePath = '/',
  hideSidebar,
  showBottomNav,
}: PageLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      {!hideSidebar && <Sidebar activePath={activePath} />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header showHamburger={hideSidebar} />
        <main className={`flex-1 overflow-auto p-6 ${showBottomNav ? 'pb-20' : ''}`}>
          {children}
        </main>
      </div>
      {showBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around py-2">
          {['Home', 'Courses', 'Notes', 'Reports', 'Profile'].map((n, i) => (
            <button
              key={n}
              className={`flex flex-col items-center gap-1 px-3 py-1 text-xs ${i === 0 ? 'text-blue-600' : 'text-muted-foreground'}`}
            >
              <div className={`w-5 h-5 rounded ${i === 0 ? 'bg-blue-600' : 'bg-muted'}`} />
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
