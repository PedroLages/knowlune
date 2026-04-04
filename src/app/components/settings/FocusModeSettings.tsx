/**
 * FocusModeSettings — Settings card for focus mode auto-activation preferences.
 *
 * Includes toggles for:
 * - Auto-activate focus mode when a quiz starts (focusAutoQuiz)
 * - Auto-activate focus mode when a flashcard/interleaved review starts (focusAutoFlashcard)
 */

import { useState } from 'react'
import { Focus } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/app/components/ui/card'
import { Label } from '@/app/components/ui/label'
import { Switch } from '@/app/components/ui/switch'
import { getSettings, saveSettings } from '@/lib/settings'

export function FocusModeSettings() {
  const [settings, setSettings] = useState(getSettings)

  const update = (patch: Parameters<typeof saveSettings>[0]) => {
    saveSettings(patch)
    setSettings(getSettings())
  }

  return (
    <Card id="focus-mode-settings" data-testid="focus-mode-settings">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Focus className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-display">Focus Mode</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically enter focus mode when study sessions begin
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Auto-activate on Quiz */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="focus-auto-quiz">Auto-activate for Quizzes</Label>
            <p className="text-sm text-muted-foreground">
              Activate focus mode automatically when a quiz begins
            </p>
          </div>
          <Switch
            id="focus-auto-quiz"
            data-testid="focus-auto-quiz-toggle"
            checked={settings.focusAutoQuiz !== false}
            onCheckedChange={checked => update({ focusAutoQuiz: checked })}
          />
        </div>

        {/* Auto-activate on Flashcard / Interleaved Review */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="focus-auto-flashcard">Auto-activate for Flashcard Review</Label>
            <p className="text-sm text-muted-foreground">
              Activate focus mode automatically when a flashcard or interleaved review session
              begins
            </p>
          </div>
          <Switch
            id="focus-auto-flashcard"
            data-testid="focus-auto-flashcard-toggle"
            checked={settings.focusAutoFlashcard !== false}
            onCheckedChange={checked => update({ focusAutoFlashcard: checked })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
