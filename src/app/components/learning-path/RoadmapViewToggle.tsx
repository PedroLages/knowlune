import { Map, List } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

export type RoadmapViewMode = 'map' | 'list'

interface RoadmapViewToggleProps {
  mode: RoadmapViewMode
  onModeChange: (mode: RoadmapViewMode) => void
}

/**
 * Toggle between Map and List views of the learning path.
 * Map view shows the trail visualization; List view shows a syllabus-style breakdown.
 */
export function RoadmapViewToggle({ mode, onModeChange }: RoadmapViewToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg bg-muted p-1"
      role="radiogroup"
      aria-label="View mode"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'map'}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
          mode === 'map'
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onModeChange('map')}
      >
        <Map className="size-4" aria-hidden="true" />
        Map
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'list'}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
          mode === 'list'
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onModeChange('list')}
      >
        <List className="size-4" aria-hidden="true" />
        List
      </button>
    </div>
  )
}
