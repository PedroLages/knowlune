import { useState, useEffect, useCallback } from 'react'
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Volume2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Slider } from '../ui/slider'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { cn } from '../ui/utils'
import { usePomodoroTimer } from '@/hooks/usePomodoroTimer'
import { formatTime } from '@/hooks/useQuizTimer'
import { playChime } from '@/lib/pomodoroAudio'
import {
  getPomodoroPreferences,
  savePomodoroPreferences,
  type PomodoroPreferences,
} from '@/lib/pomodoroPreferences'

/**
 * Pomodoro Focus Timer — popover UI with countdown, controls, and preferences.
 *
 * Renders a timer button in the lesson player header. When active, the button
 * shows the remaining time. Clicking opens a popover with full controls,
 * session counter, and configurable preferences (persisted in localStorage).
 */
export function PomodoroTimer() {
  const [prefs, setPrefs] = useState<PomodoroPreferences>(getPomodoroPreferences)
  const [showPrefs, setShowPrefs] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Sync preferences to localStorage on change
  const updatePref = useCallback((update: Partial<PomodoroPreferences>) => {
    const merged = savePomodoroPreferences(update)
    setPrefs(merged)
  }, [])

  const handleFocusComplete = useCallback(() => {
    playChime(prefs.notificationVolume, prefs.notificationSound)
  }, [prefs.notificationVolume, prefs.notificationSound])

  const handleBreakComplete = useCallback(() => {
    playChime(prefs.notificationVolume, prefs.notificationSound)
  }, [prefs.notificationVolume, prefs.notificationSound])

  const { phase, status, timeRemaining, completedSessions, start, pause, resume, reset, skip } =
    usePomodoroTimer({
      focusDuration: prefs.focusDuration * 60,
      breakDuration: prefs.breakDuration * 60,
      onFocusComplete: handleFocusComplete,
      onBreakComplete: handleBreakComplete,
      autoStartBreak: prefs.autoStartBreak,
      autoStartFocus: prefs.autoStartFocus,
    })

  // Reload preferences on mount (in case they changed from another tab)
  useEffect(() => {
    setPrefs(getPomodoroPreferences())
  }, [])

  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  const isActive = phase !== 'idle' || status !== 'stopped'

  const phaseLabel = phase === 'focus' ? 'Focus Time' : phase === 'break' ? 'Break Time' : 'Ready'

  const sessionLabel = completedSessions === 1 ? '1 session' : `${completedSessions} sessions`

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5',
            isRunning && phase === 'focus' && 'border-brand text-brand-soft-foreground',
            isRunning && phase === 'break' && 'border-success text-success'
          )}
          aria-label={
            isActive
              ? `Pomodoro timer: ${phaseLabel} ${formatTime(timeRemaining)} remaining`
              : 'Pomodoro focus timer'
          }
          data-testid="pomodoro-trigger"
        >
          <Timer className="h-4 w-4" />
          {isActive && (
            <span className="font-mono text-xs" data-testid="pomodoro-trigger-time">
              {formatTime(timeRemaining)}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72" align="end" data-testid="pomodoro-popover">
        {/* Phase indicator */}
        <div
          className={cn(
            'rounded-lg px-3 py-2 mb-3 text-center text-sm font-medium transition-colors',
            phase === 'focus' && 'bg-brand-soft text-brand-soft-foreground',
            phase === 'break' && 'bg-success/10 text-success',
            phase === 'idle' && 'bg-muted text-muted-foreground'
          )}
          aria-live="polite"
          data-testid="pomodoro-phase"
        >
          {phaseLabel}
        </div>

        {/* Countdown display */}
        <div
          role="timer"
          aria-label={`${phaseLabel}: ${formatTime(timeRemaining)} remaining`}
          className="text-center text-4xl font-mono font-bold text-foreground mb-4 tabular-nums"
          data-testid="pomodoro-countdown"
        >
          {formatTime(timeRemaining)}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {phase === 'idle' && status === 'stopped' ? (
            <Button
              variant="brand"
              size="sm"
              onClick={start}
              aria-label="Start focus timer"
              data-testid="pomodoro-start"
            >
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
          ) : (
            <>
              {isRunning ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pause}
                  aria-label="Pause timer"
                  data-testid="pomodoro-pause"
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
              ) : isPaused ? (
                <Button
                  variant="brand"
                  size="sm"
                  onClick={resume}
                  aria-label="Resume timer"
                  data-testid="pomodoro-resume"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </Button>
              ) : (
                // Stopped but not idle (e.g., break phase waiting to start)
                <Button
                  variant="brand"
                  size="sm"
                  onClick={phase === 'break' ? skip : start}
                  aria-label={phase === 'break' ? 'Start break' : 'Start focus timer'}
                  data-testid="pomodoro-start-phase"
                >
                  <Play className="h-4 w-4 mr-1" />
                  {phase === 'break' ? 'Start Break' : 'Start'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={skip}
                aria-label={`Skip ${phase === 'focus' ? 'to break' : 'to focus'}`}
                data-testid="pomodoro-skip"
                className="px-2"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                aria-label="Reset timer"
                data-testid="pomodoro-reset"
                className="px-2"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Session counter */}
        <p
          className="text-center text-sm text-muted-foreground mb-3"
          data-testid="pomodoro-sessions"
        >
          {sessionLabel} completed
        </p>

        {/* Preferences toggle */}
        <button
          type="button"
          onClick={() => setShowPrefs(prev => !prev)}
          className="flex items-center justify-center gap-1 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          aria-expanded={showPrefs}
          aria-controls="pomodoro-preferences"
          data-testid="pomodoro-prefs-toggle"
        >
          Preferences
          {showPrefs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Preferences panel */}
        {showPrefs && (
          <div
            id="pomodoro-preferences"
            className="mt-2 space-y-3 border-t pt-3"
            data-testid="pomodoro-preferences"
          >
            {/* Focus duration */}
            <div className="flex items-center justify-between">
              <Label htmlFor="pomodoro-focus-duration" className="text-xs">
                Focus
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updatePref({
                      focusDuration: Math.max(1, prefs.focusDuration - 5),
                    })
                  }
                  aria-label="Decrease focus duration"
                  disabled={isActive}
                  className="h-6 w-6 text-xs"
                >
                  -
                </Button>
                <span
                  id="pomodoro-focus-duration"
                  className="text-xs font-medium w-12 text-center tabular-nums"
                >
                  {prefs.focusDuration} min
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updatePref({
                      focusDuration: Math.min(60, prefs.focusDuration + 5),
                    })
                  }
                  aria-label="Increase focus duration"
                  disabled={isActive}
                  className="h-6 w-6 text-xs"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Break duration */}
            <div className="flex items-center justify-between">
              <Label htmlFor="pomodoro-break-duration" className="text-xs">
                Break
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updatePref({
                      breakDuration: Math.max(1, prefs.breakDuration - 1),
                    })
                  }
                  aria-label="Decrease break duration"
                  disabled={isActive}
                  className="h-6 w-6 text-xs"
                >
                  -
                </Button>
                <span
                  id="pomodoro-break-duration"
                  className="text-xs font-medium w-12 text-center tabular-nums"
                >
                  {prefs.breakDuration} min
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updatePref({
                      breakDuration: Math.min(30, prefs.breakDuration + 1),
                    })
                  }
                  aria-label="Increase break duration"
                  disabled={isActive}
                  className="h-6 w-6 text-xs"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Auto-start break */}
            <div className="flex items-center justify-between">
              <Label htmlFor="pomodoro-auto-break" className="text-xs">
                Auto-start break
              </Label>
              <Switch
                id="pomodoro-auto-break"
                checked={prefs.autoStartBreak}
                onCheckedChange={checked => updatePref({ autoStartBreak: checked })}
                aria-label="Auto-start break after focus"
                data-testid="pomodoro-auto-break"
              />
            </div>

            {/* Auto-start focus */}
            <div className="flex items-center justify-between">
              <Label htmlFor="pomodoro-auto-focus" className="text-xs">
                Auto-start focus
              </Label>
              <Switch
                id="pomodoro-auto-focus"
                checked={prefs.autoStartFocus}
                onCheckedChange={checked => updatePref({ autoStartFocus: checked })}
                aria-label="Auto-start focus after break"
                data-testid="pomodoro-auto-focus"
              />
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Slider
                value={[prefs.notificationVolume * 100]}
                min={0}
                max={100}
                step={10}
                onValueChange={([v]) => updatePref({ notificationVolume: v / 100 })}
                aria-label="Notification volume"
                data-testid="pomodoro-volume"
              />
              <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
                {Math.round(prefs.notificationVolume * 100)}%
              </span>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
