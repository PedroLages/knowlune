import { Card, CardContent } from '@/app/components/ui/card'
import { Trophy, Target } from 'lucide-react'

interface AchievementBannerProps {
  completedLessons: number
}

function getNextMilestone(completed: number): {
  next: number
  remaining: number
  message: string
} {
  const milestones = [10, 25, 50, 100, 250, 500]
  const next = milestones.find(m => m > completed)

  if (!next) {
    return {
      next: 0,
      remaining: 0,
      message: "You're a legend! 🏆",
    }
  }

  const remaining = next - completed
  return {
    next,
    remaining,
    message: `${remaining} more to reach ${next} lessons!`,
  }
}

export function AchievementBanner({ completedLessons }: AchievementBannerProps) {
  if (completedLessons === 0) return null

  const milestone = getNextMilestone(completedLessons)
  const progress = milestone.next ? (completedLessons / milestone.next) * 100 : 100

  return (
    <Card className="mb-8 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-brand" />
              <h2 className="text-lg font-bold">Keep Going!</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              You've completed <span className="font-bold text-brand">{completedLessons}</span>{' '}
              {completedLessons === 1 ? 'lesson' : 'lessons'}.
            </p>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mt-1">
              {milestone.message}
            </p>

            {/* Progress bar to next milestone */}
            {milestone.next > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress to {milestone.next}</span>
                  <span className="font-semibold text-brand">
                    {Math.min(100, Math.round(progress))}%
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Trophy icon */}
          <div className="ml-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 flex items-center justify-center shadow-lg">
            <Trophy className="w-10 h-10 text-yellow-600 dark:text-yellow-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
