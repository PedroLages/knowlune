import { create } from 'zustand'
import { toast } from 'sonner'
import { ulid } from 'ulid'
import { db } from '@/db'
import type { Notification, NotificationType } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

/** Maximum number of notifications to retain after cleanup */
const MAX_NOTIFICATIONS = 100

/** Notifications older than this (in ms) are deleted on startup */
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

interface CreateNotificationInput {
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

interface NotificationState {
  /** Visible notifications (non-dismissed), sorted newest-first */
  notifications: Notification[]
  /** Count of unread, non-dismissed notifications */
  unreadCount: number
  isLoading: boolean
  error: string | null

  /** Initialize the store: run cleanup, then load from Dexie */
  init: () => Promise<void>
  /** Load notifications from Dexie into store state */
  load: () => Promise<void>
  /** Create a new notification with ULID id */
  create: (input: CreateNotificationInput) => Promise<void>
  /** Mark a single notification as read */
  markRead: (id: string) => Promise<void>
  /** Mark all unread notifications as read */
  markAllRead: () => Promise<void>
  /** Soft-dismiss a notification (sets dismissedAt, hides from visible list) */
  dismiss: (id: string) => Promise<void>
  /** Run TTL + cap cleanup (called during init before load) */
  cleanup: () => Promise<void>

  /**
   * Replace Dexie + in-memory collection from a validated remote snapshot.
   *
   * E96-S02: called by `hydrateP3P4FromSupabase`. Pure setter — uses
   * `db.notifications.bulkPut` directly (never `syncableWrite`) so it does
   * NOT enqueue any syncQueue row. Echo-loop guard per E93 retrospective.
   *
   * AC5 disposition: `isAllDefaults` guard is vacuously satisfied —
   * `notifications` is a collection keyed by id, not a singleton.
   */
  hydrateFromRemote: (rows: Notification[]) => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  init: async () => {
    try {
      await get().cleanup()
      await get().load()
    } catch (error) {
      console.error('[NotificationStore] Init failed:', error)
    }
  },

  load: async () => {
    set({ isLoading: true, error: null })
    try {
      const all = await db.notifications.toArray()

      // Filter for non-dismissed (dismissedAt is null) and sort newest-first
      const visible = all
        .filter(n => n.dismissedAt === null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      const unreadCount = visible.filter(n => n.readAt === null).length
      set({ notifications: visible, unreadCount, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load notifications' })
      console.error('[NotificationStore] Failed to load notifications:', error)
    }
  },

  create: async (input: CreateNotificationInput) => {
    const now = new Date().toISOString()
    const notification: Notification = {
      id: ulid(),
      type: input.type,
      title: input.title,
      message: input.message,
      createdAt: now,
      readAt: null,
      dismissedAt: null,
      actionUrl: input.actionUrl,
      metadata: input.metadata,
    }

    try {
      await persistWithRetry(async () => {
        await syncableWrite(
          'notifications',
          'add',
          notification as unknown as SyncableRecord,
        )
      })

      // Update store state after successful persistence
      set(state => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }))
    } catch (error) {
      toast.error('Failed to create notification')
      console.error('[NotificationStore] Failed to create notification:', error)
    }
  },

  markRead: async (id: string) => {
    const { notifications } = get()
    const target = notifications.find(n => n.id === id)
    if (!target || target.readAt !== null) return // Already read or not found

    const now = new Date().toISOString()

    try {
      await persistWithRetry(async () => {
        // syncableWrite requires a full record for 'put' — merge the patch
        // over the existing in-memory row.
        const next: Notification = { ...target, readAt: now }
        await syncableWrite(
          'notifications',
          'put',
          next as unknown as SyncableRecord,
        )
      })

      // Update store state after successful persistence
      set(state => ({
        notifications: state.notifications.map(n => (n.id === id ? { ...n, readAt: now } : n)),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch (error) {
      toast.error('Failed to mark notification as read')
      console.error('[NotificationStore] Failed to mark read:', error)
    }
  },

  markAllRead: async () => {
    const now = new Date().toISOString()
    const { notifications } = get()
    const unreadIds = notifications.filter(n => n.readAt === null).map(n => n.id)

    if (unreadIds.length === 0) return

    try {
      await persistWithRetry(async () => {
        // Enqueue one put per unread row so each change syncs individually.
        const unread = notifications.filter(n => n.readAt === null)
        for (const n of unread) {
          const next: Notification = { ...n, readAt: now }
          await syncableWrite(
            'notifications',
            'put',
            next as unknown as SyncableRecord,
          )
        }
      })

      // Update store state after successful persistence
      set(state => ({
        notifications: state.notifications.map(n =>
          n.readAt === null ? { ...n, readAt: now } : n
        ),
        unreadCount: 0,
      }))
    } catch (error) {
      toast.error('Failed to mark all as read')
      console.error('[NotificationStore] Failed to mark all read:', error)
    }
  },

  dismiss: async (id: string) => {
    const { notifications } = get()
    const target = notifications.find(n => n.id === id)
    if (!target) return

    const now = new Date().toISOString()

    try {
      await persistWithRetry(async () => {
        const next: Notification = { ...target, dismissedAt: now }
        await syncableWrite(
          'notifications',
          'put',
          next as unknown as SyncableRecord,
        )
      })

      // Remove from visible list after successful persistence
      const wasUnread = target.readAt === null
      set(state => ({
        notifications: state.notifications.filter(n => n.id !== id),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      }))
    } catch (error) {
      toast.error('Failed to dismiss notification')
      console.error('[NotificationStore] Failed to dismiss:', error)
    }
  },

  cleanup: async () => {
    try {
      const now = Date.now()
      const cutoff = new Date(now - TTL_MS).toISOString()

      // TTL cleanup: delete notifications older than 30 days
      const expired = await db.notifications.where('createdAt').below(cutoff).primaryKeys()

      if (expired.length > 0) {
        // E96-S02: enqueue per-row deletes so cleanup propagates to Supabase.
        // LWW semantics mean another device that signs in later will also
        // observe the delete (remote updatedAt ≥ local).
        for (const id of expired) {
          await syncableWrite('notifications', 'delete', id as string)
        }
        console.log(
          `[NotificationStore] TTL cleanup: deleted ${expired.length} expired notifications`
        )
      }

      // Cap cleanup: if > 100 remaining, delete oldest to bring to 100
      const remaining = await db.notifications.count()
      if (remaining > MAX_NOTIFICATIONS) {
        const excess = remaining - MAX_NOTIFICATIONS
        const oldest = await db.notifications.orderBy('createdAt').limit(excess).primaryKeys()

        if (oldest.length > 0) {
          for (const id of oldest) {
            await syncableWrite('notifications', 'delete', id as string)
          }
          console.log(
            `[NotificationStore] Cap cleanup: deleted ${oldest.length} oldest notifications (${remaining} > ${MAX_NOTIFICATIONS})`
          )
        }
      }
    } catch (error) {
      // Cleanup failure is non-fatal — log and continue
      console.error('[NotificationStore] Cleanup failed:', error)
    }
  },

  hydrateFromRemote: async rows => {
    if (!rows || rows.length === 0) return
    // Direct Dexie write — NEVER through syncableWrite. Echo-loop guard.
    await db.notifications.bulkPut(rows)
    // Refresh visible list + unreadCount from Dexie.
    const all = await db.notifications.toArray()
    const visible = all
      .filter(n => n.dismissedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const unreadCount = visible.filter(n => n.readAt === null).length
    set({ notifications: visible, unreadCount })
  },
}))
