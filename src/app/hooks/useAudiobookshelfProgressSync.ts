/**
 * useAudiobookshelfProgressSync — bidirectional progress sync with Audiobookshelf.
 *
 * Fetch-on-open: When an ABS audiobook loads, fetches remote progress and applies
 * latest-timestamp-wins conflict resolution. If ABS is ahead, updates local position
 * and seeks audio. If local is ahead, pushes to ABS.
 *
 * Push-on-session-end: When playback pauses, ends, or user navigates away, pushes
 * current position to ABS. Failures are silently queued for retry.
 *
 * Sync is best-effort — never blocks book opening, never shows error toasts,
 * never interrupts playback.
 *
 * @module useAudiobookshelfProgressSync
 * @since E102-S01
 */
import { useEffect, useRef, useCallback } from 'react'
import type { Book } from '@/data/types'
import * as AudiobookshelfService from '@/services/AudiobookshelfService'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { useBookStore } from '@/stores/useBookStore'
import { db } from '@/db/schema'
import { getAbsApiKey } from '@/lib/credentials/absApiKeyResolver'

interface UseAbsProgressSyncOptions {
  book: Book
  isPlaying: boolean
  currentTime: number
  /** Seek audio to a specific time (used when ABS progress is ahead) */
  seekTo: (seconds: number) => void
}

/**
 * Resolve conflict between ABS progress and local book position.
 * Uses latest-timestamp-wins strategy.
 */
export function resolveConflict(
  absUpdatedAt: number,
  localLastOpenedAt: string | undefined,
  localCurrentSeconds: number
): 'use-abs' | 'use-local' {
  // No local progress → adopt ABS unconditionally
  if (!localLastOpenedAt || localCurrentSeconds === 0) return 'use-abs'

  const localTimestamp = new Date(localLastOpenedAt).getTime()
  return absUpdatedAt > localTimestamp ? 'use-abs' : 'use-local'
}

