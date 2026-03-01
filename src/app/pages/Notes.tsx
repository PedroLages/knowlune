import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search, StickyNote, ArrowUpDown, BookOpen, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/app/components/ui/utils'
import { Input } from '@/app/components/ui/input'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { Skeleton } from '@/app/components/ui/skeleton'
import { useNoteStore } from '@/stores/useNoteStore'
import { searchNotesWithContext } from '@/lib/noteSearch'
import { getAllNoteTags } from '@/lib/progress'
import { highlightMatches, buildHighlightPatterns } from '@/lib/searchUtils'
import { allCourses } from '@/data/courses'
import { formatTimestamp } from '@/lib/format'
import { stripHtml } from '@/lib/textUtils'
import { ReadOnlyContent } from '@/app/components/notes/ReadOnlyContent'
import type { Note } from '@/data/types'

type SortOption = 'most-recent' | 'oldest-first' | 'by-course'

/** Build lookup maps from static course data — called ONCE at module level. */
function buildLookups() {
  const courseNames = new Map<string, string>()
  const lessonTitles = new Map<string, string>()
  for (const course of allCourses) {
    courseNames.set(course.id, course.shortTitle || course.title)
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        lessonTitles.set(lesson.id, lesson.title)
      }
    }
  }
  return { courseNames, lessonTitles }
}

const { courseNames, lessonTitles } = buildLookups()

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

function enrichNotes(notes: Note[]): EnrichedNote[] {
  return notes.map(note => ({
    note,
    courseName: courseNames.get(note.courseId) ?? note.courseId,
    lessonTitle: lessonTitles.get(note.videoId) ?? note.videoId,
    plainPreview: truncatePreview(stripHtml(note.content)),
  }))
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
  const notes = useNoteStore(s => s.notes)
  const isLoading = useNoteStore(s => s.isLoading)
  const loadNotes = useNoteStore(s => s.loadNotes)
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sortOption, setSortOption] = useState<SortOption>('most-recent')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)

  // Load all notes on mount
  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // Load available tags when notes change
  useEffect(() => {
    getAllNoteTags()
      .then(setAvailableTags)
      .catch(err => console.error('[Notes] Failed to load tags:', err))
  }, [notes])

  // Debounce search input (150ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 150)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Enrich notes ONCE in parent
  const enriched = useMemo(() => enrichNotes(notes), [notes])

  // Apply search filter
  const searchResultIds = useMemo(() => {
    if (!debouncedQuery.trim()) return null
    const results = searchNotesWithContext(debouncedQuery)
    return new Set(results.map(r => r.id))
  }, [debouncedQuery])

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

    return sortNotes(filtered, sortOption)
  }, [enriched, searchResultIds, tagFilteredIds, sortOption])

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

    return (
      <div
        key={item.note.id}
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
                  activeTag === tag && 'bg-blue-600 text-white hover:bg-blue-700'
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
            <ReadOnlyContent content={item.note.content} />

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
          </div>
        )}
      </div>
    )
  }

  // Skeleton loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[24px]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          My Notes <span className="text-muted-foreground font-normal">({notes.length})</span>
        </h1>
        <div className="flex items-center gap-3">
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
      </div>

      {/* Search input */}
      <div className="relative">
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
                  activeTag === tag ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:bg-accent'
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <StickyNote className="size-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-medium mb-2">No notes yet</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Start taking notes while watching lessons. Open any course, play a video, and use the
            notes panel to capture your thoughts.
          </p>
        </div>
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
    </div>
  )
}
