import { cn } from '@/app/components/ui/utils'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import {
  SETTINGS_CATEGORIES,
  type SettingsCategorySlug,
} from './settingsCategories'

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
                    aria-label={
                      isModified
                        ? `${category.label} (modified)`
                        : category.label
                    }
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
                      'transition-all duration-200 min-h-[44px]',
                      isActive
                        ? 'bg-brand-soft text-brand-soft-foreground border-l-2 border-brand font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="size-4 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm truncate">{category.label}</span>
                    {isModified && (
                      <span
                        className="ml-auto w-2 h-2 rounded-full bg-warning flex-shrink-0"
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
