import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

// ── Internal shared primitives for CourseCard + ImportedCourseCard ───
// Not exported from the figma barrel — imported directly by those two files only.

// Glass/scrim treatment for overlays on cover imagery. Passes 4.5:1 contrast
// regardless of thumbnail brightness. Reused by status pill and corner chips.
 
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

export { CardCover, CoverProgressBar, CompletionOverlay, CoverCornerChip, OVERLAY_SCRIM_CLASS }
