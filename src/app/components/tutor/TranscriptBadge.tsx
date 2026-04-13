/**
 * TranscriptBadge (E57-S01)
 *
 * Displays transcript grounding status in the tutor chat.
 * Three variants: grounded (success), general (warning), unavailable (destructive).
 */

import { CheckCircle, AlertTriangle } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import type { TranscriptStatus } from '@/ai/tutor/types'

interface TranscriptBadgeProps {
  status: TranscriptStatus
}

export function TranscriptBadge({ status }: TranscriptBadgeProps) {
  if (status.available) {
    return (
      <Badge
        variant="outline"
        className="border-success text-success gap-1.5"
        aria-label={`Transcript status: ${status.label}`}
      >
        <CheckCircle className="size-3" aria-hidden="true" />
        {status.label}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="border-warning text-warning gap-1.5"
      aria-label={`Transcript status: ${status.label}`}
    >
      <AlertTriangle className="size-3" aria-hidden="true" />
      {status.label}
    </Badge>
  )
}
