import { supabase } from '@/lib/auth/supabase'

const STORAGE_KEY = 'app-settings'

export type FontSize = 'x-small' | 'small' | 'medium' | 'large' | 'extra-large'
export type ContentDensity = 'default' | 'spacious'
export type ReduceMotion = 'system' | 'on' | 'off'
export type ReadingFontSize = '1x' | '1.25x' | '1.5x' | '2x'
export type ReadingLineHeight = 1.5 | 1.75 | 2.0
export type ReadingTheme = 'auto' | 'sepia' | 'gray' | 'dark' | 'high-contrast'

/** Maps font size labels to root font-size pixel values */
export const FONT_SIZE_PX: Record<FontSize, number> = {
  'x-small': 12,
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
  /**
   * Color scheme preference: 'professional' (default muted palette) or
   * 'vibrant' (higher saturation, Gen Z energy boost).
   * Vibrant mode applies a `.vibrant` class on <html> that overrides
   * design tokens in theme.css with more saturated OKLCH values.
   * UI toggle ships in E21-S05; this story (E21-S04) provides the tokens + hook.
   */
  colorScheme: 'professional' | 'vibrant' | 'clean'
  /** Whether to use Atkinson Hyperlegible font for improved readability. */
  accessibilityFont: boolean
  /** Content area density: 'default' or 'spacious' (increased padding/gap/line-height). */
  contentDensity: ContentDensity
  /** Motion preference: 'system' (follow OS), 'on' (reduce), 'off' (allow all). */
  reduceMotion: ReduceMotion
  /** Auto-activate focus mode when starting a quiz. Default: true. */
  focusAutoQuiz?: boolean
  /** Auto-activate focus mode when starting a flashcard review. Default: true. */
  focusAutoFlashcard?: boolean
  /** Reading mode default font size. Default: '1x'. */
  readingFontSize?: ReadingFontSize
  /** Reading mode default line height. Default: 1.5. */
  readingLineHeight?: ReadingLineHeight
  /** Reading mode default theme. Default: 'auto'. */
  readingTheme?: ReadingTheme
  /**
   * Whether cloud auto-sync is enabled. Default: true (undefined treated as true
   * for backward compatibility with pre-E97 localStorage payloads).
   *
   * E97-S02: persisted to localStorage only — NOT synced to Supabase
   * (intentional: avoids the "sync the sync setting" chicken-and-egg problem;
   * each device controls its own sync posture).
   */
  autoSyncEnabled?: boolean
}

export const DISPLAY_DEFAULTS = {
  accessibilityFont: false as const,
  contentDensity: 'default' as ContentDensity,
  reduceMotion: 'system' as ReduceMotion,
  focusAutoQuiz: true as const,
  focusAutoFlashcard: true as const,
  readingFontSize: '1x' as const,
  readingLineHeight: 1.5 as const,
  readingTheme: 'auto' as const,
}

const defaults: AppSettings = {
  displayName: 'Learner',
  bio: '',
  theme: 'system',
  profilePhotoUrl: undefined,
  colorScheme: 'professional',
  accessibilityFont: false,
  contentDensity: 'default',
  reduceMotion: 'system',
  focusAutoQuiz: true,
  focusAutoFlashcard: true,
  readingFontSize: '1x',
  readingLineHeight: 1.5,
  readingTheme: 'auto',
  autoSyncEnabled: true,
}

