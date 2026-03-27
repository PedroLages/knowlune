import { Sparkles, Palette } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { Separator } from '@/app/components/ui/separator'
import { cn } from '@/app/components/ui/utils'
import { useEngagementPrefsStore, type ColorScheme } from '@/stores/useEngagementPrefsStore'

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
    label: 'Animations',
    description: 'Enable page transitions and celebratory effects',
  },
]

export function EngagementPreferences() {
  const achievements = useEngagementPrefsStore(s => s.achievements)
  const streaks = useEngagementPrefsStore(s => s.streaks)
  const badges = useEngagementPrefsStore(s => s.badges)
  const animations = useEngagementPrefsStore(s => s.animations)
  const colorScheme = useEngagementPrefsStore(s => s.colorScheme)
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

        <Separator />

        {/* Color Scheme Picker */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" aria-hidden="true" />
            <Label className="text-sm font-medium">Color Scheme</Label>
          </div>

          <RadioGroup
            value={colorScheme}
            onValueChange={(value: string) => setPreference('colorScheme', value as ColorScheme)}
            aria-label="Color scheme"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            data-testid="color-scheme-picker"
          >
            {/* Professional */}
            <label
              className={cn(
                'relative flex flex-col gap-2 p-4 border-2 rounded-xl cursor-pointer',
                'transition-all duration-200 hover:shadow-sm',
                colorScheme === 'professional'
                  ? 'border-brand bg-brand-soft shadow-sm'
                  : 'border-border bg-background hover:border-brand/50'
              )}
            >
              <RadioGroupItem value="professional" className="sr-only" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Professional</span>
                {colorScheme === 'professional' && (
                  <div className="w-2 h-2 bg-brand rounded-full" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Clean, muted color palette for focused learning
              </p>
            </label>

            {/* Vibrant */}
            <label
              className={cn(
                'relative flex flex-col gap-2 p-4 border-2 rounded-xl cursor-pointer',
                'transition-all duration-200 hover:shadow-sm',
                colorScheme === 'vibrant'
                  ? 'border-brand bg-brand-soft shadow-sm'
                  : 'border-border bg-background hover:border-brand/50'
              )}
            >
              <RadioGroupItem value="vibrant" className="sr-only" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Vibrant</span>
                {colorScheme === 'vibrant' && <div className="w-2 h-2 bg-brand rounded-full" />}
              </div>
              <p className="text-xs text-muted-foreground">
                High-contrast vibrant colors for an energized experience
              </p>
            </label>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  )
}
