/**
 * TutorModeChips (E57-S04, extended E73-S01)
 *
 * Horizontal chip group for switching between all 5 tutor modes.
 * Uses design tokens, icons, tooltips, and full accessibility (radiogroup).
 */

import { useCallback, useRef } from 'react'
import { HelpCircle, BookOpen, Lightbulb, ClipboardCheck, Bug } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip'
import type { TutorMode } from '@/ai/tutor/types'
import { MODE_REGISTRY, getModeKeys } from '@/ai/prompts/modeRegistry'
import type { LucideIcon } from 'lucide-react'

interface TutorModeChipsProps {
  mode: TutorMode
  onModeChange: (mode: TutorMode) => void
  disabled?: boolean
  /** Whether transcript is available (controls quiz/debug chip state) */
  hasTranscript?: boolean
}

const MODE_ICONS: Record<TutorMode, LucideIcon> = {
  socratic: HelpCircle,
  explain: BookOpen,
  eli5: Lightbulb,
  quiz: ClipboardCheck,
  debug: Bug,
}

const MODE_ORDER = getModeKeys()

export function TutorModeChips({
  mode,
  onModeChange,
  disabled,
  hasTranscript = false,
}: TutorModeChipsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = MODE_ORDER.indexOf(mode)
      let nextIndex = currentIndex

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        nextIndex = (currentIndex + 1) % MODE_ORDER.length
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        nextIndex = (currentIndex - 1 + MODE_ORDER.length) % MODE_ORDER.length
      } else {
        return
      }

      const nextMode = MODE_ORDER[nextIndex]
      const config = MODE_REGISTRY[nextMode]

      // Skip disabled modes
      if (config.requiresTranscript && !hasTranscript) {
        // Find next non-disabled mode in same direction
        const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
        for (let i = 1; i < MODE_ORDER.length; i++) {
          const idx = (currentIndex + direction * i + MODE_ORDER.length) % MODE_ORDER.length
          const candidateConfig = MODE_REGISTRY[MODE_ORDER[idx]]
          if (!candidateConfig.requiresTranscript || hasTranscript) {
            nextIndex = idx
            break
          }
        }
      }

      const finalMode = MODE_ORDER[nextIndex]
      onModeChange(finalMode)

      // Focus the newly selected chip
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      buttons?.[nextIndex]?.focus()
    },
    [mode, onModeChange, hasTranscript]
  )

  return (
    <TooltipProvider delayDuration={300}>
    <div
      ref={containerRef}
      className="flex items-center gap-1.5 overflow-x-auto max-sm:pb-1"
      role="radiogroup"
      aria-label="Tutoring mode"
      onKeyDown={handleKeyDown}
    >
      {MODE_ORDER.map((modeKey) => {
        const config = MODE_REGISTRY[modeKey]
        const Icon = MODE_ICONS[modeKey]
        const isSelected = mode === modeKey
        const isTranscriptDisabled = config.requiresTranscript && !hasTranscript
        const isChipDisabled = disabled || isTranscriptDisabled

        const tooltipText = isTranscriptDisabled
          ? 'Requires transcript'
          : config.description

        return (
          <Tooltip key={modeKey}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-disabled={isChipDisabled || undefined}
                disabled={isChipDisabled}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onModeChange(modeKey)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap',
                  'min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-1',
                  isSelected
                    ? 'border-brand bg-brand text-brand-foreground'
                    : 'border-border bg-transparent text-muted-foreground hover:border-brand/50 hover:text-foreground',
                  isChipDisabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {config.label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{tooltipText}</p>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
    </TooltipProvider>
  )
}
