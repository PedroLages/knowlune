/**
 * PomodoroSettings — Apple-style Pomodoro timer settings with
 * stepper controls for focus/break duration, sound selector, and toggles.
 */

import { useState } from 'react'
import { Timer, Volume2, Play, Minus, Plus } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Label } from '@/app/components/ui/label'
import { Switch } from '@/app/components/ui/switch'
import { Button } from '@/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { POMODORO_SOUNDS, previewSound, type PomodoroSoundId } from '@/lib/pomodoroAudio'
import { getPomodoroPreferences, savePomodoroPreferences } from '@/lib/pomodoroPreferences'

const FOCUS_MIN = 5
const FOCUS_MAX = 60
const FOCUS_STEP = 5
const BREAK_MIN = 1
const BREAK_MAX = 30
const BREAK_STEP = 1

function Stepper({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  label: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground min-w-[3rem]">{label}</span>
      <div className="flex items-center bg-muted rounded-full p-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          className="flex items-center justify-center size-8 rounded-full hover:bg-muted-foreground/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          <Minus className="size-3.5 text-muted-foreground" />
        </button>
        <span className="px-3 text-sm font-bold text-foreground min-w-[3.5rem] text-center tabular-nums">
          {value}m
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          className="flex items-center justify-center size-8 rounded-full hover:bg-muted-foreground/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          <Plus className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}

export function PomodoroSettings() {
  const [prefs, setPrefs] = useState(getPomodoroPreferences)

  const updatePref = (update: Partial<typeof prefs>) => {
    const merged = savePomodoroPreferences(update)
    setPrefs(merged)
  }

  return (
    <section id="pomodoro-settings">
      <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
        Pomodoro & Sessions
      </h4>

      {/* Timer Durations — Apple stepper style */}
      <div className="bg-card rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center justify-center size-10 rounded-full bg-destructive/10">
            <Timer className="size-5 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Pomodoro Timer</h3>
            <p className="text-xs text-muted-foreground">Duration for focus and break sessions</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Stepper
            value={prefs.focusDuration}
            min={FOCUS_MIN}
            max={FOCUS_MAX}
            step={FOCUS_STEP}
            label="Focus"
            onChange={v => updatePref({ focusDuration: v })}
          />
          <Stepper
            value={prefs.breakDuration}
            min={BREAK_MIN}
            max={BREAK_MAX}
            step={BREAK_STEP}
            label="Break"
            onChange={v => updatePref({ breakDuration: v })}
          />
        </div>
      </div>

      {/* Toggles and Sound */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        {/* Auto-start Break */}
        <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
          <div>
            <p className="text-sm font-medium">Auto-start break</p>
            <p className="text-xs text-muted-foreground">
              Automatically begin break when focus ends
            </p>
          </div>
          <Switch
            checked={prefs.autoStartBreak}
            onCheckedChange={checked => updatePref({ autoStartBreak: checked })}
            aria-label="Auto-start break after focus"
          />
        </div>

        <div className="h-px mx-4 bg-border/50" />

        {/* Auto-start Focus */}
        <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
          <div>
            <p className="text-sm font-medium">Auto-start focus</p>
            <p className="text-xs text-muted-foreground">
              Automatically begin next focus after break
            </p>
          </div>
          <Switch
            checked={prefs.autoStartFocus}
            onCheckedChange={checked => updatePref({ autoStartFocus: checked })}
            aria-label="Auto-start focus after break"
          />
        </div>

        <div className="h-px mx-4 bg-border/50" />

        {/* Session Quality Score */}
        <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
          <div>
            <p className="text-sm font-medium">Session quality score</p>
            <p className="text-xs text-muted-foreground">
              Show quality popup after study sessions
            </p>
          </div>
          <Switch
            id="show-quality-score"
            checked={prefs.showQualityScore}
            onCheckedChange={checked => updatePref({ showQualityScore: checked })}
          />
        </div>

        <div className="h-px mx-4 bg-border/50" />

        {/* Notification Sound */}
        <div className="p-4 hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Volume2 className="size-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">Notification sound</p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={prefs.notificationSound}
                onValueChange={(value: PomodoroSoundId) =>
                  updatePref({ notificationSound: value })
                }
              >
                <SelectTrigger className="w-[140px] min-h-[36px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POMODORO_SOUNDS.map(sound => (
                    <SelectItem key={sound.id} value={sound.id}>
                      {sound.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 size-9"
                onClick={() => previewSound(prefs.notificationSound, prefs.notificationVolume)}
                aria-label="Preview notification sound"
              >
                <Play className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
