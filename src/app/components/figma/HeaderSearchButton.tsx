import { Search } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { usePaletteController } from '@/app/components/figma/PaletteControllerContext'
import type { EntityType } from '@/lib/unifiedSearch'
import { SECTION_ORDER } from '@/app/components/figma/SearchCommandPalette'

interface HeaderSearchButtonProps {
  scope: EntityType
  /** Defaults to "Search <heading>" derived from SECTION_ORDER. */
  label?: string
}

export function HeaderSearchButton({ scope, label }: HeaderSearchButtonProps) {
  const { open } = usePaletteController()
  const heading = SECTION_ORDER.find(s => s.type === scope)?.heading ?? scope
  const displayLabel = label ?? `Search ${heading.toLowerCase()}`

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={() => open(scope)}
      aria-label={displayLabel}
      data-testid={`header-search-btn-${scope}`}
    >
      <Search className="mr-1.5 size-4 shrink-0" aria-hidden="true" />
      {displayLabel}
    </Button>
  )
}
