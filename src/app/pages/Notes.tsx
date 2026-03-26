import React, { useEffect, useMemo, useState, Suspense } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router'
import {
  Search,
  StickyNote,
  ArrowUpDown,
  ArrowLeft,
  BookOpen,
  Clock,
  Info,
  Download,
  BookmarkIcon,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/app/components/ui/utils'
import { Input } from '@/app/components/ui/input'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { BookmarksSection } from '@/app/components/figma/BookmarksSection'
import { useNoteStore } from '@/stores/useNoteStore'
import { searchNotesWithContext } from '@/lib/noteSearch'
import { getAllNoteTags } from '@/lib/progress'
import { highlightMatches, buildHighlightPatterns } from '@/lib/searchUtils'
import { exportNoteAsMarkdown } from '@/lib/noteExport'
import { EmptyState } from '@/app/components/EmptyState'
import { toast } from 'sonner'
import { useCourseStore } from '@/stores/useCourseStore'
import { formatTimestamp } from '@/lib/format'
import { stripHtml } from '@/lib/textUtils'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'
import type { Note } from '@/data/types'

// Lazy-loaded heavy components (TipTap renderer pulls ~400KB, QAChatPanel pulls AI infra)
const ReadOnlyContent = React.lazy(() =>
  import('@/app/components/notes/ReadOnlyContent').then(m => ({ default: m.ReadOnlyContent }))
)
const QAChatPanel = React.lazy(() =>
  import('@/app/components/figma/QAChatPanel').then(m => ({ default: m.QAChatPanel }))
)
const RelatedConceptsPanel = React.lazy(() =>
  import('@/app/components/notes/RelatedConceptsPanel').then(m => ({
    default: m.RelatedConceptsPanel,
  }))
)

type SortOption = 'most-recent' | 'oldest-first' | 'by-course'

/** Truncate plain text to ~120 characters. */
function truncatePreview(text: string, max = 120): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '\u2026'
}

interface EnrichedNote {
  note: Note
  courseName: string
  lessonTitle: string
  plainPreview: string
}

function sortNotes(notes: EnrichedNote[], sort: SortOption): EnrichedNote[] {
  const sorted = [...notes]
  switch (sort) {
    case 'most-recent':
      return sorted.sort(
        (a, b) => new Date(b.note.updatedAt).getTime() - new Date(a.note.updatedAt).getTime()
      )
    case 'oldest-first':
      return sorted.sort(
        (a, b) => new Date(a.note.updatedAt).getTime() - new Date(b.note.updatedAt).getTime()
      )
    case 'by-course':
      return sorted.sort((a, b) => {
        const courseCompare = a.courseName.localeCompare(b.courseName)
        if (courseCompare !== 0) return courseCompare
        return new Date(b.note.updatedAt).getTime() - new Date(a.note.updatedAt).getTime()
      })
  }
}

