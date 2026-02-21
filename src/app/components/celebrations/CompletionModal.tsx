import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { Trophy, CheckCircle2, Star } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'

export type CelebrationType = 'lesson' | 'module' | 'course'

interface CompletionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: CelebrationType
  title: string
  stats?: {
    lessonsCompleted?: number
    totalLessons?: number
    timeSpent?: number // in hours
    completionPercent?: number
  }
  onContinue?: () => void
}

/**
 * Trigger confetti animation based on completion type
 * Respects prefers-reduced-motion for accessibility
 */
function triggerConfetti(type: CelebrationType) {
  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) {
    return // Skip animation if user prefers reduced motion
  }

  const count = type === 'course' ? 200 : type === 'module' ? 100 : 50
  const spread = type === 'course' ? 100 : type === 'module' ? 80 : 60
  const startVelocity = type === 'course' ? 45 : type === 'module' ? 35 : 25

  confetti({
    particleCount: count,
    spread,
    startVelocity,
    origin: { y: 0.6 },
    colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
  })

  // Additional burst for course completion
  if (type === 'course') {
    setTimeout(() => {
      confetti({
        particleCount: 100,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#2563eb', '#3b82f6', '#60a5fa'],
      })
    }, 250)

    setTimeout(() => {
      confetti({
        particleCount: 100,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#2563eb', '#3b82f6', '#60a5fa'],
      })
    }, 400)
  }
}

export function CompletionModal({
  open,
  onOpenChange,
  type,
  title,
  stats,
  onContinue,
}: CompletionModalProps) {
  // Trigger confetti when modal opens
  useEffect(() => {
    if (open) {
      // Small delay to let modal render
      const timeoutId = setTimeout(() => {
        triggerConfetti(type)
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [open, type])

  const getIcon = () => {
    switch (type) {
      case 'course':
        return <Trophy className="w-16 h-16 text-brand" aria-hidden="true" />
      case 'module':
        return <Star className="w-16 h-16 text-brand" aria-hidden="true" />
      case 'lesson':
        return <CheckCircle2 className="w-16 h-16 text-brand" aria-hidden="true" />
    }
  }

  const getTitle = () => {
    switch (type) {
      case 'course':
        return '🎉 Course Completed!'
      case 'module':
        return '⭐ Module Completed!'
      case 'lesson':
        return '✅ Lesson Completed!'
    }
  }

  const getDescription = () => {
    switch (type) {
      case 'course':
        return `Congratulations! You've completed "${title}". Your dedication is paying off!`
      case 'module':
        return `Great job! You've finished the "${title}" module. Keep up the momentum!`
      case 'lesson':
        return `Nice work! You've completed "${title}". Ready for the next one?`
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div
            className="flex justify-center mb-4"
            role="img"
            aria-label={`${type} completion icon`}
          >
            {getIcon()}
          </div>
          <DialogTitle className="text-center text-2xl">{getTitle()}</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Stats Section - Only show for module/course completion */}
        {(type === 'module' || type === 'course') && stats && (
          <div className="grid grid-cols-2 gap-4 py-6">
            {stats.lessonsCompleted !== undefined && stats.totalLessons !== undefined && (
              <div className="text-center p-4 bg-muted rounded-xl">
                <div className="text-2xl font-bold text-brand">
                  {stats.lessonsCompleted}/{stats.totalLessons}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Lessons</div>
              </div>
            )}

            {stats.completionPercent !== undefined && (
              <div className="text-center p-4 bg-muted rounded-xl">
                <div className="text-2xl font-bold text-brand">{stats.completionPercent}%</div>
                <div className="text-xs text-muted-foreground mt-1">Complete</div>
              </div>
            )}

            {stats.timeSpent !== undefined && (
              <div className="text-center p-4 bg-muted rounded-xl col-span-2">
                <div className="text-2xl font-bold text-brand">{stats.timeSpent}h</div>
                <div className="text-xs text-muted-foreground mt-1">Time Invested</div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onContinue && (
            <Button className="flex-1" onClick={onContinue}>
              Continue Learning
            </Button>
          )}
        </div>

        {/* ARIA live region for screen reader announcements */}
        <div className="sr-only" role="status" aria-live="polite">
          {open && `${type} completed: ${title}`}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Lightweight confetti celebration without modal (for inline celebrations)
 */
export function celebrateCompletion(type: CelebrationType) {
  triggerConfetti(type)
}
