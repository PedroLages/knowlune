import { useState, useEffect } from 'react'
import { ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import type { PDFDocumentProxy } from 'pdfjs-dist'

interface OutlineItem {
  title: string
  bold: boolean
  italic: boolean
  dest: string | Array<unknown> | null
  items: OutlineItem[]
}

interface PdfOutlinePanelProps {
  pdfDocument: PDFDocumentProxy | null
  onPageClick: (page: number) => void
}

function OutlineNode({
  item,
  depth,
  resolveDestination,
  onPageClick,
}: {
  item: OutlineItem
  depth: number
  resolveDestination: (dest: string | Array<unknown> | null) => Promise<number | null>
  onPageClick: (page: number) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = item.items && item.items.length > 0

  const handleClick = async () => {
    const page = await resolveDestination(item.dest)
    if (page !== null) {
      onPageClick(page)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm hover:bg-accent',
          item.bold && 'font-semibold',
          item.italic && 'italic'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        title={item.title}
      >
        {hasChildren && (
          <button
            onClick={e => {
              e.stopPropagation()
              setExpanded(prev => !prev)
            }}
            className="shrink-0 rounded p-0.5 hover:bg-accent"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                expanded && 'rotate-90'
              )}
            />
          </button>
        )}
        {!hasChildren && <span className="w-4.5 shrink-0" />}
        <span className="truncate">{item.title}</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {item.items.map((child, i) => (
            <OutlineNode
              key={`${child.title}-${i}`}
              item={child}
              depth={depth + 1}
              resolveDestination={resolveDestination}
              onPageClick={onPageClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PdfOutlinePanel({
  pdfDocument,
  onPageClick,
}: PdfOutlinePanelProps) {
  const [outline, setOutline] = useState<OutlineItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!pdfDocument) return
    let cancelled = false
    pdfDocument.getOutline().then(result => {
      if (!cancelled) {
        setOutline(result as OutlineItem[] | null)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [pdfDocument])

  const resolveDestination = async (dest: string | Array<unknown> | null): Promise<number | null> => {
    if (!pdfDocument || !dest) return null
    try {
      // Named destination (string) — resolve to explicit dest array first
      let explicitDest: Array<unknown> | null
      if (typeof dest === 'string') {
        explicitDest = await pdfDocument.getDestination(dest)
      } else {
        explicitDest = dest
      }
      if (!explicitDest || explicitDest.length === 0) return null
      // First element is the page ref
      const ref = explicitDest[0] as { num: number; gen: number }
      const pageIndex = await pdfDocument.getPageIndex(ref)
      return pageIndex + 1 // 0-indexed → 1-indexed
    } catch {
      return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
        Loading outline...
      </div>
    )
  }

  if (!outline || outline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No bookmarks in this document</p>
      </div>
    )
  }

  return (
    <div
      className="overflow-y-auto p-2"
      role="tree"
      aria-label="Document outline"
    >
      {outline.map((item, i) => (
        <OutlineNode
          key={`${item.title}-${i}`}
          item={item}
          depth={0}
          resolveDestination={resolveDestination}
          onPageClick={onPageClick}
        />
      ))}
    </div>
  )
}
