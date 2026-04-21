import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { NotificationPreferences, NotificationType } from '@/data/types'
import { syncableWrite } from '@/lib/sync/syncableWrite'

/** Map NotificationType → field name on NotificationPreferences */
const TYPE_TO_FIELD: Record<NotificationType, keyof NotificationPreferences> = {
  'course-complete': 'courseComplete',
  'streak-milestone': 'streakMilestone',
  'import-finished': 'importFinished',
  'achievement-unlocked': 'achievementUnlocked',
  'review-due': 'reviewDue',
  'srs-due': 'srsDue',
  'knowledge-decay': 'knowledgeDecay',
  'recommendation-match': 'recommendationMatch',
  'milestone-approaching': 'milestoneApproaching',
  'book-imported': 'bookImported',
  'book-deleted': 'bookDeleted',
  'highlight-review': 'highlightReview', // E86-S02
}

export const DEFAULTS: NotificationPreferences = {
  id: 'singleton',
  courseComplete: true,
  streakMilestone: true,
  importFinished: true,
  achievementUnlocked: true,
  reviewDue: true,
  srsDue: true,
  knowledgeDecay: true,
  recommendationMatch: true,
  milestoneApproaching: true,
  bookImported: true,
  bookDeleted: true,
  highlightReview: true, // E86-S02
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  updatedAt: new Date().toISOString(),
}

/** Get current local time as "HH:MM" */
function getCurrentHHMM(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/** Validate HH:MM format (00:00–23:59) */
export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/
function isValidHHMM(value: string): boolean {
  return HHMM_RE.test(value)
}

interface NotificationPrefsState {
  prefs: NotificationPreferences
  isLoaded: boolean

  /** Load preferences from Dexie; writes defaults if no row exists */
  init: () => Promise<void>
  /** Toggle a specific notification type on/off */
  setTypeEnabled: (type: NotificationType, enabled: boolean) => Promise<void>
  /** Update quiet hours settings */
  setQuietHours: (
    patch: Partial<
      Pick<NotificationPreferences, 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd'>
    >
  ) => Promise<void>
  /**
   * Replace in-memory prefs from a validated remote snapshot.
   *
   * E95-S06: called by `hydrateSettingsFromSupabase` when the Supabase
   * `notification_preferences` row is authoritative (remote ≥ local OR local
   * is all-defaults). Pure setter — does NOT write to Dexie or the sync queue.
   * The remote data is already persisted in Supabase; the local Dexie row will
   * be updated on the next explicit toggle through `syncableWrite`, which is
   * the only write path that touches the queue.
   */
  hydrateFromRemote: (remotePrefs: NotificationPreferences) => void
  /** Check if a notification type is enabled (safe default: true) */
  isTypeEnabled: (type: NotificationType) => boolean
  /** Check if current time falls within quiet hours */
  isInQuietHours: () => boolean
}

export const useNotificationPrefsStore = create<NotificationPrefsState>((set, get) => ({
  prefs: { ...DEFAULTS },
  isLoaded: false,

  init: async () => {
    try {
      const existing = await db.notificationPreferences.get('singleton')
      if (existing) {
        set({ prefs: existing, isLoaded: true })
      } else {
        // Construct defaults WITHOUT a manual `updatedAt` stamp —
        // `syncableWrite` stamps `updatedAt: now` on every put/add.
        // The `id` field remains `'singleton'`; the registry's
        // `fieldMap: { id: 'user_id' }` translates it to `user_id` on upload.
        const defaults: NotificationPreferences = { ...DEFAULTS }
        await syncableWrite(
          'notificationPreferences',
          'put',
          defaults as unknown as Record<string, unknown> & { id: string }
        )
        // Re-read from Dexie so the in-memory state reflects the stamped
        // `userId` + `updatedAt` fields applied by `syncableWrite`.
        const stored = await db.notificationPreferences.get('singleton')
        set({ prefs: stored ?? defaults, isLoaded: true })
      }
    } catch (error) {
      console.error('[NotificationPrefsStore] Init failed:', error)
      // Fall through with defaults — all notifications allowed
      set({ isLoaded: true })
    }
  },

  setTypeEnabled: async (type, enabled) => {
    const field = TYPE_TO_FIELD[type]
    if (!field) return

    // Do NOT stamp `updatedAt` here — `syncableWrite` stamps it on write.
    const next: NotificationPreferences = {
      ...get().prefs,
      [field]: enabled,
    }

    try {
      await syncableWrite(
        'notificationPreferences',
        'put',
        next as unknown as Record<string, unknown> & { id: string }
      )
      // Re-read so in-memory `updatedAt` matches the Dexie-persisted stamp.
      const stored = await db.notificationPreferences.get('singleton')
      set({ prefs: stored ?? next })
    } catch (error) {
      toast.error('Failed to update notification preference')
      console.error('[NotificationPrefsStore] Failed to update type toggle:', error)
    }
  },

  setQuietHours: async patch => {
    // Validate HH:MM format before persisting
    if (patch.quietHoursStart && !isValidHHMM(patch.quietHoursStart)) return
    if (patch.quietHoursEnd && !isValidHHMM(patch.quietHoursEnd)) return

    // Do NOT stamp `updatedAt` here — `syncableWrite` stamps it on write.
    const next: NotificationPreferences = {
      ...get().prefs,
      ...patch,
    }

    try {
      await syncableWrite(
        'notificationPreferences',
        'put',
        next as unknown as Record<string, unknown> & { id: string }
      )
      const stored = await db.notificationPreferences.get('singleton')
      set({ prefs: stored ?? next })
    } catch (error) {
      toast.error('Failed to update quiet hours')
      console.error('[NotificationPrefsStore] Failed to update quiet hours:', error)
    }
  },

  hydrateFromRemote: (remotePrefs: NotificationPreferences) => {
    // Pure setter: the remote data is authoritative in Supabase; writing it
    // back to Dexie or the queue here would create an echo-loop on every
    // sign-in. The next local toggle will sync through `syncableWrite` as
    // usual, which is the single canonical write path.
    set({ prefs: remotePrefs, isLoaded: true })
  },

  isTypeEnabled: (type: NotificationType): boolean => {
    const field = TYPE_TO_FIELD[type]
    if (!field) return true // Unknown type — allow through
    return get().prefs[field] as boolean
  },

  isInQuietHours: (): boolean => {
    const { quietHoursEnabled, quietHoursStart: start, quietHoursEnd: end } = get().prefs
    if (!quietHoursEnabled) return false
    if (start === end) return false // Same time = effectively disabled

    const now = getCurrentHHMM()

    if (start <= end) {
      // Same-day window: e.g., 08:00–12:00
      return now >= start && now < end
    } else {
      // Midnight-spanning window: e.g., 22:00–07:00
      return now >= start || now < end
    }
  },
}))
