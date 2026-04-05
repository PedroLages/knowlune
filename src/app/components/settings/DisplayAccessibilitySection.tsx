import { RotateCcw } from 'lucide-react'
import { Button, buttonVariants } from '@/app/components/ui/button'
import { Switch } from '@/app/components/ui/switch'
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
    // Also clear session-level reading mode customizations
    try {
      localStorage.removeItem('reading-mode-settings')
    } catch {
      // silent-catch-ok: localStorage unavailable
    }
    toastSuccess.saved('Display settings reset to defaults')
  }

  return (
    <section>
      <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
        Accessibility
      </h4>
      <div
        className="bg-card rounded-xl shadow-sm overflow-hidden"
        data-testid="display-accessibility-section"
      >
        {/* Accessibility Font */}
        <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
          <div>
            <p className="text-sm font-medium">Accessibility Font</p>
            <p className="text-xs text-muted-foreground">
              Use Atkinson Hyperlegible for improved readability
            </p>
          </div>
          <Switch
            checked={settings.accessibilityFont}
            onCheckedChange={(checked: boolean) => onSettingsChange({ accessibilityFont: checked })}
            aria-label="Enable accessibility font"
          />
        </div>

        {/* Font preview panel — shown when accessibility font is enabled */}
        {settings.accessibilityFont && (
          <div
            className="animate-in fade-in-0 slide-in-from-top-1 mx-4 mb-4 rounded-xl border border-border/50 bg-muted/30 p-4 duration-200"
            data-testid="accessibility-font-preview"
          >
            <p className="text-base">The quick brown fox jumps over the lazy dog</p>
            <p className="mt-1 text-base text-muted-foreground">0123456789 AaBbCcDdEeFf</p>
            <p className="mt-2 text-xs italic text-muted-foreground">
              Atkinson Hyperlegible &mdash; Braille Institute
            </p>
          </div>
        )}

        <div className="h-px mx-4 bg-border/50" />

        {/* Spacious Mode */}
        <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
          <div>
            <p className="text-sm font-medium">Spacious Mode</p>
            <p className="text-xs text-muted-foreground">
              Increase spacing in content areas for easier reading
            </p>
          </div>
          <Switch
            checked={settings.contentDensity === 'spacious'}
            onCheckedChange={() =>
              onSettingsChange({
                contentDensity: settings.contentDensity === 'spacious' ? 'default' : 'spacious',
              })
            }
            aria-label="Enable spacious content density"
          />
        </div>

        <div className="h-px mx-4 bg-border/50" />

        {/* Motion Preference */}
        <div className="p-4">
          <div className="mb-3">
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
            className="flex flex-col gap-2"
          >
            {(
              [
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
              ] as const
            ).map(option => (
              <Label
                key={option.value}
                htmlFor={`motion-${option.value}`}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-ring ${
                  settings.reduceMotion === option.value
                    ? 'border-brand bg-brand-soft'
                    : 'border-border'
                }`}
              >
                <RadioGroupItem value={option.value} id={`motion-${option.value}`} />
                <div>
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Reset to Defaults */}
      <div className="flex justify-center mt-6">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="min-h-[44px] gap-2 rounded-full px-6 text-muted-foreground hover:text-foreground"
              aria-label="Reset display settings to defaults"
            >
              <RotateCcw className="size-4" />
              Reset to Default Settings
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset display settings?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset accessibility font, spacious mode, motion preference, reading mode
                defaults, and focus mode auto-activation to their default values.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReset}
                className={buttonVariants({ variant: 'brand' })}
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  )
}
