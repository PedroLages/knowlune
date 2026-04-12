import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { useEngagementPrefsStore } from '@/stores/useEngagementPrefsStore'

const toggles = [
  {
    key: 'achievements' as const,
    label: 'Achievements',
    description: 'Show achievement banners and completion celebrations',
  },
  {
    key: 'streaks' as const,
    label: 'Streaks',
    description: 'Show study streak calendar and streak statistics',
  },
  {
    key: 'badges' as const,
    label: 'Badges',
    description: 'Show momentum and milestone badges on courses',
  },
  {
    key: 'animations' as const,
    label: 'Celebratory Effects',
    // E51-S02: This toggle controls celebratory effects (confetti, banners).
    // CSS/Framer Motion suppression is handled by the "Motion Preference" setting
    // in Display & Accessibility. Both are checked: confetti fires only when
    // animations=true AND shouldReduceMotion()=false.
    description:
      'Show confetti, visual energy boosts, and achievement celebrations. Page transitions and UI animations are controlled separately in Display & Accessibility.',
  },
]

export function EngagementPreferences() {
  const achievements = useEngagementPrefsStore(s => s.achievements)
  const streaks = useEngagementPrefsStore(s => s.streaks)
  const badges = useEngagementPrefsStore(s => s.badges)
  const animations = useEngagementPrefsStore(s => s.animations)
  const setPreference = useEngagementPrefsStore(s => s.setPreference)

  const values = { achievements, streaks, badges, animations }

  return (
    <Card data-testid="engagement-preferences">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Sparkles className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg font-display">Engagement Preferences</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Customize gamification features to match your learning style
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Feature Toggles */}
        <div className="space-y-4" role="group" aria-label="Gamification feature toggles">
          {toggles.map(toggle => (
            <div
              key={toggle.key}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors"
            >
              <div className="min-w-0">
                <Label
                  htmlFor={`engagement-${toggle.key}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {toggle.label}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{toggle.description}</p>
              </div>
              <Switch
                id={`engagement-${toggle.key}`}
                checked={values[toggle.key]}
                onCheckedChange={(checked: boolean) => setPreference(toggle.key, checked)}
                aria-label={`Toggle ${toggle.label.toLowerCase()}`}
                data-testid={`toggle-${toggle.key}`}
              />
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  )
}