const VALID_CONTENT_DENSITY: ContentDensity[] = ['default', 'spacious']
const VALID_REDUCE_MOTION: ReduceMotion[] = ['system', 'on', 'off']
const VALID_READING_FONT_SIZE: ReadingFontSize[] = ['1x', '1.25x', '1.5x', '2x']
const VALID_READING_LINE_HEIGHT: ReadingLineHeight[] = [1.5, 1.75, 2.0]
const VALID_READING_THEME: ReadingTheme[] = ['auto', 'sepia', 'gray', 'dark', 'high-contrast']

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
    if (!VALID_READING_FONT_SIZE.includes(parsed.readingFontSize)) {
      parsed.readingFontSize = defaults.readingFontSize
    }
    if (!VALID_READING_LINE_HEIGHT.includes(parsed.readingLineHeight)) {
      parsed.readingLineHeight = defaults.readingLineHeight
    }
    if (!VALID_READING_THEME.includes(parsed.readingTheme)) {
      parsed.readingTheme = defaults.readingTheme
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

// ─── Supabase user_settings preference sync ──────────────────────────────────

/**
 * JSONB key map for the user_settings table.
 * Only the fields listed here are persisted to Supabase; all others remain
 * localStorage-only. Streak fields are intentionally excluded (E95-S04).
 */
export type UserSettingsPatch = {
  // useReaderStore
  readingTheme?: string
  readingFontSize?: number
  readingLineHeight?: number
  readingRuler?: boolean
  scrollMode?: boolean
  // useAudiobookPrefsStore
  defaultSpeed?: number
  skipSilence?: boolean
  defaultSleepTimer?: string | number
  autoBookmarkOnStop?: boolean
  // useReadingGoalStore (no streak fields)
  dailyType?: string
  dailyTarget?: number
  yearlyBookTarget?: number
  // useEngagementPrefsStore
  achievementsEnabled?: boolean
  streaksEnabled?: boolean
  colorScheme?: string
}

/**
 * Fire-and-forget push of a preference key-patch to the Supabase user_settings table.
 * If the user is not authenticated, returns immediately (anonymous / offline path).
 * Errors are swallowed with a console.warn — localStorage is still the offline fallback.
 *
 * Usage at call sites: `void saveSettingsToSupabase({ readingTheme: 'sepia' })`
 */
export async function saveSettingsToSupabase(patch: UserSettingsPatch): Promise<void> {
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.rpc('merge_user_settings', {
    p_user_id: user.id,
    p_patch: patch,
  })
  if (error) {
    // silent-catch-ok — offline-first: localStorage save already succeeded.
    console.warn('[settings] Supabase save failed:', error)
  }
}

/**
 * Hydrate localStorage settings from Supabase user_metadata on login.
 * Only overwrites displayName/bio if Supabase has data and localStorage is at defaults.
 * Called from the auth state listener in App.tsx.
 */
export async function hydrateSettingsFromSupabase(
  userMetadata: Record<string, unknown> | undefined,
  userId?: string
): Promise<void> {
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

  // ── Hydrate per-user preference stores from user_settings table ──────────
  // Best-effort: errors are silently swallowed so profile hydration above always applies.
  if (!userId || !supabase) return

  // E95-S06: hydrate useNotificationPrefsStore BEFORE the user_settings block
  // so the early-return paths inside that try/catch (PGRST116, empty settings
  // row) do not skip notification-preferences hydration.
  try {
    await hydrateNotificationPreferencesFromSupabase(userId)
  } catch (err) {
    // silent-catch-ok — a local default row is already persisted by init();
    // the next local toggle will sync as usual.
    console.warn('[settings] notification_preferences hydration failed:', err)
  }

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .single()

    if (error) {
      // PGRST116 = no rows returned (new user, row not yet created) — not an error.
      if (error.code !== 'PGRST116') {
        console.warn('[settings] Supabase user_settings fetch failed:', error)
      }
      // E95-S04: still kick off a streak hydration — the user may have a goal
      // from a prior session in localStorage even if user_settings is empty.
      if (userId) {
        const { useReadingGoalStore: readingGoalStoreForStreak } =
          await import('@/stores/useReadingGoalStore')
        await readingGoalStoreForStreak.getState().hydrateStreak(userId)
      }
      return
    }

    const s = data?.settings
    if (!s || typeof s !== 'object') {
      // E95-S04: same early-streak-hydration rationale as above.
      if (userId) {
        const { useReadingGoalStore: readingGoalStoreForStreak } =
          await import('@/stores/useReadingGoalStore')
        await readingGoalStoreForStreak.getState().hydrateStreak(userId)
      }
      return
    }

    // Lazy imports — Zustand stores are singleton modules; getState() is safe outside React.
    const [
      { useReaderStore },
      { useAudiobookPrefsStore },
      { useReadingGoalStore },
      { useEngagementPrefsStore },
    ] = await Promise.all([
      import('@/stores/useReaderStore'),
      import('@/stores/useAudiobookPrefsStore'),
      import('@/stores/useReadingGoalStore'),
      import('@/stores/useEngagementPrefsStore'),
    ])

    // ── useReaderStore ──
    if (typeof s.readingTheme === 'string') {
      const valid = ['light', 'sepia', 'dark']
      if (valid.includes(s.readingTheme)) {
        useReaderStore
          .getState()
          .setTheme(s.readingTheme as import('@/stores/useReaderStore').ReaderTheme)
      }
    }
    if (
      typeof s.readingFontSize === 'number' &&
      s.readingFontSize >= 80 &&
      s.readingFontSize <= 200
    ) {
      useReaderStore.getState().setFontSize(s.readingFontSize)
    }
    if (
      typeof s.readingLineHeight === 'number' &&
      s.readingLineHeight >= 1.2 &&
      s.readingLineHeight <= 2.0
    ) {
      useReaderStore.getState().setLineHeight(s.readingLineHeight)
    }
    if (typeof s.readingRuler === 'boolean') {
      useReaderStore.getState().setReadingRulerEnabled(s.readingRuler)
    }
    if (typeof s.scrollMode === 'boolean') {
      useReaderStore.getState().setScrollMode(s.scrollMode)
    }

    // ── useAudiobookPrefsStore ──
    if (typeof s.defaultSpeed === 'number') {
      useAudiobookPrefsStore.getState().setDefaultSpeed(s.defaultSpeed)
    }
    if (typeof s.skipSilence === 'boolean') {
      const current = useAudiobookPrefsStore.getState().skipSilence
      if (current !== s.skipSilence) {
        useAudiobookPrefsStore.getState().toggleSkipSilence()
      }
    }
    if (s.defaultSleepTimer !== undefined) {
      const validTimers = new Set(['off', 15, 30, 45, 60, 'end-of-chapter'])
      if (validTimers.has(s.defaultSleepTimer as string | number)) {
        useAudiobookPrefsStore
          .getState()
          .setDefaultSleepTimer(
            s.defaultSleepTimer as import('@/stores/useAudiobookPrefsStore').SleepTimerDefault
          )
      }
    }
    if (typeof s.autoBookmarkOnStop === 'boolean') {
      const current = useAudiobookPrefsStore.getState().autoBookmarkOnStop
      if (current !== s.autoBookmarkOnStop) {
        useAudiobookPrefsStore.getState().toggleAutoBookmark()
      }
    }

    // ── useReadingGoalStore (no streak fields) ──
    const hasGoalData =
      typeof s.dailyType === 'string' ||
      typeof s.dailyTarget === 'number' ||
      typeof s.yearlyBookTarget === 'number'
    if (hasGoalData) {
      const existingGoal = useReadingGoalStore.getState().goal
      useReadingGoalStore.getState().saveGoal({
        dailyType: (typeof s.dailyType === 'string'
          ? s.dailyType
          : (existingGoal?.dailyType ??
            'minutes')) as import('@/data/types').ReadingGoal['dailyType'],
        dailyTarget:
          typeof s.dailyTarget === 'number' ? s.dailyTarget : (existingGoal?.dailyTarget ?? 30),
        yearlyBookTarget:
          typeof s.yearlyBookTarget === 'number'
            ? s.yearlyBookTarget
            : (existingGoal?.yearlyBookTarget ?? 12),
      })
    }

    // E95-S04: hydrate the server-authoritative reading streak. Must run
    // AFTER the goal is known (saveGoal above) so hydrateStreak has the
    // dailyType/dailyTarget to pass to the RPC. Best-effort — errors are
    // swallowed inside hydrateStreak itself.
    if (userId) {
      await useReadingGoalStore.getState().hydrateStreak(userId)
    }

    // ── useEngagementPrefsStore ──
    if (typeof s.achievementsEnabled === 'boolean') {
      useEngagementPrefsStore.getState().setPreference('achievements', s.achievementsEnabled)
    }
    if (typeof s.streaksEnabled === 'boolean') {
      useEngagementPrefsStore.getState().setPreference('streaks', s.streaksEnabled)
    }
    if (typeof s.colorScheme === 'string') {
      const validSchemes = ['professional', 'vibrant', 'clean']
      if (validSchemes.includes(s.colorScheme)) {
        useEngagementPrefsStore
          .getState()
          .setPreference(
            'colorScheme',
            s.colorScheme as import('@/stores/useEngagementPrefsStore').ColorScheme
          )
      }
    }
  } catch (err) {
    // silent-catch-ok — hydration is best-effort; localStorage fallback is always active.
    console.warn('[settings] hydrateSettingsFromSupabase store hydration failed:', err)
  }

  // ── Legacy AI provider key migration (E95-S02) ────────────────────────────
  // One-time opportunistic migration: decrypt Web Crypto-encrypted keys from
  // localStorage and store them in Supabase Vault.
  //
  // This only works on the originating device (Web Crypto key is device-local,
  // stored in IndexedDB by cryptoKeyStore.ts). On a new device with no localStorage
  // data, there is nothing to migrate — the user must re-enter credentials once.
  //
  // Migration is idempotent: if the Vault already has the key, storeCredential
  // will update it (harmless). After migration, remove from localStorage blob.
  try {
    const aiRaw = localStorage.getItem('ai-configuration')
    if (aiRaw) {
      const aiConfig = JSON.parse(aiRaw) as Record<string, unknown>

      // Check providerKeys map (E90-S03 multi-provider keys)
      const providerKeys = aiConfig.providerKeys as
        | Record<string, { iv: string; encryptedData: string }>
        | undefined
      if (providerKeys && typeof providerKeys === 'object') {
        const { decryptData, storeCredential } = await Promise.all([
          import('@/lib/crypto').then(m => ({ decryptData: m.decryptData })),
          import('@/lib/vaultCredentials').then(m => ({ storeCredential: m.storeCredential })),
        ]).then(([c, v]) => ({ decryptData: c.decryptData, storeCredential: v.storeCredential }))

        const updatedProviderKeys = { ...providerKeys }
        let anyMigrated = false

        for (const [providerId, keyData] of Object.entries(providerKeys)) {
          if (!keyData?.iv || !keyData?.encryptedData) continue
          try {
            const plaintext = await decryptData(keyData.iv, keyData.encryptedData)
            if (plaintext) {
              await storeCredential('ai-provider', providerId, plaintext)
              delete updatedProviderKeys[providerId]
              anyMigrated = true
              console.log('[settings] Migrated legacy AI key for provider:', providerId)
            }
          } catch (decryptErr) {
            // silent-catch-ok — key may be on a different device; skip, user can re-enter
            console.warn(
              '[settings] Legacy AI key migration failed for provider:',
              providerId,
              decryptErr
            )
          }
        }

        if (anyMigrated) {
          const updated = { ...aiConfig, providerKeys: updatedProviderKeys }
          localStorage.setItem('ai-configuration', JSON.stringify(updated))
        }
      }
    }
  } catch (migrationErr) {
    // silent-catch-ok — migration is opportunistic; main hydration already completed.
    console.warn('[settings] Legacy AI key migration error:', migrationErr)
  }
}

