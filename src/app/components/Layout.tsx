import { useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router'
import { Search, Bell, ChevronDown, ChevronLeft, ChevronRight, Sun, Moon, Menu } from 'lucide-react'
import { LevelUpLogo } from './figma/LevelUpLogo'
import { Button } from './ui/button'
import { Kbd } from './ui/kbd'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { useTheme } from 'next-themes'
import { SearchCommandPalette } from './figma/SearchCommandPalette'
import { KeyboardShortcutsDialog } from './figma/KeyboardShortcutsDialog'
import { BottomNav } from './navigation/BottomNav'
import { useStudyReminders } from '@/app/hooks/useStudyReminders'
import { useCourseReminders } from '@/app/hooks/useCourseReminders'
import { useIsMobile, useIsTablet, useIsDesktop } from '@/app/hooks/useMediaQuery'
import { Sheet, SheetContent } from './ui/sheet'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { navigationGroups, settingsItem } from '@/app/config/navigation'
import type { NavigationItem } from '@/app/config/navigation'
import { getSettings } from '@/lib/settings'
import { getInitials } from '@/lib/avatarUpload'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { useCourseStore } from '@/stores/useCourseStore'
import { toast } from 'sonner'
import { QualityScoreDialog } from './session/QualityScoreDialog'
import type { QualityScoreResult } from '@/lib/qualityScore'

// Individual nav link — wraps in Tooltip when collapsed
function NavLink({
  item,
  iconOnly,
  onNavigate,
}: {
  item: NavigationItem
  iconOnly?: boolean
  onNavigate?: () => void
}) {
  const location = useLocation()
  const isActive =
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  const Icon = item.icon

  const link = (
    <Link
      to={item.path}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center rounded-xl transition-colors duration-150 ${
        iconOnly ? 'justify-center py-2.5 mx-2' : 'gap-3 px-4 py-2.5'
      } ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.5px]' : ''}`} aria-hidden="true" />
      {!iconOnly && <span className="text-sm">{item.name}</span>}
    </Link>
  )

  if (iconOnly) {
    return (
      <li className="relative">
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.name}
          </TooltipContent>
        </Tooltip>
      </li>
    )
  }

  return (
    <li className="relative">
      {!iconOnly && (
        <span
          aria-hidden="true"
          className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full transition-all duration-200 ${
            isActive ? 'bg-blue-600 dark:bg-blue-400' : 'bg-transparent'
          }`}
        />
      )}
      {link}
    </li>
  )
}

// Reusable sidebar content component
function SidebarContent({ onNavigate, iconOnly }: { onNavigate?: () => void; iconOnly?: boolean }) {
  return (
    <>
      {/* Logo */}
      <div className={iconOnly ? 'mb-6 flex justify-center' : 'mb-6'}>
        {iconOnly ? (
          <svg
            viewBox="0 0 40 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-7 h-7"
            aria-label="LevelUp"
          >
            <text
              x="0"
              y="36"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize="34"
              fontWeight="900"
              fill="currentColor"
              letterSpacing="-1"
            >
              U
            </text>
            <text
              x="24"
              y="36"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize="34"
              fontWeight="900"
              fill="currentColor"
              letterSpacing="-1"
            >
              p
            </text>
            <polygon points="18,31 24,18 30,31" className="fill-background" />
            <rect x="22.5" y="30" width="3" height="10" className="fill-background" />
          </svg>
        ) : (
          <LevelUpLogo />
        )}
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 overflow-y-auto" aria-label="Main navigation">
        <div className="space-y-5">
          {navigationGroups.map((group, idx) => (
            <div key={group.label}>
              {/* Group label — hidden in collapsed mode, replaced by separator */}
              {iconOnly ? (
                idx > 0 && (
                  <div className="mx-4 mb-2 border-t border-border/50" aria-hidden="true" />
                )
              ) : (
                <div className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map(item => (
                  <NavLink
                    key={item.path}
                    item={item}
                    iconOnly={iconOnly}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom section: Settings */}
      <div className="mt-4 pt-3 border-t border-border">
        <ul>
          <NavLink item={settingsItem} iconOnly={iconOnly} onNavigate={onNavigate} />
        </ul>
      </div>
    </>
  )
}

export function Layout() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const isDesktop = useIsDesktop()

  useStudyReminders()
  useCourseReminders()

  // Ensure courses are loaded from IndexedDB (backup for deferInit race)
  const loadCourses = useCourseStore(s => s.loadCourses)
  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  const isOnline = useOnlineStatus()
  const isInitialRender = useRef(true)

  // Toast on connectivity changes (skip initial render)
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }
    if (isOnline) {
      toast.success('Back online', { duration: 3000 })
    } else {
      toast.warning('You are offline', { duration: 5000 })
    }
  }, [isOnline])

  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [settings, setSettings] = useState(getSettings())

  // Sync settings when storage changes (e.g., updated in Settings page)
  useEffect(() => {
    const handleStorageChange = () => {
      setSettings(getSettings())
    }
    window.addEventListener('storage', handleStorageChange)
    // Also listen for custom event from same tab
    window.addEventListener('settingsUpdated', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('settingsUpdated', handleStorageChange)
    }
  }, [])

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

  const [sidebarHovered, setSidebarHovered] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev: boolean) => !prev)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
        return
      }

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
    [navigate, toggleSidebar]
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

  // Quality score dialog state (E11-S03)
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false)
  const [qualityResult, setQualityResult] = useState<QualityScoreResult | null>(null)

  useEffect(() => {
    const handleQualityScore = (e: Event) => {
      const detail = (e as CustomEvent<QualityScoreResult>).detail
      if (detail && typeof detail.score === 'number') {
        setQualityResult(detail)
        setQualityDialogOpen(true)
      }
    }
    window.addEventListener('session-quality-calculated', handleQualityScore)
    return () => window.removeEventListener('session-quality-calculated', handleQualityScore)
  }, [])

  return (
    <div className="flex h-screen bg-background grain-overlay">
      {/* Skip to content link for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-foreground focus:outline-none"
      >
        Skip to content
      </a>

      {/* Desktop Sidebar - Persistent on desktop (≥1024px), collapsible by user */}
      {isDesktop && (
        <div
          data-theater-hide
          className="relative mt-6 mb-6 ml-6"
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          {/* Sidebar */}
          <aside
            className={`${sidebarCollapsed ? 'w-[72px] px-0 py-6' : 'w-[220px] p-6'} bg-card flex flex-col overflow-hidden transition-[width] duration-200 ease-out h-full`}
            aria-label="Sidebar"
          >
            <SidebarContent iconOnly={sidebarCollapsed} />
          </aside>

          {/* Edge notch toggle */}
          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-keyshortcuts="Meta+B Control+B"
            className={`absolute top-1/2 -translate-y-1/2 -right-3 z-50 flex items-center justify-center w-6 h-6 rounded-full bg-card border border-border shadow-sm text-muted-foreground hover:text-foreground hover:scale-110 transition-all duration-150 cursor-pointer ${
              sidebarHovered || !sidebarCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
            ) : (
              <ChevronLeft className="w-3 h-3" aria-hidden="true" />
            )}
          </button>
        </div>
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
              <Avatar className="w-10 h-10 ring-2 ring-transparent transition-all duration-200 hover:ring-brand/30 hover:shadow-md">
                {settings.profilePhotoDataUrl ? (
                  <AvatarImage
                    src={settings.profilePhotoDataUrl}
                    alt={settings.displayName}
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-brand-soft text-brand font-semibold transition-colors duration-200 hover:bg-brand hover:text-white">
                    {getInitials(settings.displayName)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="text-left hidden sm:block">
                <div className="font-semibold text-sm">{settings.displayName}</div>
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
          {!isOnline && (
            <div
              role="status"
              aria-live="polite"
              className="bg-warning/10 text-warning-foreground border-b border-warning/20 px-4 py-2 text-center text-sm -mx-6 -mt-6 mb-4"
            >
              You are offline. Some features may be limited.
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Search Command Palette */}
      <SearchCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* Mobile Bottom Navigation - Only visible on mobile (<640px) */}
      {isMobile && <BottomNav />}

      {/* Quality Score Dialog (E11-S03) */}
      {qualityResult && (
        <QualityScoreDialog
          open={qualityDialogOpen}
          onOpenChange={setQualityDialogOpen}
          score={qualityResult.score}
          factors={qualityResult.factors}
        />
      )}
    </div>
  )
}
