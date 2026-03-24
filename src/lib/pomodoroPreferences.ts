/**
 * Pomodoro timer preferences — persisted in localStorage.
 *
 * Separate key from AppSettings to keep concerns isolated.
 * Follows the same pattern as `STORAGE_KEY_PLAYBACK_SPEED` in VideoPlayer.
 */

export interface PomodoroPreferences {
  focusDuration: number // minutes (default: 25)
  breakDuration: number // minutes (default: 5)
  autoStartBreak: boolean // default: true
  autoStartFocus: boolean // default: false
  notificationVolume: number // 0-1 (default: 0.5)
}

const STORAGE_KEY = 'pomodoro-preferences'

const defaults: PomodoroPreferences = {
  focusDuration: 25,
  breakDuration: 5,
  autoStartBreak: true,
  autoStartFocus: false,
  notificationVolume: 0.5,
}

export function getPomodoroPreferences(): PomodoroPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<PomodoroPreferences>
    return { ...defaults, ...parsed }
  } catch {
    return { ...defaults }
  }
}

export function savePomodoroPreferences(
  prefs: Partial<PomodoroPreferences>
): PomodoroPreferences {
  const current = getPomodoroPreferences()
  const merged = { ...current, ...prefs }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // localStorage full or blocked — silently degrade
  }
  return merged
}
