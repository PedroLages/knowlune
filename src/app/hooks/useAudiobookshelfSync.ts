/**
 * Hook for syncing Audiobookshelf library catalogs into the local book store.
 *
 * Fetches library items from ABS servers, maps them to Book records,
 * and upserts them via useBookStore. Handles pagination, offline detection,
 * and deduplication by absServerId + absItemId.
 *
 * @module useAudiobookshelfSync
 * @since E101-S03
 */

import { useCallback, useRef, useState, type MutableRefObject } from 'react'
import { toast } from 'sonner'
import type { AudiobookshelfServer, AbsLibraryItem, Book, BookChapter } from '@/data/types'
import * as AudiobookshelfService from '@/services/AudiobookshelfService'
import { useBookStore } from '@/stores/useBookStore'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { getAbsApiKey } from '@/lib/credentials/absApiKeyResolver'

interface SyncState {
  isSyncing: boolean
  syncError: string | null
  /** Pagination state per server, keyed by server.id */
  pagination: Record<string, { currentPage: number; totalItems: number }>
}

export function useAudiobookshelfSync() {
  const [state, setState] = useState<SyncState>({
    isSyncing: false,
    syncError: null,
    pagination: {},
  })

  const bulkUpsertAbsBooks = useBookStore(s => s.bulkUpsertAbsBooks)
  const updateServer = useAudiobookshelfStore(s => s.updateServer)

  // Ref to prevent duplicate syncs for the same server
  const syncingServers = useRef(new Set<string>())

  // Ref to hold latest pagination state — avoids stale closure in loadNextPage
  const paginationRef: MutableRefObject<SyncState['pagination']> = useRef(state.pagination)
  paginationRef.current = state.pagination

  /**
   * Map an ABS library item to a Book record.
   *
   * `apiKey` is passed in explicitly (read through `getAbsApiKey` by the
   * caller) so this mapper stays synchronous. Callers that cannot resolve
   * a credential pass `null`, which forces cover-URL / Bearer-auth paths
   * to omit the credential — behavior matches the pre-E95-S05 guard.
   */
  const mapAbsItemToBook = useCallback(
    (absItem: AbsLibraryItem, server: AudiobookshelfServer, apiKey: string): Book => {
      const bookId = crypto.randomUUID()

      // Handle narrators — ABS list endpoint returns `narratorName` (string), not `narrators` (array)
      const rawNarrators = (absItem.media.metadata.narrators ?? []) as Array<
        string | { name: string }
      >
      const narratorNames =
        rawNarrators.length > 0
          ? rawNarrators.map(n => (typeof n === 'string' ? n : n.name))
          : (((absItem.media.metadata as Record<string, unknown>).narratorName as string)
              ?.split(', ')
              .filter(Boolean) ?? [])

      // Map chapters — if ABS returns none, synthesize a single chapter so the player can stream
      const absChapters = absItem.media.chapters ?? []
      const chapters: BookChapter[] =
        absChapters.length > 0
          ? absChapters.map((ch, index) => ({
              id: ch.id,
              bookId,
              title: ch.title,
              order: index,
              position: { type: 'time' as const, seconds: ch.start },
            }))
          : [
              {
                id: `${bookId}-ch0`,
                bookId,
                title: 'Chapter 1',
                order: 0,
                position: { type: 'time' as const, seconds: 0 },
              },
            ]

      // Author names — ABS list endpoint returns `authorName` (string), not `authors` (array)
      const authorsArray = absItem.media.metadata.authors ?? []
      const authorNames =
        authorsArray.length > 0
          ? authorsArray.map(a => a.name).join(', ')
          : (((absItem.media.metadata as Record<string, unknown>).authorName as string) ?? '')

      // Cover URL — routed through backend proxy (handles auth + CORS)
      const coverUrl = AudiobookshelfService.getCoverUrl(server.url, absItem.id, apiKey)

      // Duration: prefer metadata.duration, fallback to media.duration (newer ABS versions)
      const duration = absItem.media.metadata.duration || absItem.media.duration || undefined

      return {
        id: bookId,
        title: absItem.media.metadata.title,
        author: authorNames || 'Unknown Author',
        narrator: narratorNames.length > 0 ? narratorNames.join(', ') : undefined,
        format: 'audiobook',
        status: 'unread',
        coverUrl,
        description: absItem.media.metadata.description,
        tags: [],
        chapters,
        source: {
          type: 'remote',
          url: server.url.replace(/\/+$/, ''),
          // apiKey resolved at sync time via the vault broker (E95-S05).
          auth: apiKey ? { bearer: apiKey } : undefined,
        },
        totalDuration: duration,
        progress: 0,
        isbn: absItem.media.metadata.isbn,
        absServerId: server.id,
        absItemId: absItem.id,
        createdAt: new Date().toISOString(),
        // E110-S02: Copy series metadata from ABS for local series grouping
        series: absItem.media.metadata.series || undefined,
        seriesSequence: absItem.media.metadata.seriesSequence || undefined,
      }
    },
    []
  )

  /**
   * Sync catalog from a single ABS server. Fetches page 0 for each selected library.
   */
  const syncCatalog = useCallback(
    async (server: AudiobookshelfServer, page = 0) => {
      // Prevent duplicate syncs
      if (syncingServers.current.has(server.id)) return
      syncingServers.current.add(server.id)

      setState(prev => ({ ...prev, isSyncing: true, syncError: null }))

      const LIMIT = 50

      try {
        const apiKey = await getAbsApiKey(server.id)
        if (!apiKey) {
          // Credential store returned null — key was never saved, was cleared
          // (browser storage wipe, profile switch), or OPFS failed to read.
          // Surface this instead of silently skipping: mark server auth-failed
          // (drives the red status dot) and prompt the user to re-enter the key.
          syncingServers.current.delete(server.id)
          setState(prev => ({
            ...prev,
            isSyncing: false,
            syncError: 'Audiobookshelf API key missing. Re-enter it in Settings.',
          }))
          await updateServer(server.id, { status: 'auth-failed' })
          toast.error('Audiobookshelf API key missing', {
            description: `Open Settings → Audiobookshelf → Edit "${server.name}" and re-enter your API key.`,
            duration: 8000,
          })
          return
        }

        // Fetch ALL pages for each selected library (not just page 0)
        const allMappedBooks: Book[] = []
        let totalItems = 0

        for (const libId of server.libraryIds) {
          let currentPage = page
          let hasMore = true

          while (hasMore) {
            const result = await AudiobookshelfService.fetchLibraryItems(
              server.url,
              apiKey,
              libId,
              { page: currentPage, limit: LIMIT }
            )

            if (!result.ok) {
              // First page failure = server issue. Later pages = might be transient, save what we have.
              if (currentPage === 0) {
                const error = result.error
                if (error.includes('Authentication') || error.includes('Access denied')) {
                  await updateServer(server.id, { status: 'auth-failed' })
                } else {
                  await updateServer(server.id, { status: 'offline' })
                  toast.warning('Audiobookshelf server is offline. Showing cached library.')
                }
                setState(prev => ({ ...prev, isSyncing: false, syncError: error }))
                return
              }
              // Later page failed — stop paginating but keep what we have
              break
            }

            totalItems = result.data.total
            for (const absItem of result.data.results) {
              if (absItem.mediaType && absItem.mediaType !== 'book') continue
              allMappedBooks.push(mapAbsItemToBook(absItem, server, apiKey))
            }

            // Check if there are more pages
            hasMore = (currentPage + 1) * LIMIT < result.data.total
            currentPage++

            // Brief pause between pages to avoid Cloudflare rate-limiting
            if (hasMore) await new Promise(r => setTimeout(r, 200))
          }
        }

        // Single bulk upsert: 1 IDB write + 1 state update instead of N
        const { removedCount } = await bulkUpsertAbsBooks(allMappedBooks)

        // Update pagination state
        setState(prev => ({
          ...prev,
          isSyncing: false,
          pagination: {
            ...prev.pagination,
            [server.id]: { currentPage: 0, totalItems },
          },
        }))

        // Update server sync timestamp
        await updateServer(server.id, {
          status: 'connected',
          lastSyncedAt: new Date().toISOString(),
        })

        toast.success(`Synced ${allMappedBooks.length} audiobooks`, { duration: 3000 })
        if (removedCount > 0) {
          toast.info(
            `Removed ${removedCount} audiobook${removedCount > 1 ? 's' : ''} no longer on server`,
            { duration: 5000 }
          )
        }

        // Auto-load collections and series after catalog sync (staggered to avoid Cloudflare 429)
        setTimeout(() => {
          const { loadSeries } = useAudiobookshelfStore.getState()
          for (const libId of server.libraryIds) {
            loadSeries(server.id, libId)
          }
        }, 3000)
        // Collections fetched separately with longer delay
        setTimeout(() => {
          const { loadCollections } = useAudiobookshelfStore.getState()
          loadCollections(server.id)
        }, 6000)
      } catch (err) {
        console.error('[useAudiobookshelfSync] Unexpected sync error:', err)
        toast.error('Failed to sync Audiobookshelf catalog.')
        setState(prev => ({
          ...prev,
          isSyncing: false,
          syncError: 'Unexpected sync error',
        }))
      } finally {
        syncingServers.current.delete(server.id)
      }
    },
    [mapAbsItemToBook, bulkUpsertAbsBooks, updateServer]
  )

  /**
   * Load the next page of items for a server (infinite scroll pagination).
   * Reads from paginationRef to avoid stale closure over state.pagination.
   */
  const loadNextPage = useCallback(
    async (server: AudiobookshelfServer) => {
      const pag = paginationRef.current[server.id]
      if (!pag) return
      const nextPage = pag.currentPage + 1
      if (nextPage * 50 >= pag.totalItems) return // No more pages
      await syncCatalog(server, nextPage)
    },
    [syncCatalog]
  )

  return {
    isSyncing: state.isSyncing,
    syncError: state.syncError,
    pagination: state.pagination,
    syncCatalog,
    loadNextPage,
  }
}
