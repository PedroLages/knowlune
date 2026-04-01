/**
 * PomodoroSettings — Settings card for Pomodoro timer and session preferences.
 *
 * Includes:
 * - Notification sound selector with preview
 * - Session quality score popup toggle
 */

import { useState } from 'react'
import { Timer, Volume2, Play } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/app/components/ui/card'
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

export function PomodoroSettings() {
  const [prefs, setPrefs] = useState(getPomodoroPreferences)

  const updatePref = (update: Partial<typeof prefs>) => {
    const merged = savePomodoroPreferences(update)
    setPrefs(merged)
  }

  return (
    <Card id="pomodoro-settings">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Timer className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-display">Pomodoro & Sessions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Timer sounds and study session preferences
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Notification Sound */}
        <div className="space-y-2">
          <Label htmlFor="notification-sound" className="flex items-center gap-2">
            <Volume2 className="size-4 text-muted-foreground" aria-hidden="true" />
            Notification Sound
          </Label>
          <div className="flex items-center gap-2">
            <Select
              value={prefs.notificationSound}
              onValueChange={(value: PomodoroSoundId) => updatePref({ notificationSound: value })}
            >
              <SelectTrigger id="notification-sound" className="flex-1">
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
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => previewSound(prefs.notificationSound, prefs.notificationVolume)}
              aria-label="Preview notification sound"
            >
              <Play className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Session Quality Score Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="show-quality-score">Session Quality Score</Label>
            <p className="text-sm text-muted-foreground">
              Show quality score popup after study sessions
            </p>
          </div>
          <Switch
            id="show-quality-score"
            checked={prefs.showQualityScore}
            onCheckedChange={checked => updatePref({ showQualityScore: checked })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