export function useAudiobookshelfProgressSync({
  book,
  isPlaying,
  currentTime,
  seekTo,
}: UseAbsProgressSyncOptions) {
  const hasFetchedRef = useRef(false)
  const bookIdRef = useRef(book.id)

  // Reset fetch guard when book changes
  if (bookIdRef.current !== book.id) {
    bookIdRef.current = book.id
    hasFetchedRef.current = false
  }

  // ─── Fetch-on-open: sync ABS progress when book loads ───
  useEffect(() => {
    // Only sync ABS remote books
    if (book.source.type !== 'remote' || !book.absServerId || !book.absItemId) return
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    const server = useAudiobookshelfStore.getState().getServerById(book.absServerId)
    if (!server) return // Fire-and-forget — never block book opening
    ;(async () => {
      const apiKey = await getAbsApiKey(server.id)
      if (!apiKey) return
      const result = await AudiobookshelfService.fetchProgress(
        server.url,
        apiKey,
        book.absItemId!
      )

      if (!result.ok) {
        // Fetch failed — silently continue, do not block
        return
      }

      const absProgress = result.data

      if (!absProgress) {
        // 404: no ABS progress — push local if we have any
        const localSeconds =
          book.currentPosition?.type === 'time' ? book.currentPosition.seconds : 0
        if (localSeconds > 0 && book.totalDuration && book.totalDuration > 0) {
          // silent-catch-ok: push is best-effort
          AudiobookshelfService.updateProgress(server.url, apiKey, book.absItemId!, {
            currentTime: localSeconds,
            duration: book.totalDuration,
            progress: localSeconds / book.totalDuration,
            isFinished: localSeconds / book.totalDuration >= 0.99,
          }).catch(() => {})
        }
        return
      }

      const localSeconds = book.currentPosition?.type === 'time' ? book.currentPosition.seconds : 0
      const resolution = resolveConflict(absProgress.lastUpdate, book.lastOpenedAt, localSeconds)

      if (resolution === 'use-abs') {
        // ABS is ahead — update local book and seek audio
        const position = { type: 'time' as const, seconds: absProgress.currentTime }
        const progressPct =
          book.totalDuration && book.totalDuration > 0
            ? Math.min(100, Math.round((absProgress.currentTime / book.totalDuration) * 100))
            : Math.round(absProgress.progress * 100)
        const now = new Date().toISOString()

        // Optimistic store update
        useBookStore.setState(state => ({
          books: state.books.map(b =>
            b.id === book.id
              ? { ...b, currentPosition: position, progress: progressPct, lastOpenedAt: now }
              : b
          ),
        }))

        // silent-catch-ok: Dexie persist is non-critical, ABS is source of truth
        db.books
          .update(book.id, {
            currentPosition: position,
            progress: progressPct,
            lastOpenedAt: now,
          } as Parameters<typeof db.books.update>[1])
          .catch(err => console.error('[useAbsProgressSync] Failed to persist ABS position:', err))

        // Seek audio to ABS position
        seekTo(absProgress.currentTime)
      } else {
        // Local is ahead — push to ABS (fire-and-forget)
        if (book.totalDuration && book.totalDuration > 0) {
          // silent-catch-ok: push is best-effort
          AudiobookshelfService.updateProgress(server.url, apiKey, book.absItemId!, {
            currentTime: localSeconds,
            duration: book.totalDuration,
            progress: localSeconds / book.totalDuration,
            isFinished: localSeconds / book.totalDuration >= 0.99,
          }).catch(() => {})
        }
      }
    })()
  }, [book.id])

  // ─── Push-on-session-end: sync when playback pauses ───
  const pushProgress = useCallback(() => {
    if (book.source.type !== 'remote' || !book.absServerId || !book.absItemId) return
    if (!book.totalDuration || book.totalDuration <= 0) return

    const server = useAudiobookshelfStore.getState().getServerById(book.absServerId)
    if (!server) return

    const seconds = currentTime
    if (!seconds || seconds <= 0) return

    const payload = {
      currentTime: seconds,
      duration: book.totalDuration,
      progress: seconds / book.totalDuration,
      isFinished: seconds / book.totalDuration >= 0.99,
    }

    // Resolve apiKey through the vault broker (E95-S05). Credentials are no
    // longer on the server row — the resolver caches per-session so the hot
    // path (every pause) is a cache hit after the first call.
    ;(async () => {
      const apiKey = await getAbsApiKey(server.id)
      if (!apiKey) {
        // No credential available — enqueue and retry when the user signs in
        // / the resolver recovers. silent-catch-ok: best-effort sync.
        useAudiobookshelfStore.getState().enqueueSyncItem({
          serverId: book.absServerId!,
          itemId: book.absItemId!,
          payload,
        })
        return
      }
      // silent-catch-ok: sync is best-effort, queue on failure
      AudiobookshelfService.updateProgress(server.url, apiKey, book.absItemId!, payload)
        .then(result => {
          if (!result.ok) {
            // Server unreachable or error — enqueue for retry
            useAudiobookshelfStore.getState().enqueueSyncItem({
              serverId: book.absServerId!,
              itemId: book.absItemId!,
              payload,
            })
          }
        })
        .catch(() => {
          // Network error — enqueue for retry
          useAudiobookshelfStore.getState().enqueueSyncItem({
            serverId: book.absServerId!,
            itemId: book.absItemId!,
            payload,
          })
        })
    })()
  }, [book.absServerId, book.absItemId, book.totalDuration, book.source.type, currentTime])

  // Push when playback pauses (isPlaying transitions true → false)
  const wasPlayingRef = useRef(false)
  useEffect(() => {
    if (wasPlayingRef.current && !isPlaying) {
      pushProgress()
    }
    wasPlayingRef.current = isPlaying
  }, [isPlaying, pushProgress])

  // Push on unmount (navigate away while playing)
  useEffect(() => {
    return () => {
      if (wasPlayingRef.current) {
        pushProgress()
      }
    }
  }, [pushProgress])
}
