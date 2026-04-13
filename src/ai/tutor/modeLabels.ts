/**
 * Mode label lookup for tutor modes (E72-S02, updated E73-S01)
 *
 * Derives labels from MODE_REGISTRY — single source of truth.
 */

import type { TutorMode } from './types'
import { MODE_REGISTRY } from '@/ai/prompts/modeRegistry'

/** Human-readable labels for each tutor mode (derived from MODE_REGISTRY) */
export const MODE_LABELS: Record<TutorMode, string> = Object.fromEntries(
  Object.entries(MODE_REGISTRY).map(([key, config]) => [key, config.label])
) as Record<TutorMode, string>
