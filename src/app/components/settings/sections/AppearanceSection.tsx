import { Check } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
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
    <div className="space-y-8">
      {/* 1. Theme Mode */}
      <section>
        <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Theme Mode
        </h4>
        <div className="bg-card rounded-xl shadow-sm p-6">
          <RadioGroup value={theme} onValueChange={setTheme} aria-label="Theme">
            <div className="grid grid-cols-3 gap-4">
              {/* System */}
              <label className="flex flex-col items-center gap-3 cursor-pointer group">
                <RadioGroupItem value="system" className="sr-only" />
                <div
                  className={cn(
                    'relative w-full aspect-[4/5] rounded-xl overflow-hidden',
                    'border-2 transition-all',
                    theme === 'system'
                      ? 'border-brand shadow-md shadow-brand/10'
                      : 'border-border hover:border-brand/30'
                  )}
                >
                  {/* Hardcoded: top=light, bottom=dark to represent System (auto) */}
                  <div className="absolute inset-0 flex flex-col">
                    <div className="h-1/2 bg-[#e9e7e4]" />
                    <div className="h-1/2 bg-[#1a1b26]" />
                  </div>
                  <div className="absolute inset-0 p-3 flex flex-col gap-2">
                    <div className="h-2 w-12 bg-[#656870]/30 rounded-full" />
                    <div className="h-4 w-full bg-[#656870]/20 rounded-lg" />
                    <div className="h-4 w-2/3 bg-[#656870]/20 rounded-lg" />
                  </div>
                  {theme === 'system' && (
                    <div className="absolute top-2 right-2 size-5 bg-brand rounded-full flex items-center justify-center">
                      <Check className="size-3 text-brand-foreground" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium">System</span>
              </label>

              {/* Light */}
              <label className="flex flex-col items-center gap-3 cursor-pointer group">
                <RadioGroupItem value="light" className="sr-only" />
                <div
                  className={cn(
                    'relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-[#e9e7e4]',
                    'border-2 transition-all',
                    theme === 'light'
                      ? 'border-brand shadow-md shadow-brand/10'
                      : 'border-border hover:border-brand/30'
                  )}
                >
                  {/* Hardcoded: light theme preview always shows light colors */}
                  <div className="absolute inset-0 p-3 flex flex-col gap-2">
                    <div className="h-2 w-12 bg-[#656870]/30 rounded-full" />
                    <div className="h-4 w-full bg-[#656870]/15 rounded-lg" />
                    <div className="h-4 w-2/3 bg-[#656870]/15 rounded-lg" />
                  </div>
                  {theme === 'light' && (
                    <div className="absolute top-2 right-2 size-5 bg-brand rounded-full flex items-center justify-center">
                      <Check className="size-3 text-brand-foreground" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium">Light</span>
              </label>

              {/* Dark */}
              <label className="flex flex-col items-center gap-3 cursor-pointer group">
                <RadioGroupItem value="dark" className="sr-only" />
                <div
                  className={cn(
                    'relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-[#1a1b26]',
                    'border-2 transition-all',
                    theme === 'dark'
                      ? 'border-brand shadow-md shadow-brand/10'
                      : 'border-border hover:border-brand/30'
                  )}
                >
                  {/* Hardcoded: dark theme preview always shows dark colors */}
                  <div className="absolute inset-0 p-3 flex flex-col gap-2">
                    <div className="h-2 w-12 bg-[#b2b5c8]/30 rounded-full" />
                    <div className="h-4 w-full bg-[#b2b5c8]/15 rounded-lg" />
                    <div className="h-4 w-2/3 bg-[#b2b5c8]/15 rounded-lg" />
                  </div>
                  {theme === 'dark' && (
                    <div className="absolute top-2 right-2 size-5 bg-brand rounded-full flex items-center justify-center">
                      <Check className="size-3 text-brand-foreground" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium">Dark</span>
              </label>
            </div>
          </RadioGroup>
        </div>
      </section>

      {/* 2. Reading Themes + Reading Mode (circles, font size, line height) */}
      <ReadingFocusModesSection
        settings={settings}
        onSettingsChange={updates => updateAndPersist(updates)}
      />

      {/* 3. Text Size */}
      <section>
        <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Text Size
        </h4>
        <div className="bg-card rounded-xl shadow-sm p-6" data-testid="font-size-section">
          <FontSizePicker
            value={settings.fontSize ?? 'medium'}
            onChange={(size: FontSize) => {
              updateAndPersist({ fontSize: size })
              toastSuccess.saved('Font size')
            }}
          />
        </div>
      </section>

      {/* 4. Navigation */}
      <section>
        <h4 className="px-1 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Navigation
        </h4>
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors">
            <div>
              <Label htmlFor="show-all-nav" className="text-sm font-medium">
                Show all menu items
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bypass progressive disclosure and show every sidebar item
              </p>
            </div>
            <Switch
              id="show-all-nav"
              checked={showAll}
              onCheckedChange={toggleShowAll}
              aria-label="Show all menu items"
            />
          </div>
        </div>
      </section>

      {/* 5. Display & Accessibility */}
      <DisplayAccessibilitySection
        settings={settings}
        onSettingsChange={updates => updateAndPersist(updates)}
      />
    </div>
  )
}
