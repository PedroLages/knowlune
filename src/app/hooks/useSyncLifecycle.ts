/**
 * E92-S07: Sync trigger hook — event-driven sync lifecycle.
 *
 * Registers store refresh callbacks on the sync engine, then routes every
 * lifecycle trigger through the serialized sync coordinator:
 *   - 30s timer  → coordinated incremental upload + download
 *   - tab focus  → coordinated incremental upload + download
 *   - online     → coordinated reconnection recovery
 *   - offline    → setStatus('offline')
 *   - beforeunload → sendBeacon (structural scaffolding — endpoint is future work)
 *
 * Scope boundaries:
 *   - Auth start/stop remains owned by useAuthLifecycle.
 *   - Does NOT register contentProgress store refresh — loadCourseProgress()
 *     requires a mandatory courseId argument; no loadAll() variant exists (S07).
 *   - /api/sync-beacon endpoint does not exist — sendBeacon silently fails.
 *
 * Called from App.tsx root so triggers are active for the entire app session.
 */

import { useEffect, useRef } from 'react'
import { syncEngine } from '@/lib/sync/syncEngine'
import { syncCoordinator } from '@/lib/sync/syncCoordinator'
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
import { useLearningPathStore } from '@/stores/useLearningPathStore'

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
  // Ref lets event handlers read the live value without a re-render hook cycle.
  const autoSyncEnabledRef = useRef(isAutoSyncEnabled())

  useEffect(() => {
    autoSyncEnabledRef.current = isAutoSyncEnabled()

    const { loadPersistedStatus } = useSyncStatusStore.getState()
    if (typeof loadPersistedStatus === 'function') void loadPersistedStatus()

    // -------------------------------------------------------------------------
    // Store refresh registrations must happen before an account-scoped sync so
    // its download phase can notify the relevant stores.
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
    syncEngine.registerStoreRefresh('embeddings', () => vectorStorePersistence.loadAll())

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
    syncEngine.registerStoreRefresh('audioClips', () => useAudioClipStore.getState().loadClips(''))

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

    // Tracks are a parent/child pair. Refresh both through the store's
    // session-filtered selector so downloaded paths become visible immediately.
    syncEngine.registerStoreRefresh('learningPaths', () =>
      useLearningPathStore.getState().refreshPaths()
    )
    syncEngine.registerStoreRefresh('learningPathEntries', () =>
      useLearningPathStore.getState().refreshPaths()
    )

    // UX note (authors refresh): sync used to clear `isLoaded` before reload, which swapped
    // author routes into cold-loading skeletons. `loadAuthors({ silent: true })` refreshes Dexie
    // without that. No 10s timer in app src; churn correlates with sync (see NUDGE_INTERVAL_MS).
    syncEngine.registerStoreRefresh('authors', async () => {
      await useAuthorStore.getState().loadAuthors({ silent: true })
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

    // The auth lifecycle owns the first account-scoped run. Starting one here
    // raced account repair and made the initial-upload dialog observe a queue
    // that was still being rebuilt.

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
        void syncCoordinator
          .request({ reason: 'periodic' })
          .catch(err => console.error('[useSyncLifecycle] Periodic sync failed:', err))
      }
    }, NUDGE_INTERVAL_MS)

    // -------------------------------------------------------------------------
    // Tab visibility change → nudge on becoming visible
    // -------------------------------------------------------------------------

    const handleVisibilityChange = () => {
      if (!autoSyncEnabledRef.current) return
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void syncCoordinator
          .request({ reason: 'focus' })
          .catch(err => console.error('[useSyncLifecycle] Focus sync failed:', err))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // -------------------------------------------------------------------------
    // Network online → reconnection full sync
    // -------------------------------------------------------------------------

    const handleOnline = () => {
      if (!autoSyncEnabledRef.current) return
      void syncCoordinator
        .request({ reason: 'online' })
        .catch(err => console.error('[useSyncLifecycle] Reconnection sync failed:', err))
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
          void syncCoordinator
            .start(userId)
            .catch(err => console.error('[useSyncLifecycle] start after re-enable failed:', err))
        }
      } else {
        syncCoordinator.stop()
      }
    }
    window.addEventListener('settingsUpdated', handleSettingsUpdate)

    // -------------------------------------------------------------------------
    // Cleanup — remove all listeners and clear the interval
    // -------------------------------------------------------------------------

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('settingsUpdated', handleSettingsUpdate)
    }
  }, [])
}
