import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { MoreHorizontal, MessageSquarePlus } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/app/components/ui/drawer'
import { cn } from '@/app/components/ui/utils'
import {
  getPrimaryNav,
  getOverflowNav,
  getIsActive,
  navigationGroups,
  primaryNavPaths,
  settingsItem,
} from '@/app/config/navigation'
import { useProgressiveDisclosure } from '@/app/hooks/useProgressiveDisclosure'

interface BottomNavProps {
  onFeedbackClick?: () => void
}

export function BottomNav({ onFeedbackClick }: BottomNavProps = {}) {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const { isVisible } = useProgressiveDisclosure()

  // Filter nav items by progressive disclosure
  const primaryNav = getPrimaryNav().filter(item => isVisible(item.disclosureKey))
  const overflowNav = getOverflowNav().filter(item => isVisible(item.disclosureKey))

  // Check if any overflow item is active
  const isMoreActive = overflowNav.some(item =>
    getIsActive(item, location.pathname, location.search)
  )

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-[env(safe-area-inset-bottom)]"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-14">
          {/* Primary Navigation Items */}
          {primaryNav.map(item => {
            const Icon = item.icon
            const active = getIsActive(item, location.pathname, location.search)
            const href = item.tab ? `${item.path}?tab=${item.tab}` : item.path

            return (
              <Link
                key={item.tab ? `${item.path}?tab=${item.tab}` : item.path}
                to={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors duration-150',
                  active ? 'text-brand' : 'text-muted-foreground active:text-brand'
                )}
              >
                <Icon className="size-6" aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none">{item.name}</span>
              </Link>
            )
          })}

          {/* More Button */}
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More menu"
            aria-expanded={moreOpen}
            className={cn(
              'flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors duration-150',
              isMoreActive ? 'text-brand' : 'text-muted-foreground active:text-brand'
            )}
          >
            <MoreHorizontal className="size-6" aria-hidden="true" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Drawer */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen} direction="bottom">
        <DrawerContent>
          <DrawerHeader>
            <div className="mx-auto w-12 h-1.5 rounded-full bg-muted mb-4" aria-hidden="true" />
            <DrawerTitle>More Options</DrawerTitle>
          </DrawerHeader>
          <nav className="flex flex-col max-h-[60vh]" aria-label="Additional navigation">
            {/* Scrollable nav links area */}
            <div className="overflow-y-auto flex-1 px-4 pt-2 pb-2">
              {/* Render overflow items grouped by navigationGroups for consistency with the sidebar */}
              {navigationGroups.map(group => {
                const items = group.items.filter(item => !primaryNavPaths.includes(item.path))
                if (items.length === 0) return null
                return (
                  <section key={group.label} className="mb-4">
                    <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {group.label}
                    </p>
                    <ul className="space-y-1">
                      {items.map(item => {
                        const Icon = item.icon
                        const active = getIsActive(item, location.pathname, location.search)
                        const href = item.tab ? `${item.path}?tab=${item.tab}` : item.path
                        return (
                          <li key={item.tab ? `${item.path}?tab=${item.tab}` : item.path}>
                            <Link
                              to={href}
                              onClick={() => setMoreOpen(false)}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150',
                                active
                                  ? 'bg-brand text-brand-foreground'
                                  : 'text-foreground hover:bg-accent active:bg-accent'
                              )}
                            >
                              <Icon className="size-5" aria-hidden="true" />
                              <span className="text-sm font-medium">{item.name}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
              {/* Settings always appears at the bottom of the scrollable section */}
              <div className="border-t border-border pt-2 mb-2">
                <ul>
                  {(() => {
                    const item = settingsItem
                    const Icon = item.icon
                    const active = getIsActive(item, location.pathname, location.search)
                    const href = item.path
                    return (
                      <li key={href}>
                        <Link
                          to={href}
                          onClick={() => setMoreOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150',
                            active
                              ? 'bg-brand text-brand-foreground'
                              : 'text-foreground hover:bg-accent active:bg-accent'
                          )}
                        >
                          <Icon className="size-5" aria-hidden="true" />
                          <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                      </li>
                    )
                  })()}
                </ul>
              </div>
            </div>
            {/* Send Feedback pinned to bottom — always visible regardless of scroll position */}
            <div className="sticky bottom-0 bg-background border-t border-border px-4 pb-6 pt-2">
              <button
                type="button"
                data-testid="feedback-trigger-mobile"
                onClick={() => {
                  setMoreOpen(false)
                  onFeedbackClick?.()
                }}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 w-full',
                  'text-foreground hover:bg-accent active:bg-accent'
                )}
              >
                <MessageSquarePlus className="size-5" aria-hidden="true" />
                <span className="text-sm font-medium">Send Feedback</span>
              </button>
            </div>
          </nav>
        </DrawerContent>
      </Drawer>
    </>
  )
}