export function Notes() {
  const allCourses = useCourseStore(s => s.courses)
  const notes = useNoteStore(s => s.notes)
  const isLoading = useNoteStore(s => s.isLoading)
  const loadNotes = useNoteStore(s => s.loadNotes)
  const navigate = useNavigate()
  const location = useLocation()
  const fromNoteId = (location.state as { fromNote?: string } | null)?.fromNote ?? null
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get('tab') === 'bookmarks' ? 'bookmarks' : 'notes'

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sortOption, setSortOption] = useState<SortOption>('most-recent')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [useSemanticSearch, setUseSemanticSearch] = useState(false)
  const [semanticResults, setSemanticResults] = useState<Array<{ noteId: string; score: number }>>(
    []
  )

  // Build lookup maps from course data
  const { courseNames, lessonTitles } = useMemo(() => {
    const cn = new Map<string, string>()
    const lt = new Map<string, string>()
    for (const course of allCourses) {
      cn.set(course.id, course.shortTitle || course.title)
      for (const mod of course.modules) {
        for (const lesson of mod.lessons) {
          lt.set(lesson.id, lesson.title)
        }
      }
    }
    return { courseNames: cn, lessonTitles: lt }
  }, [allCourses])

  function enrichNotes(rawNotes: Note[]): EnrichedNote[] {
    return rawNotes.map(note => ({
      note,
      courseName: courseNames.get(note.courseId) ?? note.courseId,
      lessonTitle: lessonTitles.get(note.videoId) ?? note.videoId,
      plainPreview: truncatePreview(stripHtml(note.content)),
    }))
  }

  // Track vector store size reactively via a custom event dispatched by loadAll()
  // vectorStorePersistence is dynamically imported to avoid pulling AI infra into main chunk
  const [vectorStoreSize, setVectorStoreSize] = useState(0)
  useEffect(() => {
    let cancelled = false
    import('@/ai/vector-store').then(({ vectorStorePersistence }) => {
      if (!cancelled) setVectorStoreSize(vectorStorePersistence.size)
    })
    const updateSize = () => {
      import('@/ai/vector-store').then(({ vectorStorePersistence }) => {
        if (!cancelled) setVectorStoreSize(vectorStorePersistence.size)
      })
    }
    window.addEventListener('vector-store-ready', updateSize)
    return () => {
      cancelled = true
      window.removeEventListener('vector-store-ready', updateSize)
    }
  }, [])
  const semanticSearchAvailable = supportsWorkers() && vectorStoreSize > 0

  // Load all notes on mount
  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // Scroll to hash anchor (e.g., #note-note-1 from citation clicks)
  useEffect(() => {
    const hash = window.location.hash
    if (hash && notes.length > 0) {
      // Wait for DOM to render, then scroll
      const targetId = hash.slice(1) // Remove '#'
      setTimeout(() => {
        const element = document.getElementById(targetId)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Expand the note for better visibility
          const noteId = targetId.replace('note-', '')
          setExpandedNoteId(noteId)
        }
      }, 100)
    }
  }, [notes])

  // Load available tags when notes change
  useEffect(() => {
    let ignore = false

    getAllNoteTags()
      .then(tags => {
        if (!ignore) setAvailableTags(tags)
      })
      .catch(err => {
        // silent-catch-ok — tags are supplementary UI; notes still display without them
        console.error('[Notes] Failed to load tags:', err)
      })

    return () => {
      ignore = true
    }
  }, [notes])

  // Debounce search input (150ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 150)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Semantic search effect — uses main-thread store (vectorStorePersistence) directly
  // to avoid requiring a load-index round-trip to the search worker.
  useEffect(() => {
    if (!useSemanticSearch || !debouncedQuery.trim() || !supportsWorkers()) {
      setSemanticResults([])
      return
    }

    let cancelled = false
    // Dynamic import to avoid pulling AI infra into main Notes chunk
    Promise.all([import('@/ai/workers/coordinator'), import('@/ai/vector-store')])
      .then(([{ generateEmbeddings }, { vectorStorePersistence }]) =>
        generateEmbeddings([debouncedQuery]).then(([queryVector]) => {
          const store = vectorStorePersistence.getStore()
          const rawResults = store.search(Array.from(queryVector), 10)
          return rawResults.map(r => ({ noteId: r.id, score: r.similarity }))
        })
      )
      .then(results => {
        if (!cancelled) setSemanticResults(results)
      })
      .catch(err => {
        // silent-catch-ok — graceful fallback to text search; not a user-blocking error
        console.error('[Notes] Semantic search failed:', err)
        if (!cancelled) setUseSemanticSearch(false) // Fallback to text search
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, useSemanticSearch])

  // Enrich notes ONCE in parent
  // Deps intentionally include courseNames/lessonTitles to re-enrich when lookup maps change
  const enriched = useMemo(() => enrichNotes(notes), [notes, courseNames, lessonTitles])

  // Build semantic score lookup for display
  const semanticScoreMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of semanticResults) {
      map.set(r.noteId, r.score)
    }
    return map
  }, [semanticResults])

  // Apply search filter (text or semantic)
  const searchResultIds = useMemo(() => {
    if (!debouncedQuery.trim()) return null
    if (useSemanticSearch && semanticResults.length > 0) {
      return new Set(semanticResults.map(r => r.noteId))
    }
    if (!useSemanticSearch) {
      const results = searchNotesWithContext(debouncedQuery)
      return new Set(results.map(r => r.id))
    }
    return null
  }, [debouncedQuery, useSemanticSearch, semanticResults])

  // Apply tag filter (client-side from already-loaded notes array)
  const tagFilteredIds = useMemo(() => {
    if (!activeTag) return null
    return new Set(notes.filter(n => n.tags.includes(activeTag)).map(n => n.id))
  }, [notes, activeTag])

  // Combine filters (AND semantics) and sort
  const displayedNotes = useMemo(() => {
    let filtered = enriched

    if (searchResultIds) {
      filtered = filtered.filter(e => searchResultIds.has(e.note.id))
    }
    if (tagFilteredIds) {
      filtered = filtered.filter(e => tagFilteredIds.has(e.note.id))
    }

    // When semantic search is active, order by similarity score (highest first) per AC6
    if (useSemanticSearch && semanticResults.length > 0) {
      return [...filtered].sort((a, b) => {
        const scoreA = semanticScoreMap.get(a.note.id) ?? 0
        const scoreB = semanticScoreMap.get(b.note.id) ?? 0
        return scoreB - scoreA
      })
    }

    return sortNotes(filtered, sortOption)
  }, [
    enriched,
    searchResultIds,
    tagFilteredIds,
    sortOption,
    useSemanticSearch,
    semanticResults,
    semanticScoreMap,
  ])

  // Build highlight patterns for search
  const highlightPatterns = useMemo(() => buildHighlightPatterns(debouncedQuery), [debouncedQuery])

  // Group by course for "By Course" sort
  const courseGroups = useMemo(() => {
    if (sortOption !== 'by-course') return null
    const groups = new Map<string, EnrichedNote[]>()
    for (const item of displayedNotes) {
      const existing = groups.get(item.courseName)
      if (existing) {
        existing.push(item)
      } else {
        groups.set(item.courseName, [item])
      }
    }
    return groups
  }, [displayedNotes, sortOption])

  const handleTagClick = (tag: string) => {
    setActiveTag(current => (current === tag ? null : tag))
  }

  const handleCardClick = (noteId: string) => {
    setExpandedNoteId(current => (current === noteId ? null : noteId))
  }

  const handleOpenInLesson = (note: Note) => {
    const params = new URLSearchParams()
    params.set('panel', 'notes')
    if (note.timestamp != null) {
      params.set('t', String(note.timestamp))
    }
    navigate(`/courses/${note.courseId}/${note.videoId}?${params.toString()}`)
  }

  const renderNoteCard = (item: EnrichedNote) => {
    const isExpanded = expandedNoteId === item.note.id
    const semanticScore = semanticScoreMap.get(item.note.id)

    return (
      <div
        key={item.note.id}
        id={`note-${item.note.id}`}
        data-note-id={item.note.id}
        data-testid="note-card"
        className="bg-card rounded-[24px] border p-4 transition-shadow hover:shadow-sm"
      >
        {/* Collapsed preview — click to expand */}
        <div
          className="cursor-pointer"
          onClick={() => handleCardClick(item.note.id)}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleCardClick(item.note.id)
            }
          }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="font-medium text-foreground">{item.courseName}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{item.lessonTitle}</span>
            {useSemanticSearch && semanticScore !== undefined && (
              <Badge variant="secondary" className="text-xs ml-auto" data-testid="similarity-badge">
                {Math.round(semanticScore * 100)}% match
              </Badge>
            )}
          </div>

          <p className="text-sm text-foreground line-clamp-2">
            {highlightMatches(item.plainPreview, highlightPatterns)}
          </p>
        </div>

        {/* Tags + timestamp — outside role="button" to avoid nested interactives */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {item.note.tags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagClick(tag)}
              className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-md"
            >
              <Badge
                variant={activeTag === tag ? 'default' : 'secondary'}
                className={cn(
                  'text-xs cursor-pointer',
                  activeTag === tag && 'bg-brand text-brand-foreground hover:bg-brand-hover'
                )}
                data-active={activeTag === tag ? 'true' : undefined}
              >
                {tag}
              </Badge>
            </button>
          ))}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.note.updatedAt), {
              addSuffix: true,
            })}
          </span>
        </div>

        {/* Expanded view — full TipTap content + actions */}
        {isExpanded && (
          <div className="mt-4 border-t pt-4">
            <Suspense fallback={<Skeleton className="h-24 w-full" />}>
              <ReadOnlyContent content={item.note.content} />
            </Suspense>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => handleOpenInLesson(item.note)}
              >
                <BookOpen className="size-3.5 mr-1.5" />
                Open in Lesson
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    exportNoteAsMarkdown(item.note, item.courseName, item.lessonTitle)
                    toast.success('Note exported successfully')
                  } catch {
                    toast.error('Failed to export note')
                  }
                }}
                data-testid="export-note-button"
              >
                <Download className="size-3.5 mr-1.5" />
                Export
              </Button>

              {item.note.timestamp != null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenInLesson(item.note)}
                >
                  <Clock className="size-3.5 mr-1.5" />
                  {formatTimestamp(item.note.timestamp)}
                </Button>
              )}
            </div>

            <Suspense fallback={null}>
              <RelatedConceptsPanel note={item.note} allNotes={notes} courseNames={courseNames} />
            </Suspense>
          </div>
        )}
      </div>
    )
  }

  // Skeleton loading state — still show tabs so user can switch to bookmarks
  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading notes">
        <h1 className="text-2xl font-semibold tracking-tight">My Notes</h1>
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="notes">
              <StickyNote className="size-4 mr-1.5" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="bookmarks">
              <BookmarkIcon className="size-4 mr-1.5" />
              Bookmarks
            </TabsTrigger>
          </TabsList>
          <TabsContent value="notes" className="mt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-[24px]" />
            ))}
          </TabsContent>
          <TabsContent value="bookmarks" className="mt-6">
            <BookmarksSection />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Back-link from Related Concepts navigation (AC5) */}
        {fromNoteId && (
          <button
            type="button"
            data-testid="back-to-note"
            className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            onClick={() => {
              setExpandedNoteId(fromNoteId)
              navigate('/notes', { replace: true })
              document.getElementById(`note-${fromNoteId}`)?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to original note
          </button>
        )}

        {/* Page header */}
        <h1 className="text-2xl font-semibold tracking-tight">My Notes</h1>

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="notes">
              <StickyNote className="size-4 mr-1.5" />
              Notes
              <span className="text-muted-foreground ml-1">({notes.length})</span>
            </TabsTrigger>
            <TabsTrigger value="bookmarks">
              <BookmarkIcon className="size-4 mr-1.5" />
              Bookmarks
            </TabsTrigger>
          </TabsList>

          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-6 space-y-6">
            {/* Sort + QA controls */}
            <div className="flex items-center justify-end gap-3">
              <Suspense fallback={null}>
                <QAChatPanel />
              </Suspense>
              <Select value={sortOption} onValueChange={v => setSortOption(v as SortOption)}>
                <SelectTrigger className="w-[160px]">
                  <ArrowUpDown className="size-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="most-recent">Most Recent</SelectItem>
                  <SelectItem value="oldest-first">Oldest First</SelectItem>
                  <SelectItem value="by-course">By Course</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search input + semantic toggle */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                  aria-label="Search notes"
                />
              </div>
              {supportsWorkers() && (
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    id="semantic-search"
                    data-testid="semantic-toggle"
                    checked={useSemanticSearch}
                    onCheckedChange={setUseSemanticSearch}
                    disabled={!semanticSearchAvailable}
                  />
                  <Label
                    htmlFor="semantic-search"
                    className={cn(
                      'text-sm cursor-pointer',
                      semanticSearchAvailable ? 'text-muted-foreground' : 'text-muted-foreground/50'
                    )}
                  >
                    Semantic
                  </Label>
                  {!semanticSearchAvailable && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center size-6 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label="Semantic search unavailable: no embeddings indexed yet"
                          data-testid="semantic-tooltip-trigger"
                        >
                          <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>No embeddings available</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>

            {/* Tag filter bar */}
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-md"
                  >
                    <Badge
                      variant={activeTag === tag ? 'default' : 'outline'}
                      className={cn(
                        'cursor-pointer text-xs',
                        activeTag === tag
                          ? 'bg-brand text-brand-foreground hover:bg-brand-hover'
                          : 'hover:bg-accent'
                      )}
                      data-active={activeTag === tag ? 'true' : undefined}
                    >
                      {tag}
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {/* Empty state — no notes at all */}
            {notes.length === 0 && (
              <EmptyState
                data-testid="empty-state-notes"
                icon={StickyNote}
                title="Start a video and take your first note"
                description="Capture key moments while you study"
                actionLabel="Browse Courses"
                actionHref="/courses"
              />
            )}

            {/* No search results */}
            {notes.length > 0 && displayedNotes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="size-12 text-muted-foreground/50 mb-4" />
                <h2 className="text-lg font-medium mb-2">No results found</h2>
                <p className="text-sm text-muted-foreground">
                  No notes match{' '}
                  {debouncedQuery && (
                    <>
                      &ldquo;<span className="font-medium">{debouncedQuery}</span>
                      &rdquo;
                    </>
                  )}
                  {debouncedQuery && activeTag && ' with '}
                  {activeTag && (
                    <>
                      tag &ldquo;<span className="font-medium">{activeTag}</span>
                      &rdquo;
                    </>
                  )}
                  . Try a different search term or clear your filters.
                </p>
              </div>
            )}

            {/* Note list — grouped by course or flat */}
            {courseGroups ? (
              <div className="space-y-8">
                {Array.from(courseGroups.entries()).map(([courseName, items]) => (
                  <div key={courseName}>
                    <h2 className="text-lg font-semibold mb-3">{courseName}</h2>
                    <div className="space-y-3">{items.map(renderNoteCard)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">{displayedNotes.map(renderNoteCard)}</div>
            )}
          </TabsContent>

          {/* Bookmarks Tab */}
          <TabsContent value="bookmarks" className="mt-6">
            <BookmarksSection />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
