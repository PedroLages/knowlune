import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { X, BookOpen } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import type { ImportedCourse } from '@/data/types'

interface NextCourseSuggestionProps {
  /** The suggested course to display */
  suggestedCourse: ImportedCourse
  /** Tags shared between the completed and suggested course */
  sharedTags: string[]
  /** Optional thumbnail URL (blob or YouTube) */
  thumbnailUrl?: string | null
  /** Called when user dismisses the card */
  onDismiss: () => void
}

/**
 * Shown after a course-level completion celebration closes.
 * Displays the best next course based on tag overlap and recency.
 *
 * Props-driven — does not use any dead stores (AC7).
 */
export function NextCourseSuggestion({
  suggestedCourse,
  sharedTags,
  thumbnailUrl,
  onDismiss,
}: NextCourseSuggestionProps) {
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)

  // Focus card on mount for keyboard accessibility
  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  const handleStartLearning = () => {
    navigate(`/courses/${suggestedCourse.id}`)
    onDismiss()
  }

  const displayTags = sharedTags.slice(0, 4)
  const extraTagCount = sharedTags.length - displayTags.length

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      data-testid="next-course-suggestion"
      className="rounded-2xl bg-card shadow-sm border border-border/50 p-6 outline-none animate-in fade-in duration-300 motion-reduce:animate-none"
      role="region"
      aria-label="Next course suggestion"
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail or fallback */}
        <div className="shrink-0 w-24 h-16 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            Up Next
          </p>
          <h3 className="text-sm font-semibold truncate">{suggestedCourse.name}</h3>

          {/* Shared tag badges */}
          {displayTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5" aria-label="Shared topics">
              {displayTags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {extraTagCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  +{extraTagCount} more
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          <Button variant="brand" size="sm" onClick={handleStartLearning}>
            Start Learning
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            aria-label="Dismiss suggestion"
            className="size-8"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
