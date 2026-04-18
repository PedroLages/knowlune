const HINT_DISMISS_KEY = 'knowlune.searchPrefixHintDismissed.v1'

export function readHintDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_DISMISS_KEY) === 'true'
  } catch {
    // silent-catch-ok: locked-down browser contexts
    return false
  }
}

export function writeHintDismissed(): void {
  try {
    localStorage.setItem(HINT_DISMISS_KEY, 'true')
  } catch {
    // silent-catch-ok: quota / disabled storage
  }
}
