import { allCourses } from '@/data/courses'
import { getTotalCompletedLessons, getCompletedCourses } from '@/lib/progress'

export function ProgressWidget() {
  const completedCourses = getCompletedCourses(allCourses).length
  const totalCourses = allCourses.length
  const completedLessons = getTotalCompletedLessons()

  // Calculate percentage for the ring
  const percentage = totalCourses > 0 ? (completedCourses / totalCourses) * 100 : 0

  // SVG circle parameters
  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div
      className="mt-auto bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-3 text-center"
      role="status"
      aria-label={`Course progress: ${completedCourses} of ${totalCourses} courses completed, ${completedLessons} lessons finished`}
    >
      {/* Circular Progress Ring */}
      <div className="flex justify-center mb-2">
        <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />

          {/* Progress circle */}
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
            className="text-brand transition-all duration-500 ease-out"
          />

          {/* Center text */}
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dy="0.3em"
            className="fill-current text-base font-bold transform rotate-90"
            style={{ transformOrigin: 'center' }}
          >
            {Math.round(percentage)}%
          </text>
        </svg>
      </div>

      {/* Stats */}
      <p className="text-sm font-semibold text-foreground">
        {completedCourses}/{totalCourses} courses
      </p>
      <p className="text-xs text-muted-foreground mt-1">{completedLessons} lessons completed</p>
    </div>
  )
}
