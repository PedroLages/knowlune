/**
 * Typed, synchronous event bus for intra-app domain events.
 *
 * No external dependencies (NFR-4). Used by NotificationService to map
 * domain events to user-facing notifications.
 *
 * @module eventBus
 * @since E43-S07
 */

// --- Event type definitions ---

export type AppEvent =
  | { type: 'course:completed'; courseId: string; courseName: string }
  | { type: 'streak:milestone'; days: number }
  | {
      type: 'import:finished'
      courseId: string
      courseName: string
      lessonCount: number
    }
  | {
      type: 'achievement:unlocked'
      achievementId: string
      achievementName: string
    }
  | { type: 'review:due'; dueCount: number }
  | { type: 'srs:due'; dueCount: number }
  | { type: 'knowledge:decay'; topic: string; retention: number; dueCount: number }
  | { type: 'recommendation:match'; courseId: string; courseName: string; reason: string }
  | { type: 'book:imported'; bookId: string; title: string }
  | { type: 'book:deleted'; bookId: string }
  | { type: 'highlight:created'; highlightId: string; bookId: string }
  | { type: 'highlight:updated'; highlightId: string; bookId: string }
  | { type: 'highlight:deleted'; highlightId: string; bookId: string }
  | { type: 'reading:session-ended'; bookId: string; durationMinutes: number }
  | { type: 'listening:session-ended'; bookId: string; durationMinutes: number }
  | { type: 'book:finished'; bookId: string; finishedAt: string }
  | {
      type: 'milestone:approaching'
      courseId: string
      courseName: string
      remainingLessons: number
      totalLessons: number
    }

export type AppEventType = AppEvent['type']

// Extract the payload for a specific event type
type EventOfType<T extends AppEventType> = Extract<AppEvent, { type: T }>

type Listener<T extends AppEventType> = (event: EventOfType<T>) => void

// --- EventBus class ---

class EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners = new Map<AppEventType, Set<(event: any) => void>>()

  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  on<T extends AppEventType>(type: T, listener: Listener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    const set = this.listeners.get(type)!
    set.add(listener)

    return () => {
      set.delete(listener)
      if (set.size === 0) {
        this.listeners.delete(type)
      }
    }
  }

  /** Unsubscribe a specific listener from an event type. */
  off<T extends AppEventType>(type: T, listener: Listener<T>): void {
    const set = this.listeners.get(type)
    if (!set) return
    set.delete(listener)
    if (set.size === 0) {
      this.listeners.delete(type)
    }
  }

  /** Emit an event synchronously to all registered listeners. */
  emit<T extends AppEventType>(event: EventOfType<T>): void {
    const set = this.listeners.get(event.type)
    if (!set) return
    for (const listener of set) {
      try {
        listener(event)
      } catch (error) {
        console.error(`[EventBus] Listener error for "${event.type}":`, error)
      }
    }
  }

  /** Remove all listeners (for testing/cleanup). */
  clear(): void {
    this.listeners.clear()
  }
}

/** Singleton app event bus */
export const appEventBus = new EventBus()
