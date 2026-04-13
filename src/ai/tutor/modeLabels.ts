/**
 * Mode label lookup for tutor modes (E72-S02)
 *
 * Minimal label map used by MessageBubble mode badges.
 * Will be replaced by MODE_REGISTRY in E73-S01.
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
