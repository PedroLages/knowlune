import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { type FontSize, FONT_SIZE_PX } from '@/lib/settings'

const SIZES: FontSize[] = ['x-small', 'small', 'medium', 'large', 'extra-large']

interface FontSizePickerProps {
  value: FontSize
  onChange: (size: FontSize) => void
}

export function FontSizePicker({ value, onChange }: FontSizePickerProps) {
  const [localIndex, setLocalIndex] = useState<number | null>(null)
  const currentIndex = localIndex ?? SIZES.indexOf(value)
  const previewSize = SIZES[currentIndex]

  function handleSliderChange(idx: number) {
    setLocalIndex(idx)
  }

  function handleSliderCommit() {
    if (localIndex !== null) {
      onChange(SIZES[localIndex])
      setLocalIndex(null)
    }
  }

  function nudge(delta: number) {
    const newIdx = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(value) + delta))
    onChange(SIZES[newIdx])
  }

  return (
    <div className="space-y-8">
      {/* Slider with +/- buttons */}
      <div className="flex items-center gap-4 px-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={value === SIZES[0]}
          className="flex items-center justify-center size-9 rounded-full bg-muted hover:bg-muted-foreground/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
          aria-label="Decrease font size"
        >
          <Minus className="size-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-medium text-muted-foreground select-none" aria-hidden="true">
          A
        </span>
        <input
          type="range"
          min={0}
          max={SIZES.length - 1}
          step={1}
          value={currentIndex}
          onChange={e => handleSliderChange(Number(e.target.value))}
          onMouseUp={handleSliderCommit}
          onTouchEnd={handleSliderCommit}
          onKeyUp={handleSliderCommit}
          className="apple-slider flex-1 cursor-pointer"
          aria-label="Font size"
          aria-valuetext={`${SIZES[currentIndex]} (${FONT_SIZE_PX[previewSize]}px)`}
        />
        <span className="text-2xl font-medium text-foreground select-none" aria-hidden="true">
          A
        </span>
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={value === SIZES[SIZES.length - 1]}
          className="flex items-center justify-center size-9 rounded-full bg-muted hover:bg-muted-foreground/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
          aria-label="Increase font size"
        >
          <Plus className="size-4 text-muted-foreground" />
        </button>
      </div>

      {/* Live preview text — uses local preview size to avoid global reflow */}
      <div
        className="rounded-xl bg-muted/30 p-6 text-center"
        aria-live="polite"
        aria-label="Font size preview"
      >
        <p
          className="text-foreground leading-relaxed"
          style={{ fontSize: `${FONT_SIZE_PX[previewSize]}px` }}
        >
          This is a preview of how the reading experience will look. Adjust the slider above to find
          the size that feels most comfortable for your eyes during long study sessions.
        </p>
      </div>
    </div>
  )
}
