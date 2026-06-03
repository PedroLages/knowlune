import { Link } from 'react-router'
import { Check, AlertCircle, PlayCircle, RotateCcw, Undo2, CheckCircle2, Video } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { formatClockDuration } from '@/lib/formatDuration'
import type { ImportedVideo } from '@/data/types'

// ---------------------------------------------------------------------------
// StatusCircle
// ---------------------------------------------------------------------------

/** Status circle on the timeline connector line */
export function StatusCircle({
  status,
  simplified,
}: {
  status: 'completed' | 'in-progress' | 'available' | 'locked' | 'gap'
  /** When true, renders a compact variant without border ring */
  simplified?: boolean
}) {
  const dotSize = simplified ? 'size-6' : 'size-8'
  const borderRing = simplified ? '' : 'border-4 border-card'
  const baseClass = cn(
    dotSize,
    'shrink-0 rounded-full flex items-center justify-center relative z-10 transition-all duration-300',
    borderRing
  )
  const iconSize = simplified ? 'size-3' : 'size-4'

  if (status === 'completed') {
    return (
      <div className={cn(baseClass, 'bg-success text-success-foreground')}>
        <Check className={iconSize} aria-hidden="true" />
      </div>
    )
  }

  if (status === 'in-progress') {
    return (
      <div className={cn(baseClass, 'bg-brand text-brand-foreground ring-4 ring-brand-soft')}>
        <div
          className={cn('rounded-full bg-white animate-pulse', simplified ? 'size-2' : 'size-2.5')}
        />
      </div>
    )
  }

  if (status === 'available') {
    return (
      <div className={cn(baseClass, 'bg-muted/80 border border-muted-foreground/25')}>
        <div
          className={cn('rounded-full bg-muted-foreground/40', simplified ? 'size-1.5' : 'size-2')}
        />
      </div>
    )
  }

  if (status === 'gap') {
    return (
      <div
        className={cn(
          baseClass,
          'bg-warning/20 text-warning border-2 border-dashed border-warning/50'
        )}
      >
        <AlertCircle className={iconSize} aria-hidden="true" />
      </div>
    )
  }

  // Locked — hollow outline circle with less visual weight
  return (
    <div className={cn(baseClass, 'bg-muted/30 border border-muted-foreground/30')}>
      <div
        className={cn('rounded-full bg-muted-foreground/30', simplified ? 'size-1.5' : 'size-2')}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// LessonRow
// ---------------------------------------------------------------------------

/** Single lesson row within an expanded module accordion */
export function LessonRow({
  video,
  courseId,
  isCompleted,
}: {
  video: ImportedVideo
  courseId: string
  isCompleted: boolean
}) {
  const displayName = video.filename.replace(/\.\w+$/, '')

  return (
    <Link
      to={`/courses/${courseId}/lessons/${video.id}`}
      className="flex items-center gap-3 px-4 py-2.5 min-h-[44px] rounded-xl transition-colors hover:bg-muted/50 group"
    >
      {isCompleted ? (
        <CheckCircle2 className="size-5 text-success flex-shrink-0" aria-hidden="true" />
      ) : (
        <Video className="size-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground/80 group-hover:text-foreground transition-colors">
          {displayName}
        </p>
      </div>
      {video.duration > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
          {formatClockDuration(video.duration)}
        </span>
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// EntryActionButton
// ---------------------------------------------------------------------------

/** Action for an unlocked timeline entry: Continue/Start Module, Review, Mark Complete, or Undo */
export function EntryActionButton({
  status,
  isManuallyCompleted,
  hasRealProgress,
  onClick,
  onMarkComplete,
}: {
  status: 'completed' | 'in-progress' | 'available' | 'locked'
  isManuallyCompleted?: boolean
  /** When true, the module has real progress (1-99%) — shows "Continue Module" instead of "Start Module" */
  hasRealProgress?: boolean
  onClick: () => void
  onMarkComplete?: () => void
}) {
  if (isManuallyCompleted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={e => {
          e.stopPropagation()
          onMarkComplete?.()
        }}
      >
        <Undo2 className="size-4 mr-1" aria-hidden="true" />
        Undo
      </Button>
    )
  }

  if (status === 'in-progress' || status === 'available') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="brand"
          size="sm"
          className="px-5 py-2 rounded-xl text-sm font-bold shadow-sm min-h-11"
          onClick={e => {
            e.stopPropagation()
            onClick()
          }}
        >
          <PlayCircle className="size-4 mr-1.5" aria-hidden="true" />
          {hasRealProgress ? 'Continue Module' : 'Start Module'}
        </Button>
        {onMarkComplete && (
          <Button
            variant="outline"
            size="sm"
            className="px-3 py-2 rounded-xl text-sm font-medium"
            onClick={e => {
              e.stopPropagation()
              onMarkComplete()
            }}
          >
            <CheckCircle2 className="size-4 mr-1" aria-hidden="true" />
            Complete
          </Button>
        )}
      </div>
    )
  }

  if (status === 'completed') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="px-5 py-2 rounded-xl text-sm font-bold min-h-11"
        onClick={e => {
          e.stopPropagation()
          onClick()
        }}
      >
        <RotateCcw className="size-4 mr-1.5" aria-hidden="true" />
        Review
      </Button>
    )
  }

  // Locked state: status pill in the card header already says "Locked" — avoid duplicating it beside metadata.
  return null
}
