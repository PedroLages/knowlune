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

  // Calculate milestone positions
  const maxMilestone = milestones[milestones.length - 1]
  const getMilestoneAngle = (milestone: number) => (milestone / maxMilestone) * 360
  const getMilestonePosition = (angle: number) => {
    const radian = (angle - 90) * (Math.PI / 180) // -90 to start from top
    return {
      x: size / 2 + radius * Math.cos(radian),
      y: size / 2 + radius * Math.sin(radian),
    }
  }

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-gold/10 to-warning/10 border-gold/30 shadow-studio-gold overflow-hidden min-w-[200px]">
      {/* Gold accent line */}
      <div className="h-1 bg-gradient-to-r from-gold via-gold to-warning" />

      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Circular progress ring */}
          <div className="relative flex-shrink-0">
            <svg width={size} height={size} className="rotate-[-90deg]" aria-hidden="true">
              {/* Background ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-gold"
              />
              {/* Progress ring */}
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
                className="text-gold motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
              />
              {/* Milestone markers */}
              {milestones.map(m => {
                const angle = getMilestoneAngle(m)
                const pos = getMilestonePosition(angle)
                const isCompleted = completedLessons >= m
                const isCurrent = milestone.next === m
                const markerRadius = isCurrent ? 5 : 3

                return (
                  <circle
                    key={m}
                    cx={pos.x}
                    cy={pos.y}
                    r={markerRadius}
                    fill="currentColor"
                    className={`motion-safe:transition-all motion-safe:duration-500 ${
                      isCompleted
                        ? 'text-gold'
                        : 'text-muted'
                    } ${isCurrent ? 'drop-shadow-[0_0_4px_var(--gold)]' : ''}`}
                  />
                )
              })}
            </svg>
            <Trophy className="absolute inset-0 m-auto size-5 text-warning" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-warning">
              {completedLessons} {completedLessons === 1 ? 'lesson' : 'lessons'}
            </p>
            <p className="text-xs text-warning mt-0.5">{milestone.message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
