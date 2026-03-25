import { useEffect, useRef } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface PdfSearchBarProps {
  searchQuery: string
  matches: { pageNumber: number; index: number; length: number }[]
  activeMatchIndex: number
  isExtracting: boolean
  setSearchQuery: (query: string) => void
  nextMatch: () => void
  prevMatch: () => void
  closeSearch: () => void
}

export function PdfSearchBar({
  searchQuery,
  matches,
  activeMatchIndex,
  isExtracting,
  setSearchQuery,
  nextMatch,
  prevMatch,
  closeSearch,
}: PdfSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        prevMatch()
      } else {
        nextMatch()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeSearch()
    }
  }

  const renderMatchStatus = () => {
    if (isExtracting) {
      return <span className="whitespace-nowrap text-xs text-muted-foreground">Extracting...</span>
    }

    if (!searchQuery.trim()) {
      return null
    }

    if (matches.length === 0) {
      return <span className="whitespace-nowrap text-xs text-muted-foreground">No matches</span>
    }

    return (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {activeMatchIndex + 1} of {matches.length}
      </span>
    )
  }

  return (
    <div
      data-testid="pdf-search-bar"
      className="flex items-center gap-2 border-b border-border bg-muted px-3 py-1.5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          data-testid="pdf-search-input"
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in document..."
          aria-label="Search in document"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {renderMatchStatus()}

      <Button
        data-testid="pdf-search-prev"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={prevMatch}
        disabled={matches.length === 0}
        aria-label="Previous match"
      >
        <ChevronUp className="size-4" />
      </Button>

      <Button
        data-testid="pdf-search-next"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={nextMatch}
        disabled={matches.length === 0}
        aria-label="Next match"
      >
        <ChevronDown className="size-4" />
      </Button>

      <Button
        data-testid="pdf-search-close"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={closeSearch}
        aria-label="Close search"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
