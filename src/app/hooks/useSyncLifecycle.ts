/**
 * E92-S07: Sync trigger hook — event-driven sync lifecycle.
 *
 * Registers store refresh callbacks on the sync engine BEFORE the first
 * fullSync(), then wires up all event sources:
 *   - App mount  → fullSync()
 *   - 30s timer  → nudge() [if navigator.onLine]
 *   - tab focus  → nudge() [if visible + navigator.onLine]
 *   - online     → fullSync() (reconnection recovery)
 *   - offline    → setStatus('offline') (no engine pause — that is E92-S08)
 *   - beforeunload → sendBeacon (structural scaffolding — endpoint is future work)
 *
 * Scope boundaries:
 *   - Does NOT call syncEngine.start() or syncEngine.stop() — those are E92-S08.
 *   - Does NOT register contentProgress store refresh — loadCourseProgress()
 *     requires a mandatory courseId argument; no loadAll() variant exists (S07).
 *   - /api/sync-beacon endpoint does not exist — sendBeacon silently fails.
 *
 * Called from App.tsx root so triggers are active for the entire app session.
 */

import { useEffect, useRef } from 'react'
import { syncEngine } from '@/lib/sync/syncEngine'
import { classifyError } from '@/lib/sync/classifyError'
import { getSettings } from '@/lib/settings'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useNoteStore } from '@/stores/useNoteStore'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'
import { useFlashcardStore } from '@/stores/useFlashcardStore'
import { vectorStorePersistence } from '@/ai/vector-store'
import { useVocabularyStore } from '@/stores/useVocabularyStore'
import { useAudioClipStore } from '@/stores/useAudioClipStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useBookStore } from '@/stores/useBookStore'
import { useBookReviewStore } from '@/stores/useBookReviewStore'
import { useShelfStore } from '@/stores/useShelfStore'
import { useReadingQueueStore } from '@/stores/useReadingQueueStore'

/** Interval between periodic nudge calls (ms). */
const NUDGE_INTERVAL_MS = 30_000

/** Maximum sendBeacon payload size (bytes). Browsers reject larger payloads. */
const BEACON_MAX_BYTES = 64_000

/**
 * Read the current `autoSyncEnabled` preference, treating `undefined` (legacy
 * localStorage payloads with no such field) as the default-on value.
 */
function isAutoSyncEnabled(): boolean {
  return getSettings().autoSyncEnabled !== false
}