// ─── E95-S06: notification_preferences hydration helper ─────────────────────

/**
 * List of known `NotificationPreferences` boolean toggle fields. Used to:
 *   - detect whether the local store is at all-defaults (P2 guard below)
 *   - filter unknown/extra remote fields before applying (R12)
 */
const NOTIFICATION_TOGGLE_FIELDS = [
  'courseComplete',
  'streakMilestone',
  'importFinished',
  'achievementUnlocked',
  'reviewDue',
  'srsDue',
  'knowledgeDecay',
  'recommendationMatch',
  'milestoneApproaching',
  'bookImported',
  'bookDeleted',
  'highlightReview',
] as const

/**
 * Snake_case → camelCase map for the Supabase `notification_preferences` row.
 * Explicit (not auto-derived from `camelToSnake`) so the allow-list also
 * enforces R12 — unknown remote columns are silently dropped.
 */
const NOTIFICATION_SNAKE_TO_CAMEL: Record<
  string,
  keyof import('@/data/types').NotificationPreferences
> = {
  course_complete: 'courseComplete',
  streak_milestone: 'streakMilestone',
  import_finished: 'importFinished',
  achievement_unlocked: 'achievementUnlocked',
  review_due: 'reviewDue',
  srs_due: 'srsDue',
  knowledge_decay: 'knowledgeDecay',
  recommendation_match: 'recommendationMatch',
  milestone_approaching: 'milestoneApproaching',
  book_imported: 'bookImported',
  book_deleted: 'bookDeleted',
  highlight_review: 'highlightReview',
  quiet_hours_enabled: 'quietHoursEnabled',
  quiet_hours_start: 'quietHoursStart',
  quiet_hours_end: 'quietHoursEnd',
}

