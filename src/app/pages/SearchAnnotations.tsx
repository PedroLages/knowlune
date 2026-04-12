/**
 * Cross-book Search page (E109-S05).
 *
 * Full-text search across all highlights and vocabulary items.
 * Results are grouped by book with navigation to source locations.
 */
import { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef } from 'react'
import { useSearchParams, Link } from 'react-router'
import { toast } from 'sonner'
import { Search, BookOpen, Type, Highlighter, ChevronRight, X } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { db } from '@/db/schema'
import type { BookHighlight, VocabularyItem, Book } from '@/data/types'

type ResultType = 'all' | 'highlights' | 'vocabulary'

interface HighlightResult {
  kind: 'highlight'
  item: BookHighlight
  book: Book | undefined
}

interface VocabularyResult {
  kind: 'vocabulary'
  item: VocabularyItem
  book: Book | undefined
}

type SearchResult = HighlightResult | VocabularyResult

/**
 * Highlights ALL matching occurrences within text, returning React nodes.
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const qLower = query.toLowerCase()
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === qLower
          ? <mark key={i} className="bg-warning/30 text-foreground rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  )
}

export function SearchAnnotations() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<ResultType>('all')
  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([])
  const [books, setBooks] = useState<Map<string, Book>>(new Map())
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Defer query so the input stays responsive while data loads
  const deferredQuery = useDeferredValue(query)

  // Only load data from Dexie when the user has typed something
  useEffect(() => {
    if (!deferredQuery.trim()) {
      setHighlights([])
      setVocabulary([])
      setBooks(new Map())
      setIsLoaded(false)
      return
    }

    let cancelled = false
    async function load() {
      try {
        const [allHighlights, allVocab, allBooks] = await Promise.all([
          db.bookHighlights.limit(500).toArray(),
          db.vocabularyItems.limit(500).toArray(),
          db.books.toArray(),
        ])
        if (cancelled) return
        setHighlights(allHighlights)
        setVocabulary(allVocab)
        setBooks(new Map(allBooks.map(b => [b.id, b])))
        setIsLoaded(true)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load annotations'
        setLoadError(message)
        toast.error('Failed to load annotations. Please refresh the page.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [deferredQuery])

  // Sync query to URL with 300ms debounce to avoid polluting history
  const updateQuery = useCallback((value: string) => {
    setQuery(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        setSearchParams({ q: value }, { replace: true })
      } else {
        setSearchParams({}, { replace: true })
      }
    }, 300)
  }, [setSearchParams])

  // Filter results using deferred query for smooth input
  const results = useMemo<SearchResult[]>(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return []

    const matched: SearchResult[] = []

    if (filter === 'all' || filter === 'highlights') {
      for (const h of highlights) {
        const textMatch = h.textAnchor.toLowerCase().includes(q)
        const noteMatch = h.note?.toLowerCase().includes(q)
        if (textMatch || noteMatch) {
          matched.push({ kind: 'highlight', item: h, book: books.get(h.bookId) })
        }
      }
    }

    if (filter === 'all' || filter === 'vocabulary') {
      for (const v of vocabulary) {
        const wordMatch = v.word.toLowerCase().includes(q)
        const defMatch = v.definition?.toLowerCase().includes(q)
        const noteMatch = v.note?.toLowerCase().includes(q)
        if (wordMatch || defMatch || noteMatch) {
          matched.push({ kind: 'vocabulary', item: v, book: books.get(v.bookId) })
        }
      }
    }

    return matched
  }, [deferredQuery, filter, highlights, vocabulary, books])

  // Group by book
  const groupedResults = useMemo(() => {
    const groups = new Map<string, { book: Book | undefined; results: SearchResult[] }>()
    for (const r of results) {
      const bookId = r.item.bookId
      if (!groups.has(bookId)) {
        groups.set(bookId, { book: r.book, results: [] })
      }
      groups.get(bookId)!.results.push(r)
    }
    return Array.from(groups.entries())
  }, [results])

  const highlightCount = results.filter(r => r.kind === 'highlight').length
  const vocabularyCount = results.filter(r => r.kind === 'vocabulary').length

  return (
    <div className="space-y-6" data-testid="search-annotations-page">
      <div className="flex items-center gap-3">
        <Search className="size-6 text-brand" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground">Search Annotations</h1>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          placeholder="Search highlights and vocabulary..."
          value={query}
          onChange={e => updateQuery(e.target.value)}
          className="pl-10 pr-10"
          aria-label="Search annotations"
          autoFocus
          data-testid="search-input"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-8"
            onClick={() => updateQuery('')}
            aria-label="Clear search"
            data-testid="clear-search"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={v => setFilter(v as ResultType)}>
        <TabsList>
          <TabsTrigger value="all" data-testid="filter-all">
            All{query.trim() ? ` (${results.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="highlights" data-testid="filter-highlights">
            <Highlighter className="size-3.5 mr-1" />
            Highlights{query.trim() ? ` (${highlightCount})` : ''}
          </TabsTrigger>
          <TabsTrigger value="vocabulary" data-testid="filter-vocabulary">
            <Type className="size-3.5 mr-1" />
            Vocabulary{query.trim() ? ` (${vocabularyCount})` : ''}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Results */}
      {loadError ? (
        <div className="text-center py-12" data-testid="load-error">
          <p className="text-destructive">{loadError}</p>
        </div>
      ) : !query.trim() ? (
        <div className="text-center py-12" data-testid="empty-state">
          <Search className="size-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Enter a search term to find highlights and vocabulary across all your books.</p>
        </div>
      ) : query.trim() && !isLoaded ? (
        <p className="text-muted-foreground text-center py-8" role="status">Loading...</p>
      ) : results.length === 0 ? (
        <div className="text-center py-12" data-testid="no-results">
          <p className="text-muted-foreground">No results found for &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-6" data-testid="search-results">
          {groupedResults.map(([bookId, group]) => (
            <Card key={bookId} data-testid="book-group">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-brand" />
                  <Link
                    to={`/library/${bookId}/annotations`}
                    className="font-semibold text-foreground hover:text-brand transition-colors"
                    data-testid="book-group-title"
                  >
                    {group.book?.title ?? 'Unknown Book'}
                  </Link>
                  <Badge variant="secondary" className="ml-auto">
                    {group.results.length} {group.results.length === 1 ? 'result' : 'results'}
                  </Badge>
                </div>
                <ul className="divide-y divide-border" role="list" aria-label={`Results from ${group.book?.title ?? 'Unknown Book'}`}>
                  {group.results.map(r => (
                    <li key={r.item.id} className="py-2.5 first:pt-0 last:pb-0">
                      {r.kind === 'highlight' ? (
                        <div className="flex items-start gap-3" data-testid="highlight-result">
                          <Highlighter className="size-4 mt-0.5 text-warning shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground leading-relaxed">
                              {highlightMatch(r.item.textAnchor, query)}
                            </p>
                            {r.item.note && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                Note: {highlightMatch(r.item.note, query)}
                              </p>
                            )}
                          </div>
                          <Link
                            to={`/library/${r.item.bookId}/read`}
                            className="shrink-0 text-muted-foreground hover:text-brand"
                            aria-label="Open in reader"
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3" data-testid="vocabulary-result">
                          <Type className="size-4 mt-0.5 text-brand shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {highlightMatch(r.item.word, query)}
                            </p>
                            {r.item.definition && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {highlightMatch(r.item.definition, query)}
                              </p>
                            )}
                            {r.item.note && (
                              <p className="text-xs text-muted-foreground mt-0.5 italic">
                                Note: {highlightMatch(r.item.note, query)}
                              </p>
                            )}
                          </div>
                          <Link
                            to={`/library/${r.item.bookId}/read`}
                            className="shrink-0 text-muted-foreground hover:text-brand"
                            aria-label="Open in reader"
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
