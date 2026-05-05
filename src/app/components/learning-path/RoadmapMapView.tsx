import { ArrowDown } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { TrailMap } from '@/app/components/figma/TrailMap'
import type { LearningPathEntry } from '@/data/types'

interface RoadmapMapViewProps {
  entries: LearningPathEntry[]
  completedCount: number
  currentIndex: number
  onJumpToNext: () => void
}

/**
 * Map-first view of the learning path roadmap.
 * Renders the TrailMap visualization with a "Jump to next" CTA
 * that scrolls to the current course in the list view.
 */
export function RoadmapMapView({
  entries,
  completedCount,
  currentIndex,
  onJumpToNext,
}: RoadmapMapViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] px-2">
          Path Journey
        </h2>
        {currentIndex >= 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={onJumpToNext}
          >
            <ArrowDown className="size-3.5" aria-hidden="true" />
            Jump to Next
          </Button>
        )}
      </div>
      <TrailMap
        totalCourses={entries.length}
        completedCount={completedCount}
        currentIndex={currentIndex}
      />
      {currentIndex >= 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {completedCount} of {entries.length} courses completed
          {entries[currentIndex]
            ? ` — next: course ${currentIndex + 1}`
            : ''}
        </p>
      )}
    </div>
  )
}
