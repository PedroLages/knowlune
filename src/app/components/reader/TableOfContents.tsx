/**
 * TableOfContents — EPUB TOC panel using shadcn Sheet (slides from left).
 *
 * Renders the epub.js navigation TOC as a navigable list.
 * Highlights the current chapter. Clicking a chapter navigates via rendition.
 *
 * @module TableOfContents
 */
import type { NavItem } from 'epubjs'
import type { Rendition } from 'epubjs'
import { BookOpen, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { cn } from '@/app/components/ui/utils'

interface TableOfContentsProps {
  open: boolean
  onClose: () => void
  toc: NavItem[]
  /** Current CFI or href for active chapter detection */
  currentHref?: string
  rendition: Rendition | null
}

interface TocItemProps {
  item: NavItem
  depth: number
  currentHref?: string
  onNavigate: (href: string) => void
}

function TocItem({ item, depth, currentHref, onNavigate }: TocItemProps) {
  // Match by exact href or href without anchor fragment
  const normalizedCurrent = currentHref?.split('#')[0]
  const normalizedItem = item.href.split('#')[0]
  const isActive =
    currentHref === item.href ||
    normalizedCurrent === normalizedItem ||
    currentHref?.startsWith(normalizedItem)

  return (
    <>
      <li role="listitem" aria-current={isActive ? 'true' : undefined}>
        <button
          onClick={() => onNavigate(item.href)}
          className={cn(
            'w-full text-left py-2.5 px-3 rounded-lg transition-colors text-sm',
            'hover:bg-muted/60 active:bg-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            isActive ? 'text-brand font-medium bg-brand-soft/40' : 'text-foreground'
          )}
          style={{ paddingLeft: `${(depth + 1) * 12}px` }}
        >
          {item.label.trim()}
        </button>
      </li>

      {/* Nested items */}
      {item.subitems && item.subitems.length > 0 && (
        <ul role="list" className="space-y-0.5">
          {item.subitems.map(subitem => (
            <TocItem
              key={subitem.id}
              item={subitem}
              depth={depth + 1}
              currentHref={currentHref}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </>
  )
}

export function TableOfContents({
  open,
  onClose,
  toc,
  currentHref,
  rendition,
}: TableOfContentsProps) {
  const handleNavigate = (href: string) => {
    if (!rendition) return
    rendition.display(href).catch(() => {
      // silent-catch-ok: navigation failure is non-fatal; user can retry by tapping again
    })
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={open => !open && onClose()}>
      <SheetContent side="left" className="w-80 p-0 flex flex-col" data-testid="toc-panel">
        <SheetHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
            <SheetTitle className="text-base font-semibold">Table of Contents</SheetTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close table of contents"
            className="size-8 shrink-0"
          >
            <X className="size-4" />
          </Button>
        </SheetHeader>

        <ScrollArea className="flex-1 px-2 py-2">
          {toc.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No table of contents available
            </p>
          ) : (
            <ul role="list" aria-label="Table of contents" className="space-y-0.5">
              {toc.map(item => (
                <TocItem
                  key={item.id}
                  item={item}
                  depth={0}
                  currentHref={currentHref}
                  onNavigate={handleNavigate}
                />
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
