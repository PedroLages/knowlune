const STORAGE_KEY = 'app-settings'

export type FontSize = 'small' | 'medium' | 'large' | 'extra-large'
export type AgeRange = 'gen-z' | 'millennial' | 'boomer' | 'prefer-not-to-say'

/** Maps font size labels to root font-size pixel values */
export const FONT_SIZE_PX: Record<FontSize, number> = {
  small: 14,
  medium: 16,
  large: 18,
  'extra-large': 20,
}

export interface AppSettings {
  displayName: string
  bio: string
  theme: 'light' | 'dark' | 'system'
  /**
   * Base64-encoded data URL or object URL of the user's profile photo.
   * Stored as a data URL (e.g., "data:image/png;base64,...") for persistence,
   * or as an object URL for temporary session storage.
   * @optional - undefined if no profile photo has been set
   */
  profilePhotoDataUrl?: string
  /** User-selected font size for proportional scaling. Default: 'medium' (16px) */
  fontSize?: FontSize
  /** Age range selected in welcome wizard. Stored locally, never sent to server. */
  ageRange?: AgeRange
  /**
   * Color scheme preference: 'professional' (default muted palette) or
   * 'vibrant' (higher saturation, Gen Z energy boost).
   * Vibrant mode applies a `.vibrant` class on <html> that overrides
   * design tokens in theme.css with more saturated OKLCH values.
   * UI toggle ships in E21-S05; this story (E21-S04) provides the tokens + hook.
   */
  colorScheme: 'professional' | 'vibrant'
}

const defaults: AppSettings = {
  displayName: 'Student',
  bio: '',
  theme: 'system',
  profilePhotoDataUrl: undefined,
  colorScheme: 'professional',
}

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function exportAllData(): string {
  const data: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key)!)
      } catch {
        data[key] = localStorage.getItem(key)
      }
    }
  }
  return JSON.stringify(data, null, 2)
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json) as Record<string, unknown>
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    }
    return true
  } catch {
    return false
  }
}

export function resetAllData() {
  localStorage.clear()
}
