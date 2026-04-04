/**
 * Focus mode custom event helpers for auto-activation.
 *
 * Quiz, Flashcard, and InterleavedReview components dispatch these events;
 * useFocusMode() listens and reacts. Uses window CustomEvent for
 * cross-component communication (same pattern as `settingsUpdated`).
 *
 * @module focusModeEvents
 * @since E65-S04
 */

import type { FocusTargetType } from '@/hooks/useFocusMode'

export interface FocusRequestDetail {
  targetId: string
  type: FocusTargetType
}

/**
 * Dispatch a focus-request event to auto-activate focus mode.
 * The useFocusMode hook listens for this on `window`.
 */
export function dispatchFocusRequest(targetId: string, type: FocusTargetType): void {
  const detail: FocusRequestDetail = { targetId, type }
  window.dispatchEvent(new CustomEvent('focus-request', { detail }))
}

/**
 * Dispatch a focus-release event to auto-deactivate focus mode.
 */
export function dispatchFocusRelease(): void {
  window.dispatchEvent(new CustomEvent('focus-release'))
}
