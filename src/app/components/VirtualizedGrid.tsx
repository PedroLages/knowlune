import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualizedGridProps<T> {
  /** Items to render in the grid */
  items: T[]
  /** Estimated height of each row in pixels */
  estimateRowHeight?: number
  /** Number of rows to render outside visible area */
  overscan?: number
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode
  /** Key extractor for stable identity */
  getItemKey: (item: T, index: number) => string | number
  /** CSS class for the grid rows (Tailwind grid classes) */
  gridClassName?: string
  /** CSS class for the scroll container */
  className?: string
  /** Max height for the scroll container (default: 80vh) */
  maxHeight?: string
  /** data-testid for the container */
  'data-testid'?: string
  /** Gap between items (default: 24px / gap-6) */
  gap?: number
}

/**
 * Determines the current column count based on container width and
 * Tailwind responsive breakpoints used in the grid.
 *
 * Mirrors breakpoints: sm:2 md:3 lg:3(authors)/4(courses) xl:4(authors)/5(courses)
 * We accept a callback to let each page define its own responsive columns.
 */
function useResponsiveColumns(
  containerRef: React.RefObject<HTMLDivElement | null>,
  getColumns?: (width: number) => number
): number {
  const [columns, setColumns] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const defaultGetColumns = (w: number) => {
      if (w >= 1280) return 5 // xl
      if (w >= 1024) return 4 // lg
      if (w >= 768) return 3 // md
      if (w >= 640) return 2 // sm
      return 1
    }

    const resolver = getColumns ?? defaultGetColumns

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setColumns(resolver(entry.contentRect.width))
      }
    })

    // Set initial value
    setColumns(resolver(el.offsetWidth))
    observer.observe(el)

    return () => observer.disconnect()
  }, [containerRef, getColumns])

  return columns
}

/**
 * Virtualized grid using @tanstack/react-virtual.
 * Virtualizes rows (each row contains `columns` items).
 * Only renders visible rows + overscan buffer in the DOM.
 * Handles variable-height rows via measureElement.
 * Resets scroll position when items array length changes.
 */
export function VirtualizedGrid<T>({
  items,
  estimateRowHeight = 350,
  overscan = 3,
  renderItem,
  getItemKey,
  gridClassName = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6',
  className = '',
  maxHeight = '80vh',
  'data-testid': testId,
  gap = 24,
}: VirtualizedGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const getColumns = useMemo(() => {
    // Extract column counts from gridClassName
    const colMap: Array<[number, number]> = []
    const patterns = [
      [/\bxl:grid-cols-(\d+)/, 1280],
      [/\blg:grid-cols-(\d+)/, 1024],
      [/\bmd:grid-cols-(\d+)/, 768],
      [/\bsm:grid-cols-(\d+)/, 640],
      [/\bgrid-cols-(\d+)/, 0],
    ] as const

    for (const [pattern, breakpoint] of patterns) {
      const match = gridClassName.match(pattern)
      if (match) {
        colMap.push([breakpoint, parseInt(match[1], 10)])
      }
    }

    // Sort by breakpoint descending
    colMap.sort((a, b) => b[0] - a[0])

    return (width: number) => {
      for (const [bp, cols] of colMap) {
        if (width >= bp) return cols
      }
      return 1
    }
  }, [gridClassName])

  const columns = useResponsiveColumns(parentRef, getColumns)

  const rowCount = Math.ceil(items.length / columns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    measureElement: el => el?.getBoundingClientRect().height ?? estimateRowHeight,
  })

  // Reset scroll position when items change (filter/search)
  // Debounced to avoid scroll jitter during rapid bulk-import additions
  const prevLengthRef = useRef(items.length)
  useEffect(() => {
    if (items.length !== prevLengthRef.current) {
      const timer = setTimeout(() => {
        virtualizer.scrollToOffset(0)
      }, 300)
      prevLengthRef.current = items.length
      return () => clearTimeout(timer)
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

  const virtualRows = virtualizer.getVirtualItems()

  // Don't virtualize small lists (fewer items than would fill 2 screens)
  if (items.length <= columns * 6) {
    return (
      <div className={gridClassName} data-testid={testId}>
        {items.map((item, index) => (
          <div key={getItemKey(item, index)}>{renderItem(item, index)}</div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ maxHeight }}
      data-testid={testId}
    >
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualRows.map(virtualRow => {
          const startIndex = virtualRow.index * columns
          const rowItems = items.slice(startIndex, startIndex + columns)

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
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gap: `${gap}px`,
                }}
              >
                {rowItems.map((item, colIndex) => {
                  const globalIndex = startIndex + colIndex
                  return (
                    <div key={getItemKey(item, globalIndex)}>{renderItem(item, globalIndex)}</div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
