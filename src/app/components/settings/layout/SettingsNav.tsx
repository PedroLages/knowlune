import { cn } from '@/app/components/ui/utils'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { SETTINGS_CATEGORIES, type SettingsCategorySlug } from './settingsCategories'

interface SettingsNavProps {
  activeCategory: SettingsCategorySlug
  onCategoryChange: (slug: SettingsCategorySlug) => void
  modifiedCategories?: Set<SettingsCategorySlug>
}

export function SettingsNav({
  activeCategory,
  onCategoryChange,
  modifiedCategories,
}: SettingsNavProps) {
  return (
    <nav aria-label="Settings categories" className="w-56 flex-shrink-0">
      <div className="sticky top-6">
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <ul className="space-y-1 pr-4">
            {SETTINGS_CATEGORIES.map(category => {
              const isActive = activeCategory === category.slug
              const isModified = modifiedCategories?.has(category.slug)
              const Icon = category.icon

              return (
                <li key={category.slug}>
                  <button
                    onClick={() => onCategoryChange(category.slug)}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={isModified ? `${category.label} (modified)` : category.label}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left',
                      'transition-all duration-150 min-h-[44px]',
                      isActive
                        ? 'bg-brand text-brand-foreground font-medium shadow-md shadow-brand/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center justify-center size-7 rounded-lg flex-shrink-0',
                        isActive ? 'bg-brand-foreground/20' : 'bg-brand-soft'
                      )}
                    >
                      <Icon
                        className={cn('size-4', isActive ? 'text-brand-foreground' : 'text-brand')}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="text-sm truncate">{category.label}</span>
                    {isModified && (
                      <span
                        className={cn(
                          'ml-auto w-2 h-2 rounded-full flex-shrink-0',
                          isActive ? 'bg-brand-foreground/70' : 'bg-warning'
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      </div>
    </nav>
  )
}
