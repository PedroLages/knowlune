import { useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router'
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Menu,
  Settings,
  LogIn,
  LogOut,
  User,
  MessageSquarePlus,
} from 'lucide-react'
import { KnowluneLogo, KnowluneIcon } from './figma/KnowluneLogo'
import { Button } from './ui/button'
import { Kbd } from './ui/kbd'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { useTheme } from 'next-themes'
import { SearchCommandPalette } from './figma/SearchCommandPalette'
import { PaletteControllerProvider } from './figma/PaletteControllerContext'
import type { EntityType } from '@/lib/unifiedSearch'
import { KeyboardShortcutsDialog } from './figma/KeyboardShortcutsDialog'
import { FeedbackModal } from './figma/FeedbackModal'
import { BottomNav } from './navigation/BottomNav'
import { useStudyReminders } from '@/app/hooks/useStudyReminders'
import { useCourseReminders } from '@/app/hooks/useCourseReminders'
import { useIsMobile, useIsTablet, useIsDesktop } from '@/app/hooks/useMediaQuery'
import { Sheet, SheetContent, SheetTitle } from './ui/sheet'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { navigationGroups, settingsItem, getIsActive } from '@/app/config/navigation'
import type { NavigationItem, NavigationGroup } from '@/app/config/navigation'
import { useProgressiveDisclosure } from '@/app/hooks/useProgressiveDisclosure'
import { getSettings } from '@/lib/settings'
import { getInitials } from '@/lib/textUtils'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { NotificationCenter } from './figma/NotificationCenter'
import { SyncStatusIndicator } from './sync/SyncStatusIndicator'
import { useCourseStore } from '@/stores/useCourseStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from 'sonner'
import { QualityScoreDialog } from './session/QualityScoreDialog'
import type { QualityScoreResult } from '@/lib/qualityScore'
import { OnboardingOverlay } from './onboarding/OnboardingOverlay'
import { useFocusMode } from '@/hooks/useFocusMode'
import { FocusOverlay } from './figma/FocusOverlay'
import { TrialIndicator } from './trial/TrialIndicator'
import { TrialReminderBanner } from './trial/TrialReminderBanner'
import { ImportProgressOverlay } from './figma/ImportProgressOverlay'
import { SessionExpiredBanner } from './figma/SessionExpiredBanner'
import { AudioMiniPlayer } from './audiobook/AudioMiniPlayer'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'

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
  const isActive = getIsActive(item, location.pathname, location.search)
  const Icon = item.icon

  const link = (
    <Link
      to={item.tab ? `${item.path}?tab=${item.tab}` : item.path}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center rounded-xl transition-colors duration-150 min-h-[44px] ${
        iconOnly ? 'justify-center py-2.5 mx-2' : 'gap-3 px-4 py-2.5'
      } ${
        isActive
          ? 'bg-brand-soft text-brand-soft-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <Icon className={`size-5 shrink-0 ${isActive ? 'stroke-[2.5px]' : ''}`} aria-hidden="true" />
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
            isActive ? 'bg-brand' : 'bg-transparent'
          }`}
        />
      )}
      {link}
    </li>
  )
}

// Reusable sidebar content component
function SidebarContent({
  onNavigate,
  iconOnly,
  visibleGroups,
  onFeedbackClick,
}: {
  onNavigate?: () => void
  iconOnly?: boolean
  visibleGroups: NavigationGroup[]
  onFeedbackClick?: () => void
}) {
  return (
    <>
      {/* Logo + tagline */}
      <div className={iconOnly ? 'mb-6 flex justify-center' : 'mb-6'}>
        {iconOnly ? (
          <KnowluneIcon className="size-7" />
        ) : (
          <div>
            <KnowluneLogo />
            <p className="mt-1 text-[10px] tracking-wide text-muted-foreground">
              Illuminate Your Path
            </p>
          </div>
        )}
      </div>

      {/* Grouped Navigation */}
      {/* 2px scrollbar — narrower than global 6px */}
      <nav
        className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-0.5"
        aria-label="Main navigation"
      >
        <div className="space-y-5">
          {visibleGroups.map((group, idx) => (
            <div key={group.label}>
              {/* Group label — hidden in collapsed mode, replaced by separator */}
              {iconOnly ? (
                idx > 0 && (
                  <div
                    className="mx-4 mb-2 border-t border-border/50"
                    aria-hidden="true"
                    data-testid="group-separator"
                  />
                )
              ) : (
                <div
                  id={`nav-group-${group.label.toLowerCase()}`}
                  className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  {group.label}
                </div>
              )}
              <ul
                className="space-y-0.5"
                aria-labelledby={!iconOnly ? `nav-group-${group.label.toLowerCase()}` : undefined}
              >
                {group.items.map(item => (
                  <NavLink
                    key={item.tab ? `${item.path}?tab=${item.tab}` : item.path}
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

      {/* Bottom section: Feedback + Settings */}
      <div className="mt-4 pt-3 border-t border-border">
        {/* Feedback trigger — above Settings */}
        {iconOnly ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onFeedbackClick}
                aria-label="Send Feedback"
                className="flex items-center justify-center rounded-xl transition-colors duration-150 min-h-[44px] py-2.5 mx-2 w-[calc(100%-1rem)] text-muted-foreground hover:bg-accent hover:text-foreground"
                data-testid="feedback-trigger"
              >
                <MessageSquarePlus className="size-5 shrink-0" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Send Feedback
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onFeedbackClick}
            aria-label="Send Feedback"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors duration-150 min-h-[44px] w-full text-muted-foreground hover:bg-accent hover:text-foreground"
            data-testid="feedback-trigger"
          >
            <MessageSquarePlus className="size-5 shrink-0" aria-hidden="true" />
            <span className="text-sm">Send Feedback</span>
          </button>
        )}
        <ul>
          <NavLink item={settingsItem} iconOnly={iconOnly} onNavigate={onNavigate} />
        </ul>
      </div>
    </>
  )
}

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const isDesktop = useIsDesktop()

  useStudyReminders()
  useCourseReminders()

  // Progressive sidebar disclosure
  const { filterGroups } = useProgressiveDisclosure()
  const visibleGroups = filterGroups(navigationGroups)

  // Ensure courses are loaded from IndexedDB (backup for deferInit race)
  const loadCourses = useCourseStore(s => s.loadCourses)
  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  const signOut = useAuthStore(s => s.signOut)
  const authUser = useAuthStore(s => s.user)
  const sessionExpired = useAuthStore(s => s.sessionExpired)

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
  const [paletteInitialScope, setPaletteInitialScope] = useState<EntityType | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
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
    try {
      // Migrate from legacy eduvi key (one-time)
      const legacy = localStorage.getItem('eduvi-sidebar-v1')
      if (legacy !== null) {
        localStorage.setItem('knowlune-sidebar-v1', legacy)
        localStorage.removeItem('eduvi-sidebar-v1')
        const parsed = JSON.parse(legacy)
        if (typeof parsed !== 'boolean') {
          localStorage.removeItem('knowlune-sidebar-v1')
          return true
        }
        return parsed
      }
      const saved = localStorage.getItem('knowlune-sidebar-v1')
      if (saved !== null) {
        const parsed = JSON.parse(saved)
        if (typeof parsed !== 'boolean') {
          localStorage.removeItem('knowlune-sidebar-v1')
          return true
        }
        return parsed
      }
      return true
    } catch {
      // silent-catch-ok: corrupted localStorage, reset and use default
      console.warn('Corrupted sidebar state in localStorage, resetting to default')
      localStorage.removeItem('eduvi-sidebar-v1')
      localStorage.removeItem('knowlune-sidebar-v1')
      return true
    }
  })

  // Desktop sidebar collapsed state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const legacy = localStorage.getItem('eduvi-sidebar-collapsed-v1')
      if (legacy !== null) {
        localStorage.setItem('knowlune-sidebar-collapsed-v1', legacy)
        localStorage.removeItem('eduvi-sidebar-collapsed-v1')
        const parsed = JSON.parse(legacy)
        if (typeof parsed !== 'boolean') {
          localStorage.removeItem('knowlune-sidebar-collapsed-v1')
          return false
        }
        return parsed
      }
      const saved = localStorage.getItem('knowlune-sidebar-collapsed-v1')
      if (saved !== null) {
        const parsed = JSON.parse(saved)
        if (typeof parsed !== 'boolean') {
          localStorage.removeItem('knowlune-sidebar-collapsed-v1')
          return false
        }
        return parsed
      }
      return false
    } catch {
      // silent-catch-ok: corrupted localStorage, reset and use default
      console.warn('Corrupted sidebar collapsed state in localStorage, resetting to default')
      localStorage.removeItem('eduvi-sidebar-collapsed-v1')
      localStorage.removeItem('knowlune-sidebar-collapsed-v1')
      return false
    }
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
    localStorage.setItem('knowlune-sidebar-v1', JSON.stringify(sidebarOpen))
  }, [sidebarOpen])

  useEffect(() => {
    localStorage.setItem('knowlune-sidebar-collapsed-v1', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Reading mode: global keyboard shortcut for non-lesson pages shows info toast (E65-S01)
  useEffect(() => {
    const isLessonRoute = /\/courses\/[^/]+\/lessons\/[^/]+$/.test(location.pathname)
    if (isLessonRoute) return // Handled by useReadingMode in UnifiedLessonPlayer

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        toast.info('Reading mode is available on lesson pages')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [location.pathname])

  const isLessonPlayerRoute = /\/courses\/[^/]+\/lessons\/[^/]+$/.test(location.pathname)

  // Show mini-player padding when audiobook is active and not on the player page (E87-S05)
  const audiobookCurrentBookId = useAudioPlayerStore(s => s.currentBookId)
  const isAudiobookPlayerPage = audiobookCurrentBookId
    ? location.pathname.includes(`/library/${audiobookCurrentBookId}/read`)
    : false
  const hasMiniPlayer = !!audiobookCurrentBookId && !isAudiobookPlayerPage

  // Focus mode (E65-S03) — overlay, focus trap, and exit
  const focusMode = useFocusMode(navigate)

  // Quality score dialog state (E11-S03)
  const [qualityDialogOpen, setQualityDialogOpen] = useState(false)
  const [qualityResult, setQualityResult] = useState<QualityScoreResult | null>(null)

  useEffect(() => {
    const handleQualityScore = (e: Event) => {
      // Check user preference before showing the popup
      try {
        const raw = localStorage.getItem('pomodoro-preferences')
        if (raw) {
          const prefs = JSON.parse(raw)
          if (prefs.showQualityScore === false) return
        }
      } catch {
        // silent-catch-ok: localStorage read for UI preference, use default (show)
      }

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
    <div className="flex h-screen overflow-hidden bg-background grain-overlay">
      {/* Skip to content link for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-foreground focus:ring-2 focus:ring-brand-foreground focus:ring-offset-2 focus:ring-offset-background"
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
            <SidebarContent
              iconOnly={sidebarCollapsed}
              visibleGroups={visibleGroups}
              onFeedbackClick={() => setFeedbackOpen(true)}
            />
          </aside>

          {/* Edge notch toggle */}
          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-keyshortcuts="Meta+B Control+B"
            className={`absolute top-1/2 -translate-y-1/2 -right-5 z-50 flex items-center justify-center size-11 rounded-full bg-card border border-border shadow-sm text-muted-foreground hover:text-foreground hover:scale-110 focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none transition-all duration-150 cursor-pointer ${
              sidebarHovered || !sidebarCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-3" aria-hidden="true" />
            ) : (
              <ChevronLeft className="size-3" aria-hidden="true" />
            )}
          </button>
        </div>
      )}

      {/* Tablet Sidebar - Collapsible Sheet on tablet (640-1023px) */}
      {isTablet && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-6 flex flex-col" aria-label="Sidebar">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent
              onNavigate={() => setSidebarOpen(false)}
              visibleGroups={visibleGroups}
              onFeedbackClick={() => setFeedbackOpen(true)}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${isLessonPlayerRoute ? 'overflow-auto' : 'overflow-hidden'}`}
      >
        {/* Header */}
        <header
          data-theater-hide
          className="bg-card m-6 mb-0 p-4 px-6 flex items-center gap-4 justify-between relative z-10"
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
              <Menu className="size-5 text-muted-foreground" aria-hidden="true" />
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
              <Search className="size-5 text-muted-foreground" aria-hidden="true" />
            </Button>

            {/* Tablet/Desktop: Full search bar */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center w-full h-11 pl-10 pr-4 bg-muted rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors duration-150 text-left cursor-pointer"
              aria-label="Open search (Cmd+K)"
              aria-keyshortcuts="Meta+K Control+K"
            >
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
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
            <TrialIndicator />
            <SyncStatusIndicator />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="min-h-[44px] min-w-[44px]"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <Sun className="size-5 text-muted-foreground dark:hidden" aria-hidden="true" />
              <Moon className="size-5 text-muted-foreground hidden dark:block" aria-hidden="true" />
            </Button>

            <NotificationCenter />

            {authUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-3 pl-4 border-l border-border cursor-pointer rounded-lg p-1 -m-1 min-h-[44px] transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="User menu"
                  >
                    <div className="relative">
                      <Avatar className="size-10 ring-2 ring-transparent transition-all duration-200 hover:ring-brand/30 hover:shadow-md">
                        <AvatarImage
                          src={settings.profilePhotoUrl || undefined}
                          alt={settings.displayName}
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <AvatarFallback className="bg-brand-soft text-brand-soft-foreground font-semibold transition-colors duration-200 hover:bg-brand hover:text-white">
                          {getInitials(settings.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      {/* E43-S04: Warning dot when session expired (visible even after banner dismiss) */}
                      {sessionExpired && (
                        <span
                          className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning border-2 border-card"
                          aria-label="Session expired"
                          role="status"
                        />
                      )}
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="font-semibold text-sm">{settings.displayName}</div>
                    </div>
                    <ChevronDown
                      className="size-4 text-muted-foreground hidden sm:block"
                      aria-hidden="true"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-sm">{settings.displayName}</span>
                      {authUser?.email && (
                        <span className="text-xs text-muted-foreground font-normal truncate">
                          {authUser.email}
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => navigate('/settings')}>
                      <User className="mr-2 size-4" aria-hidden="true" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => navigate('/settings')}>
                      <Settings className="mr-2 size-4" aria-hidden="true" />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={async () => {
                      const result = await signOut()
                      if (result.error) {
                        toast.error(result.error)
                      }
                    }}
                  >
                    <LogOut className="mr-2 size-4" aria-hidden="true" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="brand"
                className="min-h-[44px] gap-2"
                onClick={() => navigate('/login')}
                aria-label="Sign in to your account"
              >
                <LogIn className="size-4" aria-hidden="true" />
                Sign In
              </Button>
            )}
          </div>
        </header>

        {/* Page Content - Extra bottom padding on mobile for bottom nav */}
        <main
          id="main-content"
          data-testid="main-scroll-container"
          className={`flex-1 px-6 pt-6 leading-[var(--content-line-height)] ${isLessonPlayerRoute ? 'pb-6' : `overflow-auto ${hasMiniPlayer ? 'pb-36 sm:pb-20' : 'pb-20 sm:pb-6'}`}`}
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
          <SessionExpiredBanner isOffline={!isOnline} />
          <TrialReminderBanner />
          <PaletteControllerProvider
            value={{
              open: (scope?: EntityType) => {
                setPaletteInitialScope(scope ?? null)
                setSearchOpen(true)
              },
            }}
          >
            <Outlet />
          </PaletteControllerProvider>
        </main>
      </div>

      {/* Search Command Palette */}
      <SearchCommandPalette
        open={searchOpen}
        onOpenChange={newOpen => {
          setSearchOpen(newOpen)
          if (!newOpen) setPaletteInitialScope(null)
        }}
        initialScope={paletteInitialScope}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* Feedback / Bug Report Modal (E118) */}
      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        onSuccess={() => {
          // toast fires after modal closes (plan critic: parent ownership)
          setFeedbackOpen(false)
          toast.success('Thanks — your feedback was sent.')
        }}
      />

      {/* Mobile Bottom Navigation - Only visible on mobile (<640px) */}
      {isMobile && (
        <div data-theater-hide>
          <BottomNav onFeedbackClick={() => setFeedbackOpen(true)} />
        </div>
      )}

      {/* Quality Score Dialog (E11-S03) */}
      {qualityResult && (
        <QualityScoreDialog
          open={qualityDialogOpen}
          onOpenChange={setQualityDialogOpen}
          score={qualityResult.score}
          factors={qualityResult.factors}
        />
      )}

      {/* First-use onboarding overlay (E25-S07) */}
      <OnboardingOverlay />

      {/* Import progress indicator (E1B-S03) — non-blocking overlay */}
      <ImportProgressOverlay />

      {/* Focus mode overlay (E65-S03) */}
      <FocusOverlay
        isFocusMode={focusMode.isFocusMode}
        isMobile={focusMode.isMobile}
        shouldReduceMotion={focusMode.shouldReduceMotion}
        showExitConfirmation={focusMode.showExitConfirmation}
        announcement={focusMode.announcement}
        onOverlayClick={focusMode.requestExit}
        onCloseClick={focusMode.requestExit}
        onConfirmExit={focusMode.confirmExit}
        onCancelExit={focusMode.cancelExitConfirmation}
        getPortalContainer={focusMode.getPortalContainer}
      />

      {/* Audiobook Mini-Player — persistent bar across all pages when audiobook is active (E87-S05) */}
      <AudioMiniPlayer />
    </div>
  )
}
