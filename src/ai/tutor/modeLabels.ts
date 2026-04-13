/**
 * Mode label lookup for tutor modes (E72-S02)
 *
 * Minimal label map used by MessageBubble mode badges.
 * TODO(E73-S01): replace with MODE_REGISTRY when available
 */

import type { TutorMode } from './types'

/** Human-readable labels for each tutor mode */
export const MODE_LABELS: Record<TutorMode, string> = {
  socratic: 'Socratic',
  explain: 'Explain',
  quiz: 'Quiz',
  eli5: 'ELI5',
  debug: 'Debug',
}
