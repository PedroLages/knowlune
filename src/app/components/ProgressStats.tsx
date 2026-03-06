import { StatsCard } from './StatsCard'
import { TrendingUp, BookOpen, Clock, Target } from 'lucide-react'
import { Course } from '@/data/types'
import {
  getAverageProgressPercent,
  getTotalEstimatedStudyHours,
  getCoursesInProgress,
  getWeeklyChange,
  getLast7DaysLessonCompletions,
} from '@/lib/progress'
import { getCurrentStreak } from '@/lib/studyLog'

interface ProgressStatsProps {
  courses: Course[]
}

export function ProgressStats({ courses }: ProgressStatsProps) {
  const avgProgress = getAverageProgressPercent(courses)
  const studyStreak = getCurrentStreak()
  const totalHours = getTotalEstimatedStudyHours()
  const inProgressCount = getCoursesInProgress(courses).length
  const weeklyChange = getWeeklyChange('lessons')
  const last7Days = getLast7DaysLessonCompletions()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatsCard
        label="Average Progress"
        value={`${avgProgress}%`}
        icon={TrendingUp}
        trend={avgProgress > 0 ? 'up' : undefined}
        sparkline={last7Days}
      />
      <StatsCard
        label="Study Streak"
        value={`${studyStreak} days`}
        icon={Target}
        trend={studyStreak > 0 ? 'up' : undefined}
      />
      <StatsCard label="Study Time" value={`${totalHours}h`} icon={Clock} />
      <StatsCard
        label="In Progress"
        value={inProgressCount.toString()}
        icon={BookOpen}
        trend={weeklyChange > 0 ? 'up' : weeklyChange < 0 ? 'down' : undefined}
        trendValue={weeklyChange !== 0 ? `${Math.abs(weeklyChange)} this week` : undefined}
      />
    </div>
  )
}
