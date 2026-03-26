import { Flame, Award } from 'lucide-react'
import { getCurrentStreak, getLongestStreak, getStudyActivity } from '@/lib/studyLog'

interface HybridStreakCalendarProps {
  days?: number
  className?: string
}

export function HybridStreakCalendar({ days = 30, className }: HybridStreakCalendarProps) {
  const currentStreak = getCurrentStreak()
  const longestStreak = getLongestStreak()
  const activity = getStudyActivity(days)

  return (
    <div className={className}>
      {/* Streak Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Current Streak */}
        <div className="bg-warning/10 rounded-xl p-4 border border-warning/20">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="size-5 text-warning" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">Current Streak</span>
          </div>
          <div className="text-3xl font-bold text-warning">{currentStreak}</div>
          <div className="text-xs text-warning mt-1">
            {currentStreak === 1 ? 'day' : 'days'} in a row
          </div>
        </div>

        {/* Longest Streak */}
        <div className="bg-brand-soft rounded-xl p-4 border border-brand/20">
          <div className="flex items-center gap-2 mb-2">
            <Award className="size-5 text-brand" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">Longest Streak</span>
          </div>
          <div className="text-3xl font-bold text-brand">{longestStreak}</div>
          <div className="text-xs text-brand mt-1">personal best</div>
        </div>
      </div>

      {/* Calendar Heatmap */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Last {days} Days</h3>

        {/* Calendar Grid */}
        <div className="grid grid-cols-10 gap-1.5">
          {activity.map(day => {
            const date = new Date(day.date)
            const formattedDate = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })

            let colorClass = 'bg-neutral-100'
            if (day.lessonCount >= 3) {
              colorClass = 'bg-success'
            } else if (day.lessonCount >= 2) {
              colorClass = 'bg-success/70'
            } else if (day.lessonCount >= 1) {
              colorClass = 'bg-success/40'
            }

            return (
              <div
                key={day.date}
                className={`aspect-square rounded-sm cursor-default transition-transform duration-150 hover:scale-105 ${colorClass}`}
                title={
                  day.hasActivity
                    ? `${formattedDate}: ${day.lessonCount} lesson${day.lessonCount > 1 ? 's' : ''} completed`
                    : `${formattedDate}: No activity`
                }
                aria-label={
                  day.hasActivity
                    ? `${formattedDate}: ${day.lessonCount} lesson${day.lessonCount > 1 ? 's' : ''} completed`
                    : `${formattedDate}: No activity`
                }
              />
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 text-xs text-neutral-400">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3.5 h-3.5 rounded-sm bg-neutral-100" />
            <div className="w-3.5 h-3.5 rounded-sm bg-success/40" />
            <div className="w-3.5 h-3.5 rounded-sm bg-success/70" />
            <div className="w-3.5 h-3.5 rounded-sm bg-success" />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
