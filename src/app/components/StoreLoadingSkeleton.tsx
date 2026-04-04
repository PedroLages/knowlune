import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'

interface StoreLoadingSkeletonProps {
  /** Number of card skeletons to show. Default 3. */
  cards?: number
  /** Layout variant: 'grid' for card grids, 'list' for stacked items. Default 'grid'. */
  variant?: 'grid' | 'list'
}

/**
 * Loading skeleton shown while a lazily-loaded Zustand store
 * initializes from IndexedDB. Uses DelayedFallback to avoid
 * flash on fast loads (< 200ms).
 *
 * @example
 * ```tsx
 * const { notes, isLoading } = useNoteStore()
 * useLazyStore(loadNotes)
 *
 * if (isLoading) return <StoreLoadingSkeleton cards={4} />
 * ```
 */
export function StoreLoadingSkeleton({ cards = 3, variant = 'grid' }: StoreLoadingSkeletonProps) {
  return (
    <DelayedFallback>
      <div role="status" aria-busy="true" aria-label="Loading content" className="space-y-6 p-1">
        {/* Page title skeleton */}
        <Skeleton className="h-8 w-48" />

        {/* Optional filter bar skeleton */}
        <Skeleton className="h-10 w-full max-w-md" />

        {variant === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: cards }, (_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: cards }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}
      </div>
    </DelayedFallback>
  )
}
