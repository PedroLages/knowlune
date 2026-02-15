import { useState } from 'react'
import { Flame, Award, Pause } from 'lucide-react'
import {
  getCurrentStreak,
  getLongestStreak,
  getStudyActivity,
  setStreakPause,
  getStreakPauseStatus,
} from '@/lib/studyLog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'

interface StudyStreakCalendarProps {
  days?: number
  className?: string
}

export function StudyStreakCalendar({ days = 30, className }: StudyStreakCalendarProps) {
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false)
  const [pauseDays, setPauseDays] = useState('7')

  const currentStreak = getCurrentStreak()
  const longestStreak = getLongestStreak()
  const activity = getStudyActivity(days)
  const pauseStatus = getStreakPauseStatus()

  const handlePauseStreak = () => {
    const days = parseInt(pauseDays, 10)
    if (!isNaN(days) && days > 0 && days <= 365) {
      setStreakPause(days)
      setPauseDialogOpen(false)
      // Force re-render by triggering a state update in parent
      window.location.reload()
    }
  }

  return (
    <div className={className}>
      {/* Streak Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Current Streak */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-2xl p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-5 w-5 text-orange-500" aria-hidden="true" />
            <span className="text-sm font-medium text-orange-900 dark:text-orange-100">
              Current Streak
            </span>
          </div>
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {currentStreak}
          </div>
          <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">
            {currentStreak === 1 ? 'day' : 'days'} in a row
          </div>
          {pauseStatus && pauseStatus.enabled && (
            <div className="mt-2 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
              <Pause className="h-3 w-3" aria-hidden="true" />
              <span>Vacation mode active</span>
            </div>
          )}
        </div>

        {/* Longest Streak */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-5 w-5 text-blue-500" aria-hidden="true" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Longest Streak
            </span>
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{longestStreak}</div>
          <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">personal best</div>
        </div>
      </div>

      {/* Calendar Heatmap */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Last {days} Days</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPauseDialogOpen(true)}
            className="text-xs"
          >
            <Pause className="h-3 w-3 mr-1" />
            Pause Streak
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-10 gap-1.5">
          <TooltipProvider>
            {activity.map(day => {
              const date = new Date(day.date)
              const formattedDate = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })

              return (
                <Tooltip key={day.date}>
                  <TooltipTrigger asChild>
                    <div
                      className={`
                        aspect-square rounded-md cursor-default transition-all
                        ${
                          day.hasActivity
                            ? day.lessonCount >= 3
                              ? 'bg-green-600 dark:bg-green-500'
                              : day.lessonCount >= 2
                                ? 'bg-green-500 dark:bg-green-400'
                                : 'bg-green-400 dark:bg-green-300'
                            : 'bg-muted dark:bg-muted/50'
                        }
                        hover:scale-110 hover:shadow-md
                      `}
                      aria-label={
                        day.hasActivity
                          ? `${formattedDate}: ${day.lessonCount} lesson${
                              day.lessonCount > 1 ? 's' : ''
                            } completed`
                          : `${formattedDate}: No activity`
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-semibold">{formattedDate}</div>
                      <div className="text-muted-foreground">
                        {day.hasActivity
                          ? `${day.lessonCount} lesson${day.lessonCount > 1 ? 's' : ''} completed`
                          : 'No activity'}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-sm bg-muted dark:bg-muted/50" />
            <div className="w-4 h-4 rounded-sm bg-green-400 dark:bg-green-300" />
            <div className="w-4 h-4 rounded-sm bg-green-500 dark:bg-green-400" />
            <div className="w-4 h-4 rounded-sm bg-green-600 dark:bg-green-500" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Pause Streak Dialog */}
      <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause Your Streak</DialogTitle>
            <DialogDescription>
              Going on vacation or taking a break? Pause your streak to prevent it from resetting
              while you're away.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="pause-days">Number of days to pause</Label>
            <Input
              id="pause-days"
              type="number"
              min="1"
              max="365"
              value={pauseDays}
              onChange={e => setPauseDays(e.target.value)}
              className="mt-2"
              placeholder="e.g., 7"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Your streak will be protected for up to {pauseDays}{' '}
              {parseInt(pauseDays) === 1 ? 'day' : 'days'}.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePauseStreak}>Activate Pause</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
