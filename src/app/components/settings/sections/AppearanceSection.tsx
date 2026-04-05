import { Monitor, Sun, Moon, Eye, Type } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Label } from '@/app/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { Switch } from '@/app/components/ui/switch'
import { FontSizePicker } from '@/app/components/settings/FontSizePicker'
import { DisplayAccessibilitySection } from '@/app/components/settings/DisplayAccessibilitySection'
import { ReadingFocusModesSection } from '@/app/components/settings/ReadingFocusModesSection'
import { useSettingsPage } from '@/app/components/settings/SettingsPageContext'
import { useProgressiveDisclosure } from '@/app/hooks/useProgressiveDisclosure'
import type { FontSize } from '@/lib/settings'
import { toastSuccess } from '@/lib/toastHelpers'

export function AppearanceSection() {
  const { settings, theme, setTheme, updateAndPersist } = useSettingsPage()
  const { showAll, toggleShowAll } = useProgressiveDisclosure()

  return (
    <div className="space-y-6">
      {/* Theme */}
      <Card>
        <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-soft p-2">
              <Monitor className="size-5 text-brand" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-display leading-none">Appearance</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose your preferred theme</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div>
            <Label>Theme</Label>
            <RadioGroup value={theme} onValueChange={setTheme} aria-label="Theme" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label
                  className={cn(
                    'relative flex flex-col gap-3 p-4 border-2 rounded-xl cursor-pointer',
                    'transition-all duration-200 hover:shadow-sm',
                    theme === 'system'
                      ? 'border-brand bg-brand-soft shadow-sm'
                      : 'border-border bg-background hover:border-brand/50'
                  )}
                >
                  <RadioGroupItem value="system" className="sr-only" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="size-5 text-muted-foreground" />
                      <span className="text-sm font-medium">System</span>
                    </div>
                    {theme === 'system' && <div className="w-2 h-2 bg-brand rounded-full" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Matches your device settings</p>
                </label>

                <label
                  className={cn(
                    'relative flex flex-col gap-3 p-4 border-2 rounded-xl cursor-pointer',
                    'transition-all duration-200 hover:shadow-sm',
                    theme === 'light'
                      ? 'border-brand bg-brand-soft shadow-sm'
                      : 'border-border bg-background hover:border-brand/50'
                  )}
                >
                  <RadioGroupItem value="light" className="sr-only" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sun className="size-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Light</span>
                    </div>
                    {theme === 'light' && <div className="w-2 h-2 bg-brand rounded-full" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Bright and clean interface</p>
                </label>

                <label
                  className={cn(
                    'relative flex flex-col gap-3 p-4 border-2 rounded-xl cursor-pointer',
                    'transition-all duration-200 hover:shadow-sm',
                    theme === 'dark'
                      ? 'border-brand bg-brand-soft shadow-sm'
                      : 'border-border bg-background hover:border-brand/50'
                  )}
                >
                  <RadioGroupItem value="dark" className="sr-only" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="size-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Dark</span>
                    </div>
                    {theme === 'dark' && <div className="w-2 h-2 bg-brand rounded-full" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Easy on the eyes in low light</p>
                </label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card>
        <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-soft p-2">
              <Eye className="size-5 text-brand" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-display leading-none">Navigation</h2>
              <p className="text-sm text-muted-foreground mt-1">Control sidebar menu visibility</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div>
                <Label htmlFor="show-all-nav" className="text-sm font-medium">
                  Show all menu items
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Bypass progressive disclosure and show every sidebar item
                </p>
              </div>
            </div>
            <Switch
              id="show-all-nav"
              checked={showAll}
              onCheckedChange={toggleShowAll}
              aria-label="Show all menu items"
            />
          </div>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-soft p-2">
              <Type className="size-5 text-brand" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-display leading-none">Font Size</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Adjust text size for comfortable reading
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6" data-testid="font-size-section">
          <FontSizePicker
            value={settings.fontSize ?? 'medium'}
            onChange={(size: FontSize) => {
              updateAndPersist({ fontSize: size })
              toastSuccess.saved('Font size')
            }}
          />
        </CardContent>
      </Card>

      {/* Display & Accessibility */}
      <DisplayAccessibilitySection
        settings={settings}
        onSettingsChange={updates => updateAndPersist(updates)}
      />

      {/* Reading & Focus Modes */}
      <ReadingFocusModesSection
        settings={settings}
        onSettingsChange={updates => updateAndPersist(updates)}
      />
    </div>
  )
}
