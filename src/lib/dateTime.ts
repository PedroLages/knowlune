import type { DayOfWeek } from '@/data/types'

/**
 * Shared short-form day-of-week labels.
 * Used by schedule lists, study summaries, and feed previews.
 */
export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}
