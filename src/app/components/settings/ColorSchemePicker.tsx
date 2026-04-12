import { Check } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { cn } from '@/app/components/ui/utils'
import { useEngagementPrefsStore, type ColorScheme } from '@/stores/useEngagementPrefsStore'

const schemePreviewColors = {
  professional: {
    bg: '#faf5ee',
    sidebar: '#fbfbfb',
    brand: '#5e6ad2',
    muted: '#e9e7e4',
    text: '#656870',
  },
  vibrant: {
    bg: '#faf5ee',
    sidebar: '#fbfbfb',
    brand: '#4a54d4',
    muted: '#e9e7e4',
    text: '#656870',
  },
  clean: {
    bg: '#f9f9fe',
    sidebar: '#ebeef7',
    brand: '#005bc1',
    muted: '#dce3f0',
    text: '#595f6a',
  },
} as const

const schemeOptions: { value: ColorScheme; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional', description: 'Warm tones, muted palette' },
  { value: 'vibrant', label: 'Vibrant', description: 'High-contrast, energized colors' },
  { value: 'clean', label: 'Clean', description: 'Cool white, Apple-inspired' },
]

export function ColorSchemePicker() {
  const colorScheme = useEngagementPrefsStore(s => s.colorScheme)
  const setPreference = useEngagementPrefsStore(s => s.setPreference)

  return (
    <RadioGroup
      value={colorScheme}
      onValueChange={(value: string) => setPreference('colorScheme', value as ColorScheme)}
      aria-label="Color scheme"
      className="grid grid-cols-3 gap-4"
      data-testid="color-scheme-picker"
    >
      {schemeOptions.map(({ value, label, description }) => {
        const colors = schemePreviewColors[value]
        const isSelected = colorScheme === value
        return (
          <label key={value} className="flex flex-col items-center gap-3 cursor-pointer group">
            <RadioGroupItem value={value} className="sr-only" />
            <div
              className={cn(
                'relative w-full aspect-[4/3] rounded-xl overflow-hidden',
                'border-2 transition-all',
                isSelected
                  ? 'border-brand shadow-md shadow-brand/10'
                  : 'border-border hover:border-brand/30'
              )}
            >
              {/* Mini layout preview */}
              <div className="absolute inset-0 flex" style={{ backgroundColor: colors.bg }}>
                {/* Sidebar strip */}
                <div
                  className="w-[20%] h-full flex flex-col items-center gap-1.5 pt-3"
                  style={{ backgroundColor: colors.sidebar }}
                >
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.brand }} />
                  <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors.muted }} />
                  <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors.muted }} />
                  <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors.muted }} />
                </div>
                {/* Content area */}
                <div className="flex-1 p-2.5 flex flex-col gap-1.5">
                  <div
                    className="h-1.5 w-2/3 rounded-full"
                    style={{ backgroundColor: colors.text, opacity: 0.3 }}
                  />
                  <div
                    className="h-2.5 w-full rounded"
                    style={{ backgroundColor: colors.brand, opacity: 0.15 }}
                  />
                  <div className="flex gap-1.5 mt-0.5">
                    <div className="h-6 flex-1 rounded" style={{ backgroundColor: colors.muted }} />
                    <div className="h-6 flex-1 rounded" style={{ backgroundColor: colors.muted }} />
                  </div>
                  <div
                    className="h-1 w-1/2 rounded-full mt-auto"
                    style={{ backgroundColor: colors.brand }}
                  />
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 size-5 bg-brand rounded-full flex items-center justify-center">
                  <Check className="size-3 text-brand-foreground" strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="text-center">
              <span className="text-sm font-medium">{label}</span>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {description}
              </p>
            </div>
          </label>
        )
      })}
    </RadioGroup>
  )
}
