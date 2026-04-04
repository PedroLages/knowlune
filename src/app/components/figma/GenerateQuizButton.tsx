/**
 * GenerateQuizButton — CTA to trigger quiz generation from lesson transcript.
 *
 * Features:
 * - Brand-variant button with WCAG AA accessible states
 * - Disabled with tooltip when Ollama is offline
 * - Loading skeleton during generation (15-40s)
 * - ARIA live region for screen reader announcements
 * - Bloom's level picker (Select dropdown)
 * - Switches to "Regenerate" when cached quiz exists
 *
 * @see E52-S02 Quiz Generation UI
 */

import { useState } from 'react'
import { BrainCircuit, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import type { BloomsLevel } from '@/ai/quizPrompts'
import type { Quiz } from '@/types/quiz'

interface GenerateQuizButtonProps {
  /** Whether quiz generation is in progress */
  isGenerating: boolean
  /** Whether the Ollama server is available */
  ollamaAvailable: boolean
  /** Whether availability is still being checked */
  checkingAvailability: boolean
  /** Previously cached quiz (shows "Regenerate" if present) */
  cachedQuiz: Quiz | null
  /** Callback to trigger generation with selected Bloom's level */
  onGenerate: (bloomsLevel: BloomsLevel) => void
  /** Callback to trigger regeneration (new quiz, preserves old) */
  onRegenerate?: (bloomsLevel: BloomsLevel) => void
}

const BLOOMS_OPTIONS: { value: BloomsLevel; label: string }[] = [
  { value: 'remember', label: 'Remember' },
  { value: 'understand', label: 'Understand' },
  { value: 'apply', label: 'Apply' },
]

export function GenerateQuizButton({
  isGenerating,
  ollamaAvailable,
  checkingAvailability,
  cachedQuiz,
  onGenerate,
  onRegenerate,
}: GenerateQuizButtonProps) {
  const [bloomsLevel, setBloomsLevel] = useState<BloomsLevel>('remember')

  const isDisabled = !ollamaAvailable || checkingAvailability || isGenerating
  const buttonLabel = cachedQuiz ? 'Regenerate Quiz' : 'Generate Quiz'

  // Loading state: show skeleton with message
  if (isGenerating) {
    return (
      <div data-testid="quiz-generation-loading" className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-4 w-48 rounded" />
        <p className="text-sm text-muted-foreground animate-pulse">
          Generating quiz from transcript...
        </p>
        {/* ARIA live region for screen readers */}
        <div role="status" aria-live="polite" className="sr-only">
          Generating quiz from transcript. This may take 15 to 40 seconds.
        </div>
      </div>
    )
  }

  const button = (
    <Button
      variant="brand"
      className="rounded-xl min-h-[44px] gap-2"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-label={buttonLabel + ' from transcript'}
      onClick={() =>
        cachedQuiz && onRegenerate ? onRegenerate(bloomsLevel) : onGenerate(bloomsLevel)
      }
      data-testid="generate-quiz-button"
    >
      {checkingAvailability ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : cachedQuiz ? (
        <RefreshCw className="size-4" aria-hidden="true" />
      ) : (
        <BrainCircuit className="size-4" aria-hidden="true" />
      )}
      {buttonLabel}
    </Button>
  )

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      data-testid="quiz-generation-controls"
    >
      {/* Bloom's level picker */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="blooms-level-select" className="text-xs font-medium text-muted-foreground">
          Difficulty Level
        </label>
        <Select
          value={bloomsLevel}
          onValueChange={val => setBloomsLevel(val as BloomsLevel)}
          disabled={isDisabled}
        >
          <SelectTrigger
            id="blooms-level-select"
            className="w-[160px] rounded-xl"
            data-testid="blooms-level-select"
          >
            <SelectValue placeholder="Select level" />
          </SelectTrigger>
          <SelectContent>
            {BLOOMS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Button with tooltip when disabled */}
      {!ollamaAvailable && !checkingAvailability ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} role="button" aria-disabled="true">
                {button}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Quiz generation unavailable — Ollama server is offline</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      {/* ARIA live region — idle state */}
      <div role="status" aria-live="polite" className="sr-only">
        {!ollamaAvailable && !checkingAvailability
          ? 'Quiz generation unavailable. Ollama server is offline.'
          : ''}
      </div>
    </div>
  )
}
