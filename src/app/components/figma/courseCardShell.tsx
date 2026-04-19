import { Play, CheckCircle2 } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

// ── Internal shared primitives for CourseCard + ImportedCourseCard ───
// Not exported from the figma barrel — imported directly by those two files only.

interface CardCoverProps {
  aspectClass?: string
  heightClass?: string
  children: React.ReactNode
}

/**
 * Frameless cover container matching BookCard's visual DNA:
 * rounded-2xl, overflow-hidden, shadow-card-ambient, -translate-y-2 hover lift.
 * Use `aspectClass` for square/portrait covers, `heightClass` for fixed-height.
 */
function CardCover({ aspectClass, heightClass, children }: CardCoverProps) {
  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden shadow-card-ambient',
        'group-hover:-translate-y-2 group-hover:shadow-[0_10px_30px_var(--shadow-brand)]',
        'transition-all duration-300 motion-reduce:group-hover:-translate-y-0',
        aspectClass,
        heightClass
      )}
    >
      {children}
    </div>
  )
}

interface CoverProgressBarProps {
  progress: number
}

/**
 * Progress bar fused to the bottom edge of the cover, matching BookCard.
 * progress is clamped 0–100.
 */
function CoverProgressBar({ progress }: CoverProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress))
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-foreground/10">
      <div
        className="h-full bg-brand rounded-full transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

interface PlayOverlayProps {
  show: boolean
  onClick: (e: React.MouseEvent) => void
  'data-testid'?: string
  'aria-label'?: string
}

/**
 * Hover-revealed centered Play CTA for not-started courses.
 * Visible on touch devices via `[@media(hover:none)]:opacity-100`.
 * Click handler must call stopPropagation before state transitions.
 */
function PlayOverlay({ show, onClick, 'data-testid': testId, 'aria-label': ariaLabel }: PlayOverlayProps) {
  if (!show) return null
  return (
    <button
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={e => {
        e.stopPropagation()
        onClick(e)
      }}
      className={cn(
        'absolute inset-0 z-20 flex items-center justify-center',
        'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
        'focus-visible:opacity-100 transition-opacity duration-300',
        'outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset',
        'motion-reduce:transition-none'
      )}
    >
      <span className="bg-black/50 backdrop-blur-sm rounded-full p-4 flex items-center justify-center">
        <Play className="size-8 text-white fill-white" aria-hidden="true" />
      </span>
    </button>
  )
}

interface CompletionOverlayProps {
  show: boolean
}

/**
 * Full-cover translucent overlay with check icon for completed courses.
 * Decorative — pointer-events-none so the card click still works.
 */
function CompletionOverlay({ show }: CompletionOverlayProps) {
  if (!show) return null
  return (
    <div
      className="absolute inset-0 bg-background/40 flex items-center justify-center pointer-events-none z-10"
      aria-hidden="true"
    >
      <CheckCircle2 className="size-10 text-success drop-shadow-md" />
    </div>
  )
}

export { CardCover, CoverProgressBar, PlayOverlay, CompletionOverlay }
