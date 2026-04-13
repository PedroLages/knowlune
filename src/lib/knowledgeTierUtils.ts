/**
 * Shared knowledge tier utilities (E56-S03)
 *
 * Centralises tier badge classes and labels so that
 * KnowledgeMapWidget and FocusAreasPanel stay in sync.
 */

import type { KnowledgeTier } from '@/lib/knowledgeScore'

/** Returns Tailwind class string for a tier badge. */
export function tierBadgeClass(tier: KnowledgeTier): string {
  switch (tier) {
    case 'strong':
      return 'bg-success/15 text-success border-success/30'
    case 'fading':
      return 'bg-warning/15 text-warning border-warning/30'
    case 'weak':
      return 'bg-destructive/15 text-destructive border-destructive/30'
  }
}

/** Returns human-readable label for a tier. */
export function tierLabel(tier: KnowledgeTier): string {
  switch (tier) {
    case 'strong':
      return 'Strong'
    case 'fading':
      return 'Fading'
    case 'weak':
      return 'Weak'
  }
}

export { getKnowledgeTier as getTierFromScore } from '@/lib/knowledgeScore'
