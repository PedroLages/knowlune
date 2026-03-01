import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router'
import { Search, Bell, ChevronDown, ChevronLeft, ChevronRight, Sun, Moon, Menu } from 'lucide-react'
import { LevelUpLogo } from './figma/LevelUpLogo'
import { Button } from './ui/button'
import { Kbd } from './ui/kbd'
import { Avatar, AvatarFallback } from './ui/avatar'
import { useTheme } from 'next-themes'
import { SearchCommandPalette } from './figma/SearchCommandPalette'
import { KeyboardShortcutsDialog } from './figma/KeyboardShortcutsDialog'
import { BottomNav } from './navigation/BottomNav'
import { ProgressWidget } from './ProgressWidget'
import { useIsMobile, useIsTablet, useIsDesktop } from '@/app/hooks/useMediaQuery'
import { Sheet, SheetContent } from './ui/sheet'
import { navigationItems } from '@/app/config/navigation'

// Reusable sidebar content component
function SidebarContent({
  onNavigate,
  iconOnly,
  onToggleCollapse,
}: {
  onNavigate?: () => void
  iconOnly?: boolean
  onToggleCollapse?: () => void
}) {
  const location = useLocation()

  return (
    <>
      {/* Logo */}
      <div className={iconOnly ? 'mb-8 flex justify-center' : 'mb-8'}>
        {iconOnly ? (
          <svg
            viewBox="0 0 60 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8"
            aria-label="LevelUp"
          >
            <rect x="0" y="40" width="60" height="20" fill="currentColor" />
            <rect x="24" y="22" width="36" height="18" fill="currentColor" />
            <rect x="34" y="6" width="12" height="16" fill="currentColor" />
            <polygon points="40,0 22,6 58,6" fill="currentColor" />
          </svg>
        ) : (
          <LevelUpLogo />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1" aria-label="Main navigation">
        <ul className="space-y-2">
          {navigationItems.map(item => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)
            const Icon = item.icon

            return (
              <li key={item.path} className="relative">
                {!iconOnly && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full transition-all duration-200 ${
                      isActive ? 'bg-blue-600 dark:bg-blue-400' : 'bg-transparent'
                    }`}
                  />
                )}
                <Link
                  to={item.path}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  title={iconOnly ? item.name : undefined}
                  className={`flex items-center rounded-xl transition-colors duration-150 ${
                    iconOnly ? 'justify-center py-3 mx-2' : 'gap-3 px-4 py-3'
                  } ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`}
                    aria-hidden="true"
                  />
                  {!iconOnly && <span className="text-sm">{item.name}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Progress Widget — hidden in icon-only mode */}
      {!iconOnly && <ProgressWidget />}

      {/* Collapse toggle button */}
      {onToggleCollapse && (
        <div
          className={`mt-4 pt-4 border-t border-border ${iconOnly ? 'flex justify-center' : 'flex justify-end'}`}
        >
          <button
            onClick={onToggleCollapse}
            title={iconOnly ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={iconOnly ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-150"
          >
            {iconOnly ? (
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </>
  )
}

export function Layout() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const isDesktop = useIsDesktop()

  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Tablet sidebar sheet state with localStorage persistence
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('eduvi-sidebar-v1')
    return saved !== null ? JSON.parse(saved) : true
  })

  // Desktop sidebar collapsed state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('eduvi-sidebar-collapsed-v1')
    return saved !== null ? JSON.parse(saved) : false
  })

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
        return
      }

      if (isMod && e.key === ',') {
        e.preventDefault()
        navigate('/settings')
        return
      }

      if (e.key === '?' && !isMod) {
        const target = e.target as HTMLElement
        const tagName = target.tagName.toLowerCase()
        const isEditable = tagName === 'input' || tagName === 'textarea' || target.isContentEditable
        if (!isEditable) {
          e.preventDefault()
          setShortcutsOpen(true)
        }
      }
    },
    [navigate]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Persist sidebar states to localStorage
  useEffect(() => {
    localStorage.setItem('eduvi-sidebar-v1', JSON.stringify(sidebarOpen))
  }, [sidebarOpen])

  useEffect(() => {
    localStorage.setItem('eduvi-sidebar-collapsed-v1', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  return (
    <div className="flex h-screen bg-background">
      {/* Skip to content link for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-foreground focus:outline-none"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar - Persistent on desktop (≥1024px), collapsible by user */}
      {isDesktop && (
        <aside
          data-theater-hide
          className={`${sidebarCollapsed ? 'w-[72px] px-0 py-6' : 'w-[220px] p-6'} bg-card mt-6 mb-6 ml-6 flex flex-col overflow-hidden transition-[width] duration-200`}
          aria-label="Sidebar"
        >
          <SidebarContent
            iconOnly={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev: boolean) => !prev)}
          />
        </aside>
      )}

      {/* Tablet Sidebar - Collapsible Sheet on tablet (640-1023px) */}
      {isTablet && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-6 flex flex-col" aria-label="Sidebar">
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header
          className="bg-card m-6 mb-0 p-4 px-6 flex items-center gap-4 justify-between"
          role="banner"
        >
          {/* Hamburger Menu Button - Only on tablet (640-1023px) */}
          {isTablet && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="min-h-[44px] min-w-[44px]"
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            </Button>
          )}

          {/* Search trigger - Responsive */}
          <div
            className="relative flex-1 max-w-md sm:flex-none sm:w-96 lg:w-80"
            role="search"
            aria-label="Site search"
          >
            {/* Mobile: Icon-only button */}
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => setSearchOpen(true)}
              className="sm:hidden min-h-[44px] min-w-[44px]"
              aria-label="Open search (Cmd+K)"
              aria-keyshortcuts="Meta+K Control+K"
            >
              <Search className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            </Button>

            {/* Tablet/Desktop: Full search bar */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center w-full pl-10 pr-4 py-2 bg-muted rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors duration-150 text-left cursor-pointer"
              aria-label="Open search (Cmd+K)"
              aria-keyshortcuts="Meta+K Control+K"
            >
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
                aria-hidden="true"
              />
              <span>Search...</span>
              <Kbd className="ml-auto hidden sm:inline-flex">
                <span className="text-xs">&#8984;</span>K
              </Kbd>
            </button>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="min-h-[44px] min-w-[44px]"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <Sun className="w-5 h-5 text-muted-foreground dark:hidden" aria-hidden="true" />
              <Moon
                className="w-5 h-5 text-muted-foreground hidden dark:block"
                aria-hidden="true"
              />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="relative min-h-[44px] min-w-[44px]"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            </Button>

            <div
              className="flex items-center gap-3 pl-4 border-l border-border"
              role="group"
              aria-label="User profile"
            >
              <Avatar className="w-10 h-10">
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <div className="font-semibold text-sm">Student</div>
              </div>
              <ChevronDown
                className="w-4 h-4 text-muted-foreground hidden sm:block"
                aria-hidden="true"
              />
            </div>
          </div>
        </header>

        {/* Page Content - Extra bottom padding on mobile for bottom nav */}
        <main
          id="main-content"
          data-testid="main-scroll-container"
          className="flex-1 overflow-auto p-6 pt-6 pb-20 sm:pb-6"
        >
          <Outlet />
        </main>
      </div>

      {/* Search Command Palette */}
      <SearchCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* Mobile Bottom Navigation - Only visible on mobile (<640px) */}
      {isMobile && <BottomNav />}
    </div>
  )
}
