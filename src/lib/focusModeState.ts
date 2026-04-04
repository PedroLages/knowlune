/**
 * Global focus mode state — singleton readable from non-React contexts.
 *
 * useFocusMode() calls setFocusModeActive/setFocusModeInactive to keep
 * this in sync. NotificationService reads isFocusModeActive() to decide
 * whether to suppress non-critical notifications.
 *
 * @module focusModeState
 * @since E65-S04
 */

let _isFocusModeActive = false

export function setFocusModeActive(): void {
  _isFocusModeActive = true
}

export function setFocusModeInactive(): void {
  _isFocusModeActive = false
}

export function isFocusModeActive(): boolean {
  return _isFocusModeActive
}
