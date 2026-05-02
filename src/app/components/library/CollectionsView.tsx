/**
 * Collections view — grid of CollectionCards matching Stitch design.
 *
 * First collection is expanded by default (spans 2 columns). Clicking a
 * collapsed card expands it and collapses the previous one.
 *
 * @since E102-S03
 * @modified Library Redesign — grid layout, expand/collapse
 */

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { CollectionCard } from '@/app/components/library/CollectionCard'

export function CollectionsView() {
  const servers = useAudiobookshelfStore(s => s.servers)
  const collections = useAudiobookshelfStore(s => s.collections)
  const isLoadingCollections = useAudiobookshelfStore(s => s.isLoadingCollections)
  const loadCollections = useAudiobookshelfStore(s => s.loadCollections)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Load collections on mount when a connected server exists
  useEffect(() => {
    const connectedServer = servers.find(s => s.status === 'connected')
    if (connectedServer && connectedServer.libraryIds.length > 0) {
      loadCollections(connectedServer.id, connectedServer.libraryIds[0])
    }
  }, [servers, loadCollections])

  // Auto-expand first collection when loaded
  useEffect(() => {
    if (collections.length > 0 && expandedId === null) {
      setExpandedId(collections[0].id)
    }
  }, [collections, expandedId])

  // Loading skeletons
  if (isLoadingCollections) {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
        data-testid="collections-loading"
      >
        <div className="xl:col-span-2 h-64 rounded-xl bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
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

  // Collections grid
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start"
      data-testid="collections-view"
    >
      {collections.map(c => (
        <div key={c.id} className={expandedId === c.id ? 'xl:col-span-2' : ''}>
          <CollectionCard
            collection={c}
            expanded={expandedId === c.id}
            onExpand={() => setExpandedId(c.id)}
          />
        </div>
      ))}
      {/* Create Collection placeholder */}
      <div
        className="rounded-xl bg-card/50 border-2 border-dashed border-border/30 p-6 flex flex-col items-center justify-center gap-4 hover:border-brand/50 transition-colors group cursor-pointer min-h-[350px]"
        data-testid="create-collection-placeholder"
      >
        <div className="size-16 rounded-full bg-muted flex items-center justify-center group-hover:bg-brand group-hover:text-brand-foreground transition-all">
          <Plus className="size-8" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Create Collection</h2>
          <p className="text-sm text-muted-foreground px-6 mt-1">
            Bundle your favorite audiobooks into a custom theme.
          </p>
        </div>
      </div>
    </div>
  )
}
