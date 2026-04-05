import { useState, useCallback } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command'
import { SETTINGS_SEARCH_INDEX, type SettingsSearchEntry } from './settingsSearchIndex'
import type { SettingsCategorySlug } from './settingsCategories'

interface SettingsSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (category: SettingsCategorySlug) => void
}

export function SettingsSearch({ open, onOpenChange, onNavigate }: SettingsSearchProps) {
  const [query, setQuery] = useState('')

  const handleSelect = useCallback(
    (entry: SettingsSearchEntry) => {
      onNavigate(entry.category)
      onOpenChange(false)
      setQuery('')
    },
    [onNavigate, onOpenChange]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search settings..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No settings found.</CommandEmpty>
        <CommandGroup heading="Settings">
          {SETTINGS_SEARCH_INDEX.map(entry => {
            const Icon = entry.icon
            return (
              <CommandItem
                key={`${entry.category}-${entry.label}`}
                value={`${entry.label} ${entry.keywords.join(' ')}`}
                onSelect={() => handleSelect(entry)}
                className="flex items-center gap-3 min-h-[44px]"
              >
                <Icon className="size-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{entry.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{entry.description}</span>
                </div>
                <span className="text-xs text-muted-foreground/60 flex-shrink-0 capitalize">
                  {entry.category}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
