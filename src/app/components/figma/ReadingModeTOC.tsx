/**
 * ReadingModeTOC — Mobile-only floating TOC button + slide-up sheet
 * for navigating lesson section headings during reading mode.
 *
 * Extracts h2/h3 headings from the lesson content container and
 * renders them as scrollable links in a bottom Sheet.
 *
 * @see E65-S05
 */

import { useState, useEffect, useCallback } from 'react'
import { List } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/app/components/ui/sheet'
import { useIsMobile } from '@/app/components/ui/use-mobile'

interface TOCEntry {
  id: string
  text: string
  level: number
}

function extractHeadings(): TOCEntry[] {
  // Look for headings within the lesson content area
  const container =
    document.querySelector('[data-testid="lesson-content"]') ?? document.querySelector('main')
  if (!container) return []
  const headings = container.querySelectorAll('h2, h3')
  const entries: TOCEntry[] = []
  headings.forEach((el, i) => {
    const text = el.textContent?.trim()
    if (!text) return
    // Ensure heading has an id for scroll targeting
    if (!el.id) {
      el.id = `toc-heading-${i}`
    }
    entries.push({
      id: el.id,
      text,
      level: el.tagName === 'H2' ? 2 : 3,
    })
  })
  return entries
}

interface ReadingModeTOCProps {
  isReadingMode: boolean
}

export function ReadingModeTOC({ isReadingMode }: ReadingModeTOCProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [headings, setHeadings] = useState<TOCEntry[]>([])

  // Re-extract headings when sheet opens or reading mode activates
  useEffect(() => {
    if (isReadingMode && isMobile) {
      // Delay to allow DOM to settle after reading mode class changes
      const timer = setTimeout(() => {
        setHeadings(extractHeadings())
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isReadingMode, isMobile])

  const handleNavigate = useCallback(
    (id: string) => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      setOpen(false)
    },
    [],
  )

  if (!isMobile || !isReadingMode) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-20 right-4 z-40 size-11 rounded-full border border-border bg-card shadow-lg"
          aria-label="Table of contents"
          data-testid="reading-toc-button"
        >
          <List className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[60vh] rounded-t-2xl">
        <SheetTitle className="mb-4">Table of Contents</SheetTitle>
        {headings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No section headings found.</p>
        ) : (
          <nav aria-label="Lesson sections" className="flex flex-col gap-1 overflow-y-auto pb-4">
            {headings.map(h => (
              <button
                key={h.id}
                onClick={() => handleNavigate(h.id)}
                className={`min-h-[44px] rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted ${
                  h.level === 3 ? 'pl-6 text-sm text-muted-foreground' : 'text-sm font-medium text-foreground'
                }`}
              >
                {h.text}
              </button>
            ))}
          </nav>
        )}
      </SheetContent>
    </Sheet>
  )
}
