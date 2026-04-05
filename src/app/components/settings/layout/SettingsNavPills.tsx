import { cn } from '@/app/components/ui/utils'
import {
  SETTINGS_CATEGORIES,
  type SettingsCategorySlug,
} from './settingsCategories'

interface SettingsNavPillsProps {
  activeCategory: SettingsCategorySlug
  onCategoryChange: (slug: SettingsCategorySlug) => void
  modifiedCategories?: Set<SettingsCategorySlug>
}

export function SettingsNavPills({
  activeCategory,
  onCategoryChange,
  modifiedCategories,
}: SettingsNavPillsProps) {
  return (
    <div
      className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-3 -mx-4 px-4 pt-1"
      role="tablist"
      aria-label="Settings categories"
    >
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {SETTINGS_CATEGORIES.map(category => {
          const isActive = activeCategory === category.slug
          const isModified = modifiedCategories?.has(category.slug)
          const Icon = category.icon

          return (
            <button
              key={category.slug}
              role="tab"
              aria-selected={isActive}
              aria-label={
                isModified ? `${category.label} (modified)` : category.label
              }
              onClick={() => onCategoryChange(category.slug)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap',
                'transition-all duration-200 min-h-[44px] flex-shrink-0',
                isActive
                  ? 'bg-brand text-brand-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span>{category.label}</span>
              {isModified && (
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    isActive ? 'bg-brand-foreground/70' : 'bg-warning'
                  )}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