/**
 * Hydrate `useNotificationPrefsStore` from the Supabase `notification_preferences`
 * row on login.
 *
 * Decision matrix:
 *   | Condition                                        | Outcome               |
 *   |--------------------------------------------------|-----------------------|
 *   | No remote row (new user / PGRST116)              | Skip (R10)            |
 *   | Remote updated_at >= local updatedAt             | Apply remote (R8)     |
 *   | Local is all-defaults (user never toggled)       | Apply remote (P2)     |
 *   | Otherwise (local strictly newer)                 | Keep local            |
 *
 * Malformed `quiet_hours_start` / `quiet_hours_end` values (R11) are dropped
 * and replaced with the store's DEFAULTS; unknown remote columns (R12) are
 * ignored because only keys in `NOTIFICATION_SNAKE_TO_CAMEL` are copied.
 *
 * Errors are swallowed — the store already has a usable default row written
 * by its init().
 */
async function hydrateNotificationPreferencesFromSupabase(userId: string): Promise<void> {
  if (!supabase) return

  const { data: remote, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[settings] notification_preferences fetch failed:', error)
    return
  }
  if (!remote) return // R10: no remote row — let local defaults stand.

  const { useNotificationPrefsStore, DEFAULTS, HHMM_RE } =
    await import('@/stores/useNotificationPrefsStore')
  const localPrefs = useNotificationPrefsStore.getState().prefs

  // P2 guard: when the local prefs exactly match DEFAULTS, the user has never
  // made an explicit change on this device — remote always wins regardless of
  // timestamps. Compares only the toggle + quiet-hours fields (not `id` /
  // `updatedAt`, which differ by construction).
  const isAllDefaults =
    NOTIFICATION_TOGGLE_FIELDS.every(field => localPrefs[field] === DEFAULTS[field]) &&
    localPrefs.quietHoursEnabled === DEFAULTS.quietHoursEnabled &&
    localPrefs.quietHoursStart === DEFAULTS.quietHoursStart &&
    localPrefs.quietHoursEnd === DEFAULTS.quietHoursEnd

  const remoteUpdatedAt =
    typeof (remote as { updated_at?: unknown }).updated_at === 'string'
      ? ((remote as { updated_at: string }).updated_at as string)
      : ''
  const localUpdatedAt = localPrefs.updatedAt

  // R8: inclusive `>=` handles same-second first-install upload races.
  const remoteWins = isAllDefaults || remoteUpdatedAt >= localUpdatedAt
  if (!remoteWins) return

  // Build the validated snapshot from the allow-list (R12). Unknown columns
  // are silently dropped; missing columns fall back to DEFAULTS.
  const validated = { ...DEFAULTS }
  for (const [snake, camel] of Object.entries(NOTIFICATION_SNAKE_TO_CAMEL) as Array<
    [string, keyof import('@/data/types').NotificationPreferences]
  >) {
    const raw = (remote as Record<string, unknown>)[snake]
    if (camel === 'quietHoursStart' || camel === 'quietHoursEnd') {
      // R11: validate HH:MM strings; fall back to defaults for malformed.
      if (typeof raw === 'string' && HHMM_RE.test(raw)) {
        ;(validated as Record<string, unknown>)[camel] = raw
      }
      continue
    }
    if (camel === 'quietHoursEnabled') {
      if (typeof raw === 'boolean') validated.quietHoursEnabled = raw
      continue
    }
    // Remaining keys are boolean toggle fields.
    if (typeof raw === 'boolean') {
      ;(validated as Record<string, unknown>)[camel] = raw
    }
  }
  if (typeof remoteUpdatedAt === 'string' && remoteUpdatedAt.length > 0) {
    validated.updatedAt = remoteUpdatedAt
  }

  useNotificationPrefsStore.getState().hydrateFromRemote(validated)
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

export async function resetAllData() {
  localStorage.clear()
  sessionStorage.clear()
  // Clear IndexedDB — delete the Dexie database entirely
  const { db } = await import('@/db/schema')
  await db.delete()
  // Reload to re-initialize from scratch
  window.location.reload()
}
