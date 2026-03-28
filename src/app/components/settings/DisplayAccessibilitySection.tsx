import { Eye, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Switch } from '@/app/components/ui/switch'
import { Separator } from '@/app/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { Label } from '@/app/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import { toastSuccess } from '@/lib/toastHelpers'
import { DISPLAY_DEFAULTS, type AppSettings, type ReduceMotion } from '@/lib/settings'

interface DisplayAccessibilitySectionProps {
  settings: AppSettings
  onSettingsChange: (updates: Partial<AppSettings>) => void
}

export function DisplayAccessibilitySection({
  settings,
  onSettingsChange,
}: DisplayAccessibilitySectionProps) {
  function handleReset() {
    onSettingsChange(DISPLAY_DEFAULTS)
    toastSuccess.saved('Display settings reset to defaults')
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Eye className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-display leading-none">Display & Accessibility</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Customize how content looks and moves
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6" data-testid="display-accessibility-section">
        {/* Accessibility Font */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Accessibility Font</p>
            <p className="text-xs text-muted-foreground">
              Use Atkinson Hyperlegible for improved readability
            </p>
          </div>
          <Switch
            checked={settings.accessibilityFont}
            disabled
            aria-label="Toggle accessibility font"
          />
        </div>

        <Separator className="my-4" />

        {/* Spacious Mode */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Spacious Mode</p>
            <p className="text-xs text-muted-foreground">
              Increase padding and line height for easier reading
            </p>
          </div>
          <Switch
            checked={settings.contentDensity === 'spacious'}
            disabled
            aria-label="Toggle spacious content density"
          />
        </div>

        <Separator className="my-4" />

        {/* Motion Preference */}
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium">Motion Preference</p>
            <p className="text-xs text-muted-foreground">
              Control whether animations play on the page
            </p>
          </div>
          <RadioGroup
            value={settings.reduceMotion}
            onValueChange={(value: string) =>
              onSettingsChange({ reduceMotion: value as ReduceMotion })
            }
            aria-label="Motion preference"
            className="mt-1 flex flex-col gap-2"
          >
            {([
              {
                value: 'system',
                label: 'Follow system',
                description: 'Uses your device\u2019s motion preference',
              },
              {
                value: 'on',
                label: 'Reduce motion',
                description: 'Minimize animations and transitions',
              },
              {
                value: 'off',
                label: 'Allow all motion',
                description: 'Enable all animations regardless of system setting',
              },
            ] as const).map((option) => (
              <Label
                key={option.value}
                htmlFor={`motion-${option.value}`}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
                  settings.reduceMotion === option.value
                    ? 'border-brand bg-brand-soft'
                    : 'border-border'
                }`}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`motion-${option.value}`}
                />
                <div>
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <Separator className="my-4" />

        {/* Reset to Defaults */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="min-h-[44px] w-full gap-2 sm:w-auto"
              aria-label="Reset display settings to defaults"
            >
              <RotateCcw className="size-4" />
              Reset display settings to defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-[24px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset display settings?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset accessibility font, spacious mode, and motion preference to their
                default values.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReset}
                className="bg-brand text-brand-foreground hover:bg-brand-hover"
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
