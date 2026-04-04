import { Fragment, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Flame, Award, Pause, Play, Snowflake, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import ConfettiExplosion from 'react-confetti-explosion'
import {
  getStreakSnapshot,
  setStreakPause,
  clearStreakPause,
  setFreezeDays,
  INDEFINITE_PAUSE_DAYS,
  type StreakSnapshot,
} from '@/lib/studyLog'
import { detectAndRecordMilestones } from '@/lib/streakMilestones'
import { StreakMilestoneToast } from '@/app/components/celebrations/StreakMilestoneToast'
import { MilestoneGallery } from '@/app/components/MilestoneGallery'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { cn } from '@/app/components/ui/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Alert, AlertTitle } from '@/app/components/ui/alert'
import { Button } from '@/app/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import { Badge } from '@/app/components/ui/badge'

interface StudyStreakCalendarProps {
  /** Number of weeks to display */
  weeks?: number
  className?: string
}

interface WeekDay {
  date: string
  dayOfWeek: number // 0=Sun, 1=Mon...6=Sat
  weekIndex: number
  hasActivity: boolean
  lessonCount: number
  isFreezeDay: boolean
  isToday: boolean
  monthLabel?: string // set on the first day of a new month in that column
  studyMinutes?: number
  courses?: Array<{ id: string; title: string }>
}

/** Organize flat activity data into a weekly grid structure */
function buildWeekGrid(
  activity: Array<{
    date: string
    hasActivity: boolean
    lessonCount: number
    isFreezeDay: boolean
  }>,
  todayStr: string
): { grid: WeekDay[][]; monthLabels: { label: string; colStart: number }[] } {
  if (activity.length === 0) return { grid: [], monthLabels: [] }

  // Parse and assign week/day indices
  const firstDate = new Date(activity[0].date + 'T12:00:00')
  const firstDayOfWeek = firstDate.getDay() // 0=Sun

  // Mock course data for tooltip enhancement
  const mockCourses = [
    { id: '1', title: 'React Fundamentals' },
    { id: '2', title: 'TypeScript Deep Dive' },
    { id: '3', title: 'UI/UX Design Principles' },
    { id: '4', title: 'Advanced CSS Techniques' },
    { id: '5', title: 'Web Performance' },
  ]

  const days: WeekDay[] = activity.map((day, i) => {
    const d = new Date(day.date + 'T12:00:00')
    const dayOfWeek = d.getDay()
    const weekIndex = Math.floor((i + firstDayOfWeek) / 7)

    // Generate mock study minutes and courses for days with activity
    let studyMinutes: number | undefined
    let courses: Array<{ id: string; title: string }> | undefined

    if (day.hasActivity && day.lessonCount > 0) {
      // Mock study minutes: 15-45 minutes per lesson
      studyMinutes = day.lessonCount * (15 + Math.floor(Math.random() * 30))

      // Mock course list: randomly select 1-4 courses based on lesson count
      const courseCount = Math.min(day.lessonCount, 1 + Math.floor(Math.random() * 4))
      courses = mockCourses.sort(() => Math.random() - 0.5).slice(0, courseCount)
    }

    return {
      ...day,
      dayOfWeek,
      weekIndex,
      isToday: day.date === todayStr,
      studyMinutes,
      courses,
    }
  })

  // Build 7-row grid (rows=days, cols=weeks)
  const grid: WeekDay[][] = Array.from({ length: 7 }, () => [])
  for (const day of days) {
    grid[day.dayOfWeek].push(day)
  }

  // Calculate month labels - find the first occurrence of each month
  const monthLabels: { label: string; colStart: number }[] = []
  let prevMonth = -1
  for (const day of days) {
    const d = new Date(day.date + 'T12:00:00')
    const month = d.getMonth()
    if (month !== prevMonth) {
      monthLabels.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        colStart: day.weekIndex,
      })
      prevMonth = month
    }
  }

  return { grid, monthLabels }
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function StudyStreakCalendar({ weeks = 16, className }: StudyStreakCalendarProps) {
  const freezeTriggerRef = useRef<HTMLButtonElement>(null)
  const [milestoneKey, setMilestoneKey] = useState(0)
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false)
  const [selectedFreezeDays, setSelectedFreezeDays] = useState<number[]>([])
  const [freezeValidation, setFreezeValidation] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  // Request enough days to fill the weeks + partial first week
  const totalDays = weeks * 7 + 6
  const [snapshot, setSnapshot] = useState<StreakSnapshot>(() => getStreakSnapshot(totalDays))

  const refreshSnapshot = useCallback(() => {
    setSnapshot(getStreakSnapshot(totalDays))
  }, [totalDays])

  const celebrateMilestones = useCallback((currentStreak: number) => {
    const sessionKey = `milestones-checked-${currentStreak}`
    if (sessionStorage.getItem(sessionKey)) return
    sessionStorage.setItem(sessionKey, '1')

    try {
      const newMilestones = detectAndRecordMilestones(currentStreak)
      for (const milestone of newMilestones) {
        toast.custom(() => <StreakMilestoneToast milestone={milestone} />, {
          duration: 8000,
        })
      }

      // Trigger confetti for major milestones
      const CONFETTI_MILESTONES = [7, 14, 30, 60, 90, 180, 365]
      if (CONFETTI_MILESTONES.includes(currentStreak)) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
      }
    } catch (err) {
      // silent-catch-ok: error logged to console
      console.warn('Failed to detect/record milestones:', err)
    }
  }, [])

  // Check milestones on mount and when streak changes
  useEffect(() => {
    celebrateMilestones(snapshot.currentStreak)
  }, [celebrateMilestones, snapshot.currentStreak])

  useEffect(() => {
    const handleUpdate = () => {
      const next = getStreakSnapshot(totalDays)
      setSnapshot(next)
      celebrateMilestones(next.currentStreak)
    }
    window.addEventListener('study-log-updated', handleUpdate)
    return () => window.removeEventListener('study-log-updated', handleUpdate)
  }, [totalDays, celebrateMilestones])

  const { currentStreak, longestStreak, activity, pauseStatus, freezeDays } = snapshot

  const todayStr = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('sv')
  }, [])

  const { grid, monthLabels } = useMemo(
    () => buildWeekGrid(activity, todayStr),
    [activity, todayStr]
  )

  const totalWeeks = grid[0]?.length ?? 0

  const prefersReducedMotion = useReducedMotion()
  const isPaused = pauseStatus?.enabled ?? false

  const handlePauseToggle = () => {
    if (isPaused) {
      clearStreakPause()
    } else {
      setStreakPause(INDEFINITE_PAUSE_DAYS)
    }
    refreshSnapshot()
  }

  const handleOpenFreezeSettings = () => {
    setSelectedFreezeDays([...freezeDays])
    setFreezeValidation(false)
    setFreezeDialogOpen(true)
  }

  const handleToggleFreezeDay = (dayIndex: number) => {
    setFreezeValidation(false)
    if (selectedFreezeDays.includes(dayIndex)) {
      setSelectedFreezeDays(prev => prev.filter(d => d !== dayIndex))
    } else if (selectedFreezeDays.length >= 3) {
      setFreezeValidation(true)
    } else {
      setSelectedFreezeDays(prev => [...prev, dayIndex])
    }
  }

  const handleSaveFreezeDays = () => {
    setFreezeDays(selectedFreezeDays)
    setFreezeDialogOpen(false)
    refreshSnapshot()
  }

  // Calculate dynamic flame intensity (0-1 scale, capping at 30-day streak)
  const flameIntensity = useMemo(() => Math.min(currentStreak / 30, 1), [currentStreak])

  return (
    <div className={className}>
      {/* Streak Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Current Streak */}
        <div className="bg-momentum-warm-bg rounded-2xl p-4 border border-warning">
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              animate={
                prefersReducedMotion
                  ? {}
                  : {
                      scale: [1, 1.15 + flameIntensity * 0.2, 1], // Larger bounce for longer streaks
                      filter: `brightness(${1 + flameIntensity * 0.5})`, // Brighter = longer streak
                    }
              }
              transition={{
                repeat: Infinity,
                duration: 2 - flameIntensity * 0.5, // Faster pulse for longer streaks
                ease: 'easeInOut',
              }}
              className="flex items-center justify-center"
            >
              <Flame
                className="size-5 text-warning"
                strokeWidth={2 + flameIntensity} // Bolder at higher streaks
                aria-hidden="true"
              />
            </motion.div>
            <span className="text-sm font-medium text-warning">Current Streak</span>
          </div>
          <div className="relative">
            <div
              data-testid="current-streak-value"
              className="text-3xl font-bold tabular-nums text-warning"
            >
              {currentStreak}
            </div>
            {/* Confetti celebration for milestone achievements */}
            {showConfetti && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2">
                <ConfettiExplosion
                  particleCount={50 + currentStreak / 10}
                  colors={['#f59e0b', '#d97706', '#b45309']} // Gold/warning theme
                  duration={2500}
                  force={0.6}
                  width={400}
                />
              </div>
            )}
          </div>
          <div className="text-xs text-warning mt-1">
            {currentStreak === 1 ? 'day' : 'days'} in a row
          </div>
          {isPaused && (
            <Alert
              data-testid="streak-paused-indicator"
              className="mt-2 border-warning bg-momentum-warm-bg py-2 px-3 text-xs text-warning [&>svg]:size-3"
            >
              <Pause className="size-3" aria-hidden="true" />
              <AlertTitle className="text-xs font-normal">Streak paused</AlertTitle>
            </Alert>
          )}
        </div>

        {/* Longest Streak */}
        <div className="bg-brand-soft rounded-2xl p-4 border border-brand">
          <div className="flex items-center gap-2 mb-2">
            <Award className="size-5 text-brand" aria-hidden="true" />
            <span className="text-sm font-medium text-brand">Longest Streak</span>
          </div>
          <div className="text-3xl font-bold tabular-nums text-brand">{longestStreak}</div>
          <div className="text-xs text-brand mt-1">personal best</div>
        </div>
      </div>

      {/* Milestone Collection Trigger */}
      <div className="flex justify-end mb-3">
        <Popover
          onOpenChange={open => {
            if (open) setMilestoneKey(k => k + 1)
          }}
        >
          <PopoverTrigger asChild>
            <Button
              data-testid="milestone-collection-trigger"
              variant="outline"
              size="sm"
              className="text-xs min-h-[44px]"
            >
              <Trophy className="size-3 mr-1" aria-hidden="true" />
              Milestones
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" aria-labelledby="milestone-gallery-heading">
            <div className="mb-3">
              <h4 id="milestone-gallery-heading" className="text-sm font-semibold">
                Streak Milestones
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Your streak achievement collection
              </p>
            </div>
            <MilestoneGallery key={milestoneKey} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Calendar Heatmap */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4">
          <h3 className="text-sm font-semibold">Activity</h3>
          <div className="flex items-center gap-2">
            <Button
              ref={freezeTriggerRef}
              data-testid="freeze-days-settings"
              variant="outline"
              size="sm"
              onClick={handleOpenFreezeSettings}
              className="text-xs min-h-[44px]"
            >
              <Snowflake className="size-3 mr-1" aria-hidden="true" />
              Freeze Days{freezeDays.length > 0 && ` (${freezeDays.length})`}
            </Button>
            <Button
              data-testid="streak-pause-toggle"
              variant="outline"
              size="sm"
              onClick={handlePauseToggle}
              aria-pressed={isPaused}
              className="text-xs min-h-[44px]"
            >
              {isPaused ? (
                <>
                  <Play className="size-3 mr-1" aria-hidden="true" />
                  Resume Streak
                </>
              ) : (
                <>
                  <Pause className="size-3 mr-1" aria-hidden="true" />
                  Pause Streak
                </>
              )}
            </Button>
          </div>
        </div>

        {/* GitHub-style Weekly Heatmap Grid */}
        <div className="overflow-x-auto -mx-1 px-1">
          <TooltipProvider>
            <div
              role="group"
              aria-label="Study activity calendar"
              className="grid gap-[3px]"
              style={{
                gridTemplateColumns: `auto repeat(${totalWeeks}, minmax(10px, 1fr))`,
                gridTemplateRows: 'auto repeat(7, 1fr)',
              }}
            >
              {/* Month labels row */}
              <div /> {/* empty top-left corner */}
              {Array.from({ length: totalWeeks }, (_, colIdx) => {
                const label = monthLabels.find(m => m.colStart === colIdx)
                return (
                  <div
                    key={`month-${colIdx}`}
                    className="text-[10px] text-muted-foreground h-4 flex items-end px-0.5 leading-none"
                  >
                    {label?.label ?? ''}
                  </div>
                )
              })}
              {/* Day rows */}
              {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => (
                <Fragment key={`row-${dayIdx}`}>
                  {/* Day label */}
                  <div className="text-[10px] text-muted-foreground pr-2 h-[18px] flex items-center justify-end leading-none">
                    {dayIdx % 2 === 1 ? DAY_LABELS[dayIdx] : ''}
                  </div>

                  {/* Activity cells for this day across all weeks */}
                  {grid[dayIdx]?.map(day => {
                    const date = new Date(day.date + 'T12:00:00')
                    const formattedDate = date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })

                    return (
                      <Tooltip key={day.date}>
                        <TooltipTrigger asChild>
                          <div
                            tabIndex={0}
                            role="img"
                            className={cn(
                              'aspect-square w-full rounded-[4px] motion-safe:transition-[transform,box-shadow] motion-safe:duration-150',
                              'motion-safe:hover:scale-110 motion-safe:hover:shadow-md',
                              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                              day.isToday && 'ring-2 ring-warning ring-offset-1 ring-offset-card',
                              day.hasActivity
                                ? day.lessonCount >= 3
                                  ? 'bg-warning'
                                  : day.lessonCount >= 2
                                    ? 'bg-gold'
                                    : 'bg-gold'
                                : day.isFreezeDay
                                  ? 'bg-accent'
                                  : 'bg-momentum-warm-bg'
                            )}
                            aria-label={
                              day.hasActivity
                                ? `${formattedDate}: ${day.lessonCount} lesson${
                                    day.lessonCount > 1 ? 's' : ''
                                  } completed`
                                : day.isFreezeDay
                                  ? `${formattedDate}: Rest day`
                                  : `${formattedDate}: No activity`
                            }
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-2 min-w-[180px]">
                            {/* Date Header */}
                            <div className="font-semibold text-foreground">{formattedDate}</div>

                            {/* Freeze Day */}
                            {day.isFreezeDay && !day.hasActivity && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Snowflake className="size-3.5" aria-hidden="true" />
                                <span>Rest day</span>
                              </div>
                            )}

                            {/* Activity Summary */}
                            {day.hasActivity && day.studyMinutes && (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {day.lessonCount} lesson{day.lessonCount > 1 ? 's' : ''}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {day.studyMinutes} min
                                </span>
                              </div>
                            )}

                            {/* Course Breakdown */}
                            {day.hasActivity && day.courses && day.courses.length > 0 && (
                              <div className="space-y-1 pt-1 border-t border-border">
                                {day.courses.slice(0, 3).map(course => (
                                  <div
                                    key={course.id}
                                    className="text-muted-foreground leading-snug"
                                  >
                                    • {course.title}
                                  </div>
                                ))}
                                {day.courses.length > 3 && (
                                  <div className="text-muted-foreground italic text-[11px]">
                                    +{day.courses.length - 3} more course
                                    {day.courses.length - 3 > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* No Activity */}
                            {!day.hasActivity && !day.isFreezeDay && (
                              <div className="text-muted-foreground">No activity</div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="size-3 rounded-[3px] bg-momentum-warm-bg" />
            <div className="size-3 rounded-[3px] bg-gold" />
            <div className="size-3 rounded-[3px] bg-gold" />
            <div className="size-3 rounded-[3px] bg-warning" />
          </div>
          <span>More</span>
          {/* Freeze day indicator */}
          {freezeDays.length > 0 && (
            <span className="flex items-center gap-1.5">
              <div className="size-3 rounded-[3px] bg-accent" />
              Rest
            </span>
          )}
          {/* Today indicator */}
          <span className="ml-auto flex items-center gap-1.5">
            <div className="size-3 rounded-[3px] ring-2 ring-warning ring-offset-1 ring-offset-card" />
            Today
          </span>
        </div>
      </div>

      {/* Freeze Days Settings Dialog */}
      <Dialog
        open={freezeDialogOpen}
        onOpenChange={open => {
          setFreezeDialogOpen(open)
          if (!open) freezeTriggerRef.current?.focus()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Freeze Days</DialogTitle>
            <DialogDescription>
              Choose up to 3 rest days per week. Your streak won't reset on these days even if you
              don't study.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, idx) => {
                const isSelected = selectedFreezeDays.includes(idx)
                return (
                  <button
                    key={label}
                    type="button"
                    data-testid="freeze-day-option"
                    data-selected={isSelected}
                    aria-pressed={isSelected}
                    onClick={() => handleToggleFreezeDay(idx)}
                    className={cn(
                      'min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl border text-sm font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {freezeValidation && (
              <p
                data-testid="freeze-days-validation"
                role="alert"
                className="text-sm text-destructive mt-3"
              >
                Maximum 3 freeze days allowed per week.
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              {selectedFreezeDays.length}/3 days selected
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFreezeDays}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
