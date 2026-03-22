import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { MoreHorizontal } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/app/components/ui/drawer'
import { cn } from '@/app/components/ui/utils'
import { getPrimaryNav, getOverflowNav, getIsActive } from '@/app/config/navigation'

// Get navigation items from shared config
const primaryNav = getPrimaryNav()
const overflowNav = getOverflowNav()

export function BottomNav() {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

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
                <Icon className="w-6 h-6" aria-hidden="true" />
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
            <MoreHorizontal className="w-6 h-6" aria-hidden="true" />
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
          <nav className="px-4 pb-6" aria-label="Additional navigation">
            <ul className="space-y-2">
              {overflowNav.map(item => {
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
                      <Icon className="w-5 h-5" aria-hidden="true" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </DrawerContent>
      </Drawer>
    </>
  )
}
