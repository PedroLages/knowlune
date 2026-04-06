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
   */
  const mapAbsItemToBook = useCallback(
    (absItem: AbsLibraryItem, server: AudiobookshelfServer): Book => {
      const bookId = crypto.randomUUID()

      // Handle narrators — typed as string[] but runtime may return {name: string}[] from newer ABS versions
      const rawNarrators = (absItem.media.metadata.narrators ?? []) as Array<
        string | { name: string }
      >
      const narratorNames = rawNarrators.map(n => (typeof n === 'string' ? n : n.name))

      // Map chapters
      const chapters: BookChapter[] = (absItem.media.chapters ?? []).map((ch, index) => ({
        id: ch.id,
        bookId,
        title: ch.title,
        order: index,
        position: { type: 'time' as const, seconds: ch.start },
      }))

      // Author names
      const authorNames = (absItem.media.metadata.authors ?? []).map(a => a.name).join(', ')

      // Cover URL with token auth (img elements can't send Authorization header)
      const coverUrl = `${AudiobookshelfService.getCoverUrl(server.url, absItem.id)}?token=${encodeURIComponent(server.apiKey)}`

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
          url: `${server.url.replace(/\/+$/, '')}/api/items/${absItem.id}`,
        },
        totalDuration: duration,
        progress: 0,
        isbn: absItem.media.metadata.isbn,
        absServerId: server.id,
        absItemId: absItem.id,
        createdAt: new Date().toISOString(),
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

      try {
        // Fetch all selected libraries in parallel (NFR1: sub-1s on LAN)
        // Use allSettled so one failing library doesn't discard successful ones
        const settled = await Promise.allSettled(
          server.libraryIds.map(libId =>
            AudiobookshelfService.fetchLibraryItems(server.url, server.apiKey, libId, {
              page,
              limit: 50,
            })
          )
        )

        // Separate fulfilled (with ok/error) from rejected (network-level failures)
        const fulfilled = settled
          .filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof AudiobookshelfService.fetchLibraryItems>>> => s.status === 'fulfilled')
          .map(s => s.value)
        const rejected = settled.filter(s => s.status === 'rejected')

        // If ALL requests failed, handle as server error
        if (fulfilled.length === 0) {
          const reason = rejected[0] && 'reason' in rejected[0] ? String(rejected[0].reason) : 'Unknown error'
          await updateServer(server.id, { status: 'offline' })
          toast.warning('Audiobookshelf server is offline. Showing cached library.')
          setState(prev => ({ ...prev, isSyncing: false, syncError: reason }))
          return
        }

        // Check for auth/connection failures in fulfilled results
        const failedResult = fulfilled.find(r => !r.ok)
        if (failedResult && !failedResult.ok) {
          const error = failedResult.error
          if (error.includes('Authentication') || error.includes('Access denied')) {
            await updateServer(server.id, { status: 'auth-failed' })
          } else {
            await updateServer(server.id, { status: 'offline' })
            toast.warning('Audiobookshelf server is offline. Showing cached library.')
          }
          setState(prev => ({ ...prev, isSyncing: false, syncError: error }))
          return
        }

        // Process successful results — batch all books for a single IDB write
        let totalItems = 0
        const allMappedBooks: Book[] = []
        for (const result of fulfilled) {
          if (!result.ok) continue
          totalItems += result.data.total
          for (const absItem of result.data.results) {
            allMappedBooks.push(mapAbsItemToBook(absItem, server))
          }
        }

        // Single bulk upsert: 1 IDB write + 1 state update instead of N
        await bulkUpsertAbsBooks(allMappedBooks)

        // Update pagination state
        setState(prev => ({
          ...prev,
          isSyncing: false,
          pagination: {
            ...prev.pagination,
            [server.id]: { currentPage: page, totalItems },
          },
        }))

        // Update server sync timestamp
        await updateServer(server.id, {
          status: 'connected',
          lastSyncedAt: new Date().toISOString(),
        })
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
