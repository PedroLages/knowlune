import { useEngagementPrefsStore } from '@/stores/useEngagementPrefsStore'

export type EngagementFeature = 'achievements' | 'streaks' | 'badges' | 'animations'

/**
 * Returns whether a specific engagement feature is enabled.
 * Uses Zustand selector for optimal re-render performance —
 * components only re-render when their specific feature toggles.
 */
export function useEngagementVisible(feature: EngagementFeature): boolean {
  return useEngagementPrefsStore(state => state[feature])
}
