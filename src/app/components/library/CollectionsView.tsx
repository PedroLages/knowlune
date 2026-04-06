/**
 * Collections view — lists all ABS collections with loading/empty states.
 *
 * Renders a vertical list of CollectionCard components, following the same
 * layout pattern as the Series view (E102-S02).
 *
 * @since E102-S03
 */

import { useEffect } from 'react'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { CollectionCard } from '@/app/components/library/CollectionCard'

export function CollectionsView() {
  const servers = useAudiobookshelfStore(s => s.servers)
  const collections = useAudiobookshelfStore(s => s.collections)
  const isLoadingCollections = useAudiobookshelfStore(s => s.isLoadingCollections)
  const loadCollections = useAudiobookshelfStore(s => s.loadCollections)

  // Load collections on mount when a connected server exists
  useEffect(() => {
    const connectedServer = servers.find(s => s.status === 'connected')
    if (connectedServer) {
      loadCollections(connectedServer.id)
    }
  }, [servers, loadCollections])

  // Loading skeletons
  if (isLoadingCollections) {
    return (
      <div className="flex flex-col gap-3" data-testid="collections-loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // Empty state
  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-muted-foreground" data-testid="collections-empty-state">
          No collections found. Create collections in Audiobookshelf to group your audiobooks.
        </p>
      </div>
    )
  }

  // Collections list
  return (
    <div className="flex flex-col gap-3" data-testid="collections-view">
      {collections.map(c => (
        <CollectionCard key={c.id} collection={c} />
      ))}
    </div>
  )
}
