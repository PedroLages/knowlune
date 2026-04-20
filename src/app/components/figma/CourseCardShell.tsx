import type { MouseEvent, ReactNode } from 'react'
import { Play, CheckCircle2 } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

// ── Internal shared primitives for CourseCard + ImportedCourseCard ───
// Not exported from the figma barrel — imported directly by those two files only.

// Glass/scrim treatment for overlays on cover imagery. Passes 4.5:1 contrast
// regardless of thumbnail brightness. Reused by status pill and corner chips.
// eslint-disable-next-line design-tokens/no-hardcoded-colors -- intentional overlay scrim over imagery
const OVERLAY_SCRIM_CLASS = 'bg-black/60 text-white backdrop-blur-sm border border-white/10'

interface CardCoverProps {
  heightClass: string
  children: ReactNode
}

/**
 * Frameless cover container matching BookCard's visual DNA:
 * rounded-2xl, overflow-hidden, shadow-card-ambient, -translate-y-2 hover lift.
 * `heightClass` is required to prevent zero-height containers.
 */
function CardCover({ heightClass, children }: CardCoverProps) {
  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden shadow-card-ambient',
        'group-hover:-translate-y-2 group-hover:shadow-[0_10px_30px_var(--shadow-brand)]',
        'transition-all duration-300 motion-reduce:group-hover:-translate-y-0',
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
 * progress is clamped 0–100. z-20 keeps it above CompletionOverlay (z-10) at 100%.
 */
function CoverProgressBar({ progress }: CoverProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress))
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-foreground/10 z-20">
      <div
        className="h-full bg-brand rounded-full transition-all motion-reduce:transition-none"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

interface PlayOverlayProps {
  show: boolean
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
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
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        onClick(e)
      }}
      className={cn(
        'absolute inset-0 z-20 flex items-center justify-center',
        'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
        'focus-visible:opacity-100 transition-opacity duration-300',
        'outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-foreground/50',
        'motion-reduce:transition-none'
      )}
    >
      <span className="bg-foreground/60 backdrop-blur-sm rounded-full p-4 flex items-center justify-center">
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

interface CoverCornerChipProps {
  position: 'bottom-left' | 'bottom-right'
  children: ReactNode
  'data-testid'?: string
}

/**
 * Small glassmorphic chip anchored to a cover corner. Used for duration
 * (bottom-right) and resolution (bottom-left) overlays on course card covers.
 * Sits at z-30 — above `CoverProgressBar` (z-20) and the base `<img>`.
 * Follows YouTube/Vimeo corner-chip convention.
 */
function CoverCornerChip({ position, children, 'data-testid': testId }: CoverCornerChipProps) {
  const positionClass = position === 'bottom-right' ? 'bottom-2 right-2' : 'bottom-2 left-2'
  return (
    <span
      data-testid={testId}
      className={cn(
        'absolute z-30 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none',
        positionClass,
        OVERLAY_SCRIM_CLASS
      )}
    >
      {children}
    </span>
  )
}

export { CardCover, CoverProgressBar, PlayOverlay, CompletionOverlay, CoverCornerChip, OVERLAY_SCRIM_CLASS }
