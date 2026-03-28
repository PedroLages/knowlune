import { supabase } from '@/lib/auth/supabase'

const STORAGE_KEY = 'app-settings'

export type FontSize = 'small' | 'medium' | 'large' | 'extra-large'
export type AgeRange = 'gen-z' | 'millennial' | 'boomer' | 'prefer-not-to-say'
export type ContentDensity = 'default' | 'spacious'
export type ReduceMotion = 'system' | 'on' | 'off'

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
   * Profile photo URL — data URL (uploads), object URL (temp), or HTTPS URL (Google OAuth).
   * @optional - undefined if no profile photo has been set
   */
  profilePhotoUrl?: string
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
  /** Whether to use Atkinson Hyperlegible font for improved readability. */
  accessibilityFont: boolean
  /** Content area density: 'default' or 'spacious' (increased padding/gap/line-height). */
  contentDensity: ContentDensity
  /** Motion preference: 'system' (follow OS), 'on' (reduce), 'off' (allow all). */
  reduceMotion: ReduceMotion
}

export const DISPLAY_DEFAULTS = {
  accessibilityFont: false as const,
  contentDensity: 'default' as ContentDensity,
  reduceMotion: 'system' as ReduceMotion,
}

const defaults: AppSettings = {
  displayName: 'Student',
  bio: '',
  theme: 'system',
  profilePhotoUrl: undefined,
  colorScheme: 'professional',
  accessibilityFont: false,
  contentDensity: 'default',
  reduceMotion: 'system',
}

const VALID_CONTENT_DENSITY: ContentDensity[] = ['default', 'spacious']
const VALID_REDUCE_MOTION: ReduceMotion[] = ['system', 'on', 'off']

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const parsed = { ...defaults, ...JSON.parse(raw) }
    // Sanitize enum-like fields to prevent corrupted localStorage from propagating
    if (!VALID_REDUCE_MOTION.includes(parsed.reduceMotion)) {
      parsed.reduceMotion = defaults.reduceMotion
    }
    if (!VALID_CONTENT_DENSITY.includes(parsed.contentDensity)) {
      parsed.contentDensity = defaults.contentDensity
    }
    if (typeof parsed.accessibilityFont !== 'boolean') {
      parsed.accessibilityFont = defaults.accessibilityFont
    }
    return parsed
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(
  settings: Partial<AppSettings>,
  options?: { syncToSupabase?: boolean }
): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

  // Sync profile fields to Supabase user_metadata (offline-first: localStorage is primary)
  if (options?.syncToSupabase !== false && supabase) {
    const profileFields: Record<string, unknown> = {}
    if ('displayName' in settings) profileFields.displayName = updated.displayName
    if ('bio' in settings) profileFields.bio = updated.bio
    // TODO: Avatar sync — Supabase user_metadata has 1MB limit, so large base64 avatars
    // should stay local. Migrate to Supabase Storage in a future epic for cloud avatar sync.

    if (Object.keys(profileFields).length > 0) {
      // Fire-and-forget — localStorage is source of truth, Supabase is best-effort sync
      supabase.auth.updateUser({ data: profileFields }).catch(err => {
        // silent-catch-ok — offline-first: local save succeeded, Supabase sync is non-blocking
        console.warn('[settings] Supabase profile sync failed:', err)
      })
    }
  }

  return updated
}

/**
 * Hydrate localStorage settings from Supabase user_metadata on login.
 * Only overwrites displayName/bio if Supabase has data and localStorage is at defaults.
 * Called from the auth state listener in App.tsx.
 */
export function hydrateSettingsFromSupabase(
  userMetadata: Record<string, unknown> | undefined
): void {
  if (!userMetadata) return

  const current = getSettings()
  const updates: Partial<AppSettings> = {}

  // Only hydrate if Supabase has data AND localStorage is at defaults (or empty)

  // displayName: custom metadata 'displayName' > Google 'full_name' > default "Student"
  if (current.displayName === defaults.displayName || current.displayName === '') {
    if (typeof userMetadata.displayName === 'string' && userMetadata.displayName.length > 0) {
      updates.displayName = userMetadata.displayName
    } else if (typeof userMetadata.full_name === 'string' && userMetadata.full_name.length > 0) {
      updates.displayName = userMetadata.full_name as string
    }
  }

  if (
    typeof userMetadata.bio === 'string' &&
    userMetadata.bio.length > 0 &&
    (current.bio === defaults.bio || current.bio === '')
  ) {
    updates.bio = userMetadata.bio
  }

  // profilePhotoUrl: custom upload (data: URL) > Google avatar (https: URL) > initials fallback
  // Only hydrate if no custom photo is set (custom photos use data: URLs)
  if (!current.profilePhotoUrl || !current.profilePhotoUrl.startsWith('data:')) {
    // Try avatar_url first, then fall back to picture (both are Google-provided)
    const avatarUrl = userMetadata.avatar_url ?? userMetadata.picture
    if (typeof avatarUrl === 'string' && avatarUrl.startsWith('https://')) {
      updates.profilePhotoUrl = avatarUrl
    }
  }

  if (Object.keys(updates).length > 0) {
    // Save without syncing back to Supabase (data came from there)
    saveSettings(updates, { syncToSupabase: false })
    window.dispatchEvent(new Event('settingsUpdated'))
  }
}

/**
 * Resolves whether motion should be reduced based on app setting + OS preference.
 * Usable from non-React contexts (plain functions, event handlers, etc.).
 * For React components, prefer the `useReducedMotion` hook.
 *
 * - 'on': always reduce (app override)
 * - 'off': never reduce (app override)
 * - 'system': follow OS `prefers-reduced-motion` media query
 */
export function shouldReduceMotion(): boolean {
  const pref = getSettings().reduceMotion
  if (pref === 'on') return true
  if (pref === 'off') return false
  // 'system' — follow OS
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
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
