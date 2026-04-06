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

import { useCallback, useRef, useState } from 'react'
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

  const upsertAbsBook = useBookStore(s => s.upsertAbsBook)
  const updateServer = useAudiobookshelfStore(s => s.updateServer)

  // Ref to prevent duplicate syncs for the same server
  const syncingServers = useRef(new Set<string>())

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

      // Duration from metadata
      const duration = absItem.media.metadata.duration || undefined

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
        const results = await Promise.all(
          server.libraryIds.map(libId =>
            AudiobookshelfService.fetchLibraryItems(server.url, server.apiKey, libId, {
              page,
              limit: 50,
            })
          )
        )

        // Check for failures
        const failedResult = results.find(r => !r.ok)
        if (failedResult && !failedResult.ok) {
          // Determine if network error vs auth error
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

        // Process successful results
        let totalItems = 0
        for (const result of results) {
          if (!result.ok) continue
          totalItems += result.data.total
          for (const absItem of result.data.results) {
            const book = mapAbsItemToBook(absItem, server)
            await upsertAbsBook(book)
          }
        }

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
      } catch {
        // eslint-disable-next-line error-handling/no-silent-catch -- handled via toast below
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
    [mapAbsItemToBook, upsertAbsBook, updateServer]
  )

  /**
   * Load the next page of items for a server (infinite scroll pagination).
   */
  const loadNextPage = useCallback(
    async (server: AudiobookshelfServer) => {
      const pag = state.pagination[server.id]
      if (!pag) return
      const nextPage = pag.currentPage + 1
      if (nextPage * 50 >= pag.totalItems) return // No more pages
      await syncCatalog(server, nextPage)
    },
    [state.pagination, syncCatalog]
  )

  return {
    isSyncing: state.isSyncing,
    syncError: state.syncError,
    pagination: state.pagination,
    syncCatalog,
    loadNextPage,
  }
}
