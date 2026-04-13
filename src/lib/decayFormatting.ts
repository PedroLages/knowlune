/**
 * Shared decay date formatting utilities (E62-S02).
 *
 * Extracted from TopicTreemap and TopicDetailPopover to eliminate duplication.
 * Single source of truth for 7-day / 30-day threshold logic.
 */

import { format } from 'date-fns'

export interface DecayInfo {
  label: string
  /** Tailwind color class for the label */
  colorClass: 'text-destructive' | 'text-warning' | 'text-success'
}

/**
 * Calculate days until a decay date from a reference point.
 * Returns a negative number if the date is already in the past.
 */
export function daysUntilDecay(predictedDecayDate: string, now: Date = new Date()): number {
  const decayDate = new Date(predictedDecayDate)
  return Math.ceil((decayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Format a predicted decay date into a human-readable label and color class.
 *
 * Thresholds:
 * - already past  → "Already fading"      (destructive)
 * - < 7 days      → "Fading in N days"    (destructive)
 * - 7 – 30 days   → "Fading by Mon Day"   (warning)
 * - > 30 days     → "Stable until Mon Day" (success)
 *
 * @param predictedDecayDate ISO date string or null
 * @param now Optional reference date (defaults to current date — pass in tests for determinism)
 */
export function formatDecayLabel(predictedDecayDate: string | null, now?: Date): DecayInfo | null {
  if (!predictedDecayDate) return null

  const _now = now ?? new Date()
  const decayDate = new Date(predictedDecayDate)
  const days = daysUntilDecay(predictedDecayDate, _now)

  if (days < 0) {
    return { label: 'Already fading', colorClass: 'text-destructive' }
  }
  if (days < 7) {
    return {
      label: `Fading in ${days} day${days !== 1 ? 's' : ''}`,
      colorClass: 'text-destructive',
    }
  }
  if (days <= 30) {
    return {
      label: `Fading by ${format(decayDate, 'MMM d')}`,
      colorClass: 'text-warning',
    }
  }
  return {
    label: `Stable until ${format(decayDate, 'MMM d')}`,
    colorClass: 'text-success',
  }
}
