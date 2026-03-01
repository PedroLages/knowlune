import { getCurrentStreak, getLongestStreak, getStudyActivity } from '@/lib/studyLog'

export function SwissStreakCalendar() {
  const currentStreak = getCurrentStreak()
  const longestStreak = getLongestStreak()
  const activity = getStudyActivity(30)

  return (
    <div>
      {/* Stat boxes */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Current streak */}
        <div className="border border-neutral-200 bg-white p-5">
          <div className="border-t-2 border-[#DC2626] pt-3">
            <p className="text-4xl font-bold text-black leading-none mb-1">{currentStreak}</p>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">
              Current Streak
            </p>
          </div>
        </div>

        {/* Longest streak */}
        <div className="border border-neutral-200 bg-white p-5">
          <div className="border-t-2 border-black pt-3">
            <p className="text-4xl font-bold text-black leading-none mb-1">{longestStreak}</p>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400">
              Longest Streak
            </p>
          </div>
        </div>
      </div>

      {/* Calendar heatmap */}
      <div className="grid grid-cols-10 gap-1 mb-4">
        {activity.map(day => (
          <div
            key={day.date}
            className="aspect-square"
            style={{
              backgroundColor: day.hasActivity ? '#DC2626' : '#f5f5f5',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-neutral-100" />
          <span className="text-xs uppercase tracking-[0.05em] text-neutral-400">Inactive</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#DC2626]" />
          <span className="text-xs uppercase tracking-[0.05em] text-neutral-400">Active</span>
        </div>
      </div>
    </div>
  )
}