export function useSyncLifecycle(): void {
  const mountedRef = useRef(true)
  // Ref lets event handlers read the live value without a re-render hook cycle.
  const autoSyncEnabledRef = useRef(isAutoSyncEnabled())

  useEffect(() => {
    mountedRef.current = true
    autoSyncEnabledRef.current = isAutoSyncEnabled()

    const { setStatus, markSyncComplete } = useSyncStatusStore.getState()

    // -------------------------------------------------------------------------
    // Store refresh registrations — MUST happen before first fullSync() so that
    // the download phase of the initial sync notifies stores.
    // -------------------------------------------------------------------------

    syncEngine.registerStoreRefresh('studySessions', () =>
      useSessionStore.getState().loadSessionStats()
    )

    syncEngine.registerStoreRefresh('notes', () => useNoteStore.getState().loadNotes())

    syncEngine.registerStoreRefresh('bookmarks', () => useBookmarkStore.getState().loadBookmarks())

    syncEngine.registerStoreRefresh('flashcards', () =>
      useFlashcardStore.getState().loadFlashcards()
    )

    // upload-only: embeddings are not downloaded from Supabase, so this callback
    // is a no-op during normal sync. Registered for API symmetry and in case
    // uploadOnly is later removed (E97+ or future bidirectional scenario).
    syncEngine.registerStoreRefresh('embeddings', () =>
      vectorStorePersistence.loadAll()
    )

    // Intentional: bookHighlights store refresh uses a no-op because
    // loadHighlightsForBook() requires a mandatory bookId argument — no loadAll()
    // variant exists. Highlights are re-loaded on next book navigation.
    syncEngine.registerStoreRefresh('bookHighlights', () => Promise.resolve())

    syncEngine.registerStoreRefresh('vocabularyItems', () =>
      useVocabularyStore.getState().loadAllItems()
    )

    // audioBookmarks are loaded per-book on navigation — no global loadAll exists.
    // A no-op is correct: after fullSync, the next book navigation will re-query Dexie
    // and pick up any downloaded bookmarks automatically.
    syncEngine.registerStoreRefresh('audioBookmarks', () => Promise.resolve())

    // audioClips are scoped per-book. Load with empty string so the guard
    // (isLoaded && loadedBookId === bookId) never matches '' in practice.
    // The next book navigation will reload the correct clips.
    syncEngine.registerStoreRefresh('audioClips', () =>
      useAudioClipStore.getState().loadClips('')
    )

    // chatConversations are loaded per-course context in useTutorStore on navigation
    // — no global loadAll() exists. A no-op is correct: after fullSync, the next
    // lesson navigation will re-query Dexie and pick up downloaded conversations.
    syncEngine.registerStoreRefresh('chatConversations', () => Promise.resolve())

    // learnerModels are loaded per-course via learnerModelService.getLearnerModel
    // — no global loadAll() exists. Same no-op rationale as chatConversations.
    syncEngine.registerStoreRefresh('learnerModels', () => Promise.resolve())

    // -------------------------------------------------------------------------
    // P2 store refresh registrations — E94-S02
    // All three importedCourses/Videos/Pdfs callbacks trigger loadImportedCourses()
    // because the course store re-queries all child records on next navigation.
    // -------------------------------------------------------------------------

    syncEngine.registerStoreRefresh('importedCourses', () =>
      useCourseImportStore.getState().loadImportedCourses()
    )

    syncEngine.registerStoreRefresh('importedVideos', () =>
      useCourseImportStore.getState().loadImportedCourses()
    )

    syncEngine.registerStoreRefresh('importedPdfs', () =>
      useCourseImportStore.getState().loadImportedCourses()
    )

    // Reset isLoaded to force reload past the early-return guard before calling load.
    syncEngine.registerStoreRefresh('authors', async () => {
      useAuthorStore.setState({ isLoaded: false })
      await useAuthorStore.getState().loadAuthors()
    })

    syncEngine.registerStoreRefresh('books', async () => {
      useBookStore.setState({ isLoaded: false })
      await useBookStore.getState().loadBooks()
    })

    // E94-S03: P2 library-organization refresh callbacks.
    syncEngine.registerStoreRefresh('bookReviews', async () => {
      useBookReviewStore.setState({ isLoaded: false })
      await useBookReviewStore.getState().loadReviews()
    })

    // `shelves` and `bookShelves` are both owned by useShelfStore — loadShelves
    // re-queries both tables. Registering both keys ensures the callback fires
    // regardless of which table the download engine processed last.
    syncEngine.registerStoreRefresh('shelves', async () => {
      useShelfStore.setState({ isLoaded: false })
      await useShelfStore.getState().loadShelves()
    })

    syncEngine.registerStoreRefresh('bookShelves', async () => {
      useShelfStore.setState({ isLoaded: false })
      await useShelfStore.getState().loadShelves()
    })

    syncEngine.registerStoreRefresh('readingQueue', async () => {
      useReadingQueueStore.setState({ isLoaded: false })
      await useReadingQueueStore.getState().loadQueue()
    })

    // Intentional: contentProgress store refresh is NOT registered here.
    // useContentProgressStore.loadCourseProgress(courseId) requires a mandatory
    // courseId argument — no loadAll() variant exists in S07. The store will
    // refresh on next route navigation. A global loadAll() can be added to
    // useContentProgressStore in a later story if cross-session refresh is needed.

    // -------------------------------------------------------------------------
    // Initial fullSync on mount — gated on autoSyncEnabled (E97-S02).
    // When disabled, we skip the initial sync entirely so a user who has
    // explicitly paused sync does not trigger a fullSync on every reload.
    // -------------------------------------------------------------------------

    if (autoSyncEnabledRef.current) {
      setStatus('syncing')
      syncEngine
        .fullSync()
        .then(() => {
          if (!mountedRef.current) return
          markSyncComplete()
        })
        .catch((err: unknown) => {
          if (!mountedRef.current) return
          console.error('[useSyncLifecycle] Initial fullSync failed:', err)
          setStatus('error', classifyError(err))
        })
    }

    // -------------------------------------------------------------------------
    // Periodic nudge — 30 second interval
    // -------------------------------------------------------------------------

    const intervalId = setInterval(() => {
      // E97-S02: guard on the live preference rather than unregistering the
      // interval, so the hook reacts to runtime toggles without a remount.
      if (!autoSyncEnabledRef.current) return
      // Intentional: guard prevents nudge calls when offline. The engine's own
      // _started guard also fires, but checking navigator.onLine first avoids
      // queuing a debounced upload that would immediately fail.
      if (navigator.onLine) {
        syncEngine.nudge()
      }
      // E97-S01: opportunistically refresh pendingCount so the header badge
      // stays in sync with passive queue drift between lifecycle transitions.
      // Fire-and-forget; refreshPendingCount swallows its own Dexie errors.
      void useSyncStatusStore.getState().refreshPendingCount()
    }, NUDGE_INTERVAL_MS)

    // -------------------------------------------------------------------------
    // Tab visibility change → nudge on becoming visible
    // -------------------------------------------------------------------------

    const handleVisibilityChange = () => {
      if (!autoSyncEnabledRef.current) return
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncEngine.nudge()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // -------------------------------------------------------------------------
    // Network online → reconnection full sync
    // -------------------------------------------------------------------------

    const handleOnline = () => {
      if (!autoSyncEnabledRef.current) return
      const { setStatus: setState, markSyncComplete: markComplete } =
        useSyncStatusStore.getState()
      setState('syncing')
      syncEngine
        .fullSync()
        .then(() => {
          if (!mountedRef.current) return
          markComplete()
        })
        .catch((err: unknown) => {
          if (!mountedRef.current) return
          console.error('[useSyncLifecycle] Reconnection fullSync failed:', err)
          setState('error', classifyError(err))
        })
    }
    window.addEventListener('online', handleOnline)

    // -------------------------------------------------------------------------
    // Network offline → update status store (no engine pause — that is E92-S08)
    // -------------------------------------------------------------------------

    const handleOffline = () => {
      useSyncStatusStore.getState().setStatus('offline')
    }
    window.addEventListener('offline', handleOffline)

    // -------------------------------------------------------------------------
    // Before unload → sendBeacon for pending queue entries
    //
    // Intentional: beacon endpoint is future work — this call silently fails.
    // The pattern is structural scaffolding: when /api/sync-beacon is eventually
    // implemented, remove this comment and add the endpoint test.
    //
    // Intentional: Dexie reads inside beforeunload are async and cannot be
    // awaited before page unload. The beacon may carry stale data or fail
    // entirely — this is a known browser limitation of beforeunload + IndexedDB.
    // -------------------------------------------------------------------------

    const handleBeforeUnload = () => {
      if (!navigator.sendBeacon) return

      // Fire-and-forget Dexie read — result may not arrive before page unload.
      void (async () => {
        try {
          const pending = await import('@/db').then(({ db: d }) =>
            d.syncQueue.where('status').equals('pending').toArray()
          )
          const payload = JSON.stringify(pending)
          if (payload.length < BEACON_MAX_BYTES) {
            navigator.sendBeacon('/api/sync-beacon', payload)
          }
        } catch {
          // Intentional: silent failure — beacon is best-effort pre-unload flush.
        }
      })()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // -------------------------------------------------------------------------
    // Settings update → react to auto-sync toggle at runtime (E97-S02).
    // Refreshes the ref and starts or stops the engine so the user does not
    // need to reload after flipping the Sync Settings switch.
    // -------------------------------------------------------------------------

    const handleSettingsUpdate = () => {
      const next = isAutoSyncEnabled()
      if (next === autoSyncEnabledRef.current) return
      autoSyncEnabledRef.current = next
      const userId = useAuthStore.getState().user?.id
      if (next) {
        if (userId) {
          // silent-catch-ok — start() errors surface via useSyncStatusStore
          // status='error' on the next fullSync attempt; the indicator owns
          // the user-visible surface for sync lifecycle failures.
          void syncEngine.start(userId).catch((err: unknown) => {
            console.error('[useSyncLifecycle] start after re-enable failed:', err)
          })
        }
      } else {
        syncEngine.stop()
      }
    }
    window.addEventListener('settingsUpdated', handleSettingsUpdate)

    // -------------------------------------------------------------------------
    // Cleanup — remove all listeners and clear the interval
    // -------------------------------------------------------------------------

    return () => {
      mountedRef.current = false
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('settingsUpdated', handleSettingsUpdate)
    }
  }, [])
}
