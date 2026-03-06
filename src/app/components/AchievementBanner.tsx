import { useEffect, useRef } from 'react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Trophy } from 'lucide-react'
import confetti from 'canvas-confetti'

interface AchievementBannerProps {
  completedLessons: number
}

const milestones = [10, 25, 50, 100, 250, 500]

function getNextMilestone(completed: number): {
  next: number
  remaining: number
  message: string
} {
  const next = milestones.find(m => m > completed)

  if (!next) {
    return {
      next: 0,
      remaining: 0,
      message: "You're a legend!",
    }
  }

  const remaining = next - completed
  return {
    next,
    remaining,
    message: `${remaining} more to reach ${next}!`,
  }
}

export function AchievementBanner({ completedLessons }: AchievementBannerProps) {
  const prevMilestoneRef = useRef<number | null>(null)

  // Fire confetti when crossing a milestone
  useEffect(() => {
    if (completedLessons === 0) return

    const currentMilestoneIndex = milestones.findIndex(m => m > completedLessons)
    const reachedMilestoneIndex = currentMilestoneIndex - 1

    if (
      prevMilestoneRef.current !== null &&
      reachedMilestoneIndex >= 0 &&
      reachedMilestoneIndex > prevMilestoneRef.current
    ) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReducedMotion) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#f59e0b', '#d97706', '#fbbf24', '#2563eb'],
        })
      }
    }
    prevMilestoneRef.current = reachedMilestoneIndex
  }, [completedLessons])

  if (completedLessons === 0) return null

  const milestone = getNextMilestone(completedLessons)
  const progress = milestone.next ? (completedLessons / milestone.next) * 100 : 100

  // SVG progress ring
  const size = 52
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, progress) / 100) * circumference

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/50 dark:border-amber-800/30 shadow-studio-gold overflow-hidden min-w-[200px]">
      {/* Gold accent line */}
      <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400" />

      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Circular progress ring */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} className="rotate-[-90deg]" aria-hidden="true">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-amber-200 dark:text-amber-800/40"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="text-amber-500 motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
              />
            </svg>
            <Trophy
              className="absolute inset-0 m-auto size-5 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {completedLessons} {completedLessons === 1 ? 'lesson' : 'lessons'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{milestone.message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
