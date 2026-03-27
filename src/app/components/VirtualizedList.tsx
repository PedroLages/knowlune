import { useRef, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualizedListProps<T> {
  /** Items to render */
  items: T[]
  /** Estimated height of each item in pixels */
  estimateSize?: number
  /** Number of items to render outside visible area */
  overscan?: number
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode
  /** Key extractor for stable identity */
  getItemKey: (item: T, index: number) => string | number
  /** CSS class for the scroll container */
  className?: string
  /** Max height for the scroll container (default: 80vh) */
  maxHeight?: string
  /** data-testid for the container */
  'data-testid'?: string
}

/**
 * Virtualized single-column list using @tanstack/react-virtual.
 * Only renders visible items + overscan buffer in the DOM.
 * Handles variable-height items via measureElement.
 * Resets scroll position when items array reference changes.
 */
export function VirtualizedList<T>({
  items,
  estimateSize = 120,
  overscan = 5,
  renderItem,
  getItemKey,
  className = '',
  maxHeight = '80vh',
  'data-testid': testId,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: index => getItemKey(items[index], index),
    measureElement: el => el?.getBoundingClientRect().height ?? estimateSize,
  })

  // Reset scroll position when items change (filter/search)
  const prevCountRef = useRef(items.length)
  useEffect(() => {
    if (items.length !== prevCountRef.current) {
      virtualizer.scrollToOffset(0)
      prevCountRef.current = items.length
    }
  }, [items.length, virtualizer])

  const measureRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        virtualizer.measureElement(node)
      }
    },
    [virtualizer]
  )

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ maxHeight }}
      data-testid={testId}
    >
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualItems.map(virtualRow => {
          const item = items[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              ref={measureRef}
              data-index={virtualRow.index}
              className="absolute left-0 w-full"
              style={{
                top: `${virtualRow.start}px`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
