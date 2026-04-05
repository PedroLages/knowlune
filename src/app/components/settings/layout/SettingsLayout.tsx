import { useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useIsDesktop } from '@/app/hooks/useMediaQuery'
import { SettingsNav } from './SettingsNav'
import { SettingsNavPills } from './SettingsNavPills'
import {
  SETTINGS_CATEGORIES,
  DEFAULT_CATEGORY,
  type SettingsCategorySlug,
} from './settingsCategories'
import { AccountSection } from '../sections/AccountSection'
import { ProfileSection } from '../sections/ProfileSection'
import { AppearanceSection } from '../sections/AppearanceSection'
import { LearningSection } from '../sections/LearningSection'
import { NotificationsSection } from '../sections/NotificationsSection'
import { IntegrationsDataSection } from '../sections/IntegrationsDataSection'

interface SettingsLayoutProps {
  modifiedCategories?: Set<SettingsCategorySlug>
  onSearchOpen?: () => void
}

const SECTION_COMPONENTS: Record<SettingsCategorySlug, React.ComponentType> = {
  account: AccountSection,
  profile: ProfileSection,
  appearance: AppearanceSection,
  learning: LearningSection,
  notifications: NotificationsSection,
  integrations: IntegrationsDataSection,
}

export function SettingsLayout({ modifiedCategories, onSearchOpen }: SettingsLayoutProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const isDesktop = useIsDesktop()

  const rawSection = searchParams.get('section')
  const activeCategory = (
    SETTINGS_CATEGORIES.some(c => c.slug === rawSection) ? rawSection : DEFAULT_CATEGORY
  ) as SettingsCategorySlug

  const activeMeta = SETTINGS_CATEGORIES.find(c => c.slug === activeCategory)!
  const ActiveSection = SECTION_COMPONENTS[activeCategory]

  function handleCategoryChange(slug: SettingsCategorySlug) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (slug === DEFAULT_CATEGORY) {
        next.delete('section')
      } else {
        next.set('section', slug)
      }
      return next
    })
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your learning environment and preferences</p>
        </div>
        {onSearchOpen && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSearchOpen}
            className="gap-2 min-h-[44px] text-muted-foreground"
            aria-label="Search settings"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search settings...</span>
            <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>F
            </kbd>
          </Button>
        )}
      </div>

      {isDesktop ? (
        /* Desktop: two-pane layout */
        <div className="flex gap-8 max-w-5xl">
          <SettingsNav
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            modifiedCategories={modifiedCategories}
          />
          <div className="flex-1 max-w-2xl">
            {/* Category heading */}
            <div className="mb-8">
              <h2
                className="text-2xl font-display font-extrabold tracking-tight"
                tabIndex={-1}
                id={`settings-${activeCategory}`}
              >
                {activeMeta.label}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{activeMeta.description}</p>
            </div>
            <ActiveSection />
          </div>
        </div>
      ) : (
        /* Mobile/Tablet: pills + full-width content */
        <div>
          <SettingsNavPills
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            modifiedCategories={modifiedCategories}
          />
          <div className="mt-6">
            <div className="mb-4">
              <h2 className="text-lg font-display" tabIndex={-1} id={`settings-${activeCategory}`}>
                {activeMeta.label}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">{activeMeta.description}</p>
            </div>
            <ActiveSection />
          </div>
        </div>
      )}
    </div>
  )
}
