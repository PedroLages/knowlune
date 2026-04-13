/**
 * ModeTransitionMessage (E73-S01)
 *
 * UI-only divider shown between messages with different mode tags.
 * Not stored in the messages array — rendered inline by MessageList.
 */

import { MODE_REGISTRY } from '@/ai/prompts/modeRegistry'
import type { TutorMode } from '@/ai/tutor/types'

interface ModeTransitionMessageProps {
  /** The new mode being transitioned to */
  newMode: TutorMode
}

export function ModeTransitionMessage({ newMode }: ModeTransitionMessageProps) {
  const label = MODE_REGISTRY[newMode].label

  return (
    <div className="flex items-center gap-3 my-3" aria-label={`Switched to ${label} mode`}>
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground italic whitespace-nowrap">
        Switched to {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
