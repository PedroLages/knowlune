/**
 * useAudiobookshelfSocket — real-time progress sync via Socket.IO (native WebSocket).
 *
 * Upgrades the REST polling from E102-S01 to live push/pull over WebSocket
 * when the ABS server supports Socket.IO. Falls back silently to REST on
 * disconnect — no user-facing error.
 *
 * Lifecycle: connects when server + activeItemId are set, disconnects on unmount.
 * Uses Engine.IO protocol over native WebSocket (zero npm dependencies — NFR5).
 *
 * @module useAudiobookshelfSocket
 * @since E102-S04
 */
import { useEffect, useRef, useCallback } from 'react'
import type { AudiobookshelfServer, Book } from '@/data/types'
import * as AudiobookshelfService from '@/services/AudiobookshelfService'
import type { AbsSocketConnection } from '@/services/AudiobookshelfService'
import { useBookStore } from '@/stores/useBookStore'
import { useAbsApiKey } from '@/lib/credentials/absApiKeyResolver'

const absInboundWriteOpts = { suppressErrorToast: true } as const

interface UseAudiobookshelfSocketOptions {
  /** ABS server to connect to (null if book is not from ABS) */
  server: AudiobookshelfServer | null
  /** ABS item ID for the active book */
  activeItemId: string | null
  /** Local book record (for LWW conflict resolution) */
  book: Book
  /** Current playback time in seconds */
  currentTime: number
  /** Whether audio is currently playing */
  isPlaying: boolean
}

interface UseAudiobookshelfSocketResult {
  /** Whether the Socket.IO connection is active and ready */
  isSocketConnected: boolean
}

/**
 * Manages a Socket.IO connection to an ABS server for real-time progress sync.
 *
 * - Receives progress events: updates local book if incoming position is ahead (LWW)
 * - Pushes progress on chapter change, seek, or periodic interval while playing
 * - Falls back to REST silently on disconnect
 */
export function useAudiobookshelfSocket({
  server,
  activeItemId,
  book,
  currentTime,
  isPlaying,
}: UseAudiobookshelfSocketOptions): UseAudiobookshelfSocketResult {
  const connectionRef = useRef<AbsSocketConnection | null>(null)
  const isConnectedRef = useRef(false)
  // Force re-render when connection state changes
  const forceUpdate = useRef(0)

  // Track currentTime in a ref to avoid effect re-runs
  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime

  const bookRef = useRef(book)
  bookRef.current = book

  // Handle incoming progress events (LWW — same as E102-S01)
  const handleProgressUpdate = useCallback(
    (event: AudiobookshelfService.AbsProgressEvent) => {
      // Only process events for the active item
      if (event.libraryItemId !== activeItemId) return

      const currentBook = bookRef.current
      const localSeconds =
        currentBook.currentPosition?.type === 'time' ? currentBook.currentPosition.seconds : 0

      // LWW: adopt if incoming position is ahead (same gate as pre-store socket path)
      if (event.currentTime > localSeconds) {
        const position = { type: 'time' as const, seconds: event.currentTime }
        const totalDur = currentBook.totalDuration ?? 0
        const p = Number.isFinite(event.progress)
          ? Math.min(1, Math.max(0, event.progress))
          : 0
        const progressPct =
          totalDur > 0
            ? Math.min(100, Math.round((event.currentTime / totalDur) * 100))
            : Math.round(p * 100)
        // Inbound socket has no ABS `lastUpdate` — single store write avoids duplicate syncableWrite churn.
        void useBookStore
          .getState()
          .updateBookPosition(currentBook.id, position, progressPct, absInboundWriteOpts)
      }
    },
    [activeItemId]
  )

  // Resolve the server's apiKey through the vault broker (E95-S05). The hook
  // re-runs when the resolved value changes so a credential rotation
  // (`updateServer` with a new apiKey) reconnects the socket.
  const { value: apiKey } = useAbsApiKey(server?.id)

  // Connect/disconnect on server/item changes
  useEffect(() => {
    if (!server || !activeItemId) return
    if (!apiKey) return

    const connection = AudiobookshelfService.connectSocket(server.url, apiKey, {
      onReady: () => {
        isConnectedRef.current = true
        forceUpdate.current += 1
        // Subscribe to progress events
        const unsub = AudiobookshelfService.onProgressUpdate(connection, handleProgressUpdate)
        // Store unsubscribe for cleanup
        ;(connection as { _unsub?: () => void })._unsub = unsub
      },
      onDisconnect: () => {
        isConnectedRef.current = false
        forceUpdate.current += 1
        // REST polling from E102-S01 resumes automatically (isSocketConnected = false)
      },
    })

    connectionRef.current = connection

    return () => {
      // Cleanup: unsubscribe and disconnect
      const unsub = (connection as { _unsub?: () => void })._unsub
      unsub?.()
      connection.disconnect()
      connectionRef.current = null
      isConnectedRef.current = false
    }
  }, [server?.id, server?.url, apiKey, activeItemId, handleProgressUpdate])

  // Push progress periodically while playing (every 10s via socket)
  useEffect(() => {
    if (!isPlaying || !activeItemId) return

    const interval = setInterval(() => {
      const conn = connectionRef.current
      if (!conn?.isConnected) return

      const currentBook = bookRef.current
      const totalDur = currentBook.totalDuration ?? 0
      if (totalDur <= 0) return

      const seconds = currentTimeRef.current
      if (seconds <= 0) return

      AudiobookshelfService.pushProgressViaSocket(conn, activeItemId, {
        currentTime: seconds,
        duration: totalDur,
        progress: seconds / totalDur,
        isFinished: seconds / totalDur >= 0.99,
      })
    }, 10_000)

    return () => clearInterval(interval)
  }, [isPlaying, activeItemId])

  // Push progress when playback pauses
  const wasPlayingRef = useRef(false)
  useEffect(() => {
    if (wasPlayingRef.current && !isPlaying) {
      const conn = connectionRef.current
      if (conn?.isConnected && activeItemId) {
        const currentBook = bookRef.current
        const totalDur = currentBook.totalDuration ?? 0
        if (totalDur > 0 && currentTimeRef.current > 0) {
          AudiobookshelfService.pushProgressViaSocket(conn, activeItemId, {
            currentTime: currentTimeRef.current,
            duration: totalDur,
            progress: currentTimeRef.current / totalDur,
            isFinished: currentTimeRef.current / totalDur >= 0.99,
          })
        }
      }
    }
    wasPlayingRef.current = isPlaying
  }, [isPlaying, activeItemId])

  return {
    isSocketConnected: isConnectedRef.current,
  }
}
