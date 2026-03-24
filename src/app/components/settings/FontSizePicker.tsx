import { cn } from '@/app/components/ui/utils'
import { type FontSize, FONT_SIZE_PX } from '@/lib/settings'

const FONT_SIZE_OPTIONS: { value: FontSize; label: string; description: string }[] = [
  { value: 'small', label: 'Small', description: '14px — Compact view' },
  { value: 'medium', label: 'Medium', description: '16px — Default' },
  { value: 'large', label: 'Large', description: '18px — Easier reading' },
  { value: 'extra-large', label: 'Extra Large', description: '20px — Maximum comfort' },
]

interface FontSizePickerProps {
  value: FontSize
  onChange: (size: FontSize) => void
}

export function FontSizePicker({ value, onChange }: FontSizePickerProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="radiogroup" aria-label="Font size">
        {FONT_SIZE_OPTIONS.map(option => {
          const isSelected = value === option.value
          const px = FONT_SIZE_PX[option.value]
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-4 border-2 rounded-xl cursor-pointer',
                'transition-all duration-200 hover:shadow-sm min-h-[44px]',
                isSelected
                  ? 'border-brand bg-brand-soft shadow-sm'
                  : 'border-border bg-background hover:border-brand/50'
              )}
            >
              {/* Preview letter scaled to the font size */}
              <span
                className="font-display font-medium text-foreground leading-none"
                style={{ fontSize: `${px}px` }}
                aria-hidden="true"
              >
                Aa
              </span>
              <span className="text-xs font-medium">{option.label}</span>
              <span className="text-[10px] text-muted-foreground">{px}px</span>
              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-brand rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Live preview text */}
      <div
        className="rounded-xl border border-border bg-surface-sunken/30 p-4"
        aria-live="polite"
        aria-label="Font size preview"
      >
        <p className="text-muted-foreground text-xs mb-2">Preview</p>
        <p
          className="text-foreground leading-relaxed"
          style={{ fontSize: `${FONT_SIZE_PX[value]}px` }}
        >
          The quick brown fox jumps over the lazy dog.
        </p>
      </div>
    </div>
  )
}
