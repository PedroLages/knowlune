import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  BarChart3,
  ClipboardList,
  BrainCircuit,
  Settings,
  Info,
  FileText,
  StickyNote,
  User,
  Highlighter,
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/app/components/ui/command'
import { Badge } from '@/app/components/ui/badge'
import { truncateSnippet, highlightMatches, buildHighlightPatterns } from '@/lib/searchUtils'
import { db } from '@/db/schema'
import { useUnifiedSearchIndex } from '@/lib/useUnifiedSearchIndex'
import type { EntityType, UnifiedSearchResult } from '@/lib/unifiedSearch'

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

/** Maximum rows rendered per section before the "Show all N" affordance. */
const SECTION_COLLAPSED_LIMIT = 5
/** Maximum rows rendered per section after the user expands it. */
const SECTION_EXPANDED_LIMIT = 50

/** Per-entity-type rendering config — fixed order, heading, icon. */
const SECTION_ORDER: Array<{ type: EntityType; heading: string; icon: typeof GraduationCap }> = [
  { type: 'course', heading: 'Courses', icon: GraduationCap },
  { type: 'book', heading: 'Books', icon: BookOpen },
  { type: 'lesson', heading: 'Lessons', icon: FileText },
  { type: 'note', heading: 'Notes', icon: StickyNote },
  { type: 'highlight', heading: 'Book Highlights', icon: Highlighter },
  { type: 'author', heading: 'Authors', icon: User },
]

const TYPE_BADGE_LABEL: Record<EntityType, string> = {
  course: 'Course',
  book: 'Book',
  lesson: 'Lesson',
  note: 'Note',
  highlight: 'Highlight',
  author: 'Author',
}

// ────────────────────────────────────────────────────────────────────────────
// Static navigation pages (always shown when query is empty)
// ────────────────────────────────────────────────────────────────────────────

interface PageItem {
  id: string
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  keywords: string[]
}

const navigationPages: PageItem[] = [
  {
    id: 'page-overview',
    label: 'Overview',
    path: '/',
    icon: LayoutDashboard,
    keywords: ['overview', 'dashboard', 'home'],
  },
  {
    id: 'page-my-courses',
    label: 'My Courses',
    path: '/my-class',
    icon: BookOpen,
    keywords: ['courses', 'progress', 'class', 'my'],
  },
  {
    id: 'page-courses',
    label: 'Courses',
    path: '/courses',
    icon: GraduationCap,
    keywords: ['courses', 'catalog', 'all'],
  },
  {
    id: 'page-notes',
    label: 'Notes & Bookmarks',
    path: '/notes',
    icon: StickyNote,
    keywords: ['notes', 'bookmarks', 'library', 'resources', 'files'],
  },
  {
    id: 'page-about',
    label: 'About',
    path: '/authors',
    icon: Info,
    keywords: ['about', 'authors', 'instructors', 'info'],
  },
  {
    id: 'page-reports-study',
    label: 'Study Analytics',
    path: '/reports?tab=study',
    icon: BarChart3,
    keywords: ['reports', 'study', 'analytics', 'stats', 'lessons', 'completion'],
  },
  {
    id: 'page-reports-quizzes',
    label: 'Quiz Analytics',
    path: '/reports?tab=quizzes',
    icon: ClipboardList,
    keywords: ['reports', 'quiz', 'analytics', 'quizzes', 'performance', 'score'],
  },
  {
    id: 'page-reports-ai',
    label: 'AI Analytics',
    path: '/reports?tab=ai',
    icon: BrainCircuit,
    keywords: ['reports', 'ai', 'analytics', 'artificial intelligence', 'insights'],
  },
  {
    id: 'page-settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    keywords: ['settings', 'preferences', 'config'],
  },
]

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

interface SearchCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchCommandPalette({ open, onOpenChange }: SearchCommandPaletteProps) {
  const navigate = useNavigate()
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<EntityType>>(new Set())
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  const { search } = useUnifiedSearchIndex()

  const highlightPatterns = useMemo(() => buildHighlightPatterns(debouncedQuery), [debouncedQuery])

  // Capture focus and reset state on open/close
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement
    } else {
      setSearchQuery('')
      setDebouncedQuery('')
      setExpandedSections(new Set())
      setRemovedIds(new Set())
    }
  }, [open])

  // 150ms debounce for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 150)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Run unified search on debounced query; group by type.
  const groupedResults = useMemo(() => {
    const q = debouncedQuery.trim()
    const groups: Record<EntityType, UnifiedSearchResult[]> = {
      course: [],
      book: [],
      lesson: [],
      note: [],
      highlight: [],
      author: [],
    }
    if (!q) return groups
    const all = search(q, { limit: 300 })
    for (const r of all) {
      if (removedIds.has(`${r.type}:${r.id}`)) continue
      const bucket = groups[r.type]
      if (bucket) bucket.push(r)
    }
    return groups
  }, [debouncedQuery, search, removedIds])

  const hasActiveQuery = debouncedQuery.trim().length > 0
  const totalResults = hasActiveQuery
    ? SECTION_ORDER.reduce((acc, s) => acc + groupedResults[s.type].length, 0)
    : 0

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
    if (!newOpen && previouslyFocusedRef.current) {
      requestAnimationFrame(() => previouslyFocusedRef.current?.focus())
    }
  }

  const handleStaticSelect = (path: string) => {
    handleOpenChange(false)
    navigate(path)
  }

  /**
   * Navigate to a unified-search result. If the underlying entity has been
   * deleted between index time and select time, surface a toast + remove the
   * stale row from the local result set so the palette can stay open.
   */
  const handleResultSelect = async (result: UnifiedSearchResult) => {
    let path: string | null = null
    let exists = true

    try {
      switch (result.type) {
        case 'course': {
          const row = await db.importedCourses.get(result.id)
          if (!row) exists = false
          else path = `/courses/${result.id}`
          break
        }
        case 'lesson': {
          const row = await db.importedVideos.get(result.id)
          if (!row) exists = false
          else path = `/courses/${row.courseId}/lessons/${result.id}`
          break
        }
        case 'book': {
          const row = await db.books.get(result.id)
          if (!row) exists = false
          else path = `/library/${result.id}`
          break
        }
        case 'note': {
          const row = await db.notes.get(result.id)
          if (!row) exists = false
          else {
            let p = `/courses/${row.courseId}/lessons/${row.videoId}?panel=notes`
            if (row.timestamp != null) p += `&t=${row.timestamp}`
            path = p
          }
          break
        }
        case 'highlight': {
          const row = await db.bookHighlights.get(result.id)
          if (!row) exists = false
          else {
            const params = new URLSearchParams()
            params.set('sourceHighlightId', result.id)
            path = `/library/${row.bookId}/read?${params.toString()}`
          }
          break
        }
        case 'author': {
          const row = await db.authors.get(result.id)
          if (!row) exists = false
          else path = `/authors/${result.id}`
          break
        }
      }
    } catch (e) {
      // silent-catch-ok: deleted entity handled via toast + result refresh
      console.warn('[search-palette] existence check failed:', e)
      exists = false
    }

    if (!exists || !path) {
      toast.error('Item no longer available')
      setRemovedIds(prev => {
        const next = new Set(prev)
        next.add(`${result.type}:${result.id}`)
        return next
      })
      return
    }

    handleOpenChange(false)
    navigate(path)
  }

  const toggleExpand = (type: EntityType) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // Static pages are filtered by cmdk's default when no query; when a query is
  // present, we bypass cmdk's filter (shouldFilter={false}) so MiniSearch
  // ranks results. The static Pages group matches by a simple substring test.
  const staticPagesFiltered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return navigationPages
    return navigationPages.filter(p => {
      const haystack = [p.label, ...p.keywords].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [debouncedQuery])

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Search for pages, courses, books, lessons, notes, highlights, and authors"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search pages, courses, books, lessons, notes, highlights..."
        onValueChange={setSearchQuery}
      />
      {/* Polite live region for screen readers — announces result count */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="search-result-count"
      >
        {hasActiveQuery ? `${totalResults} results` : ''}
      </div>
      <CommandList role="listbox">
        <CommandEmpty>
          {hasActiveQuery
            ? 'No results found. Try different keywords or browse by tag.'
            : 'No results found.'}
        </CommandEmpty>

        {/* Unified entity sections (fixed order). Hidden when query is empty. */}
        {hasActiveQuery &&
          SECTION_ORDER.map(section => {
            const rows = groupedResults[section.type]
            if (rows.length === 0) return null
            const expanded = expandedSections.has(section.type)
            const limit = expanded ? SECTION_EXPANDED_LIMIT : SECTION_COLLAPSED_LIMIT
            const shown = rows.slice(0, limit)
            const hiddenCount = rows.length - shown.length
            const SectionIcon = section.icon

            return (
              <CommandGroup key={section.type} heading={section.heading}>
                {shown.map(r => (
                  <CommandItem
                    key={`${r.type}:${r.id}`}
                    value={`${r.type}:${r.id}`}
                    onSelect={() => handleResultSelect(r)}
                    role="option"
                    data-testid={`search-result-${r.type}-${r.id}`}
                  >
                    <SectionIcon className="mr-2 size-4 shrink-0" />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-sm truncate">
                        {highlightMatches(truncateSnippet(r.displayTitle), highlightPatterns)}
                      </span>
                      {r.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          {r.subtitle}
                        </span>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className="ml-2 shrink-0 text-[10px] px-1.5 py-0 h-4"
                      aria-label={TYPE_BADGE_LABEL[r.type]}
                    >
                      {TYPE_BADGE_LABEL[r.type]}
                    </Badge>
                  </CommandItem>
                ))}
                {hiddenCount > 0 && (
                  <CommandItem
                    key={`${section.type}-show-all`}
                    value={`${section.type}-show-all`}
                    onSelect={() => toggleExpand(section.type)}
                    data-testid={`search-show-all-${section.type}`}
                  >
                    <span className="text-xs text-muted-foreground">
                      Show all {rows.length} {section.heading.toLowerCase()}
                    </span>
                  </CommandItem>
                )}
              </CommandGroup>
            )
          })}

        <CommandGroup heading="Pages">
          {staticPagesFiltered.map(item => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => handleStaticSelect(item.path)}
                role="option"
              >
                <Icon className="mr-2 size-4 shrink-0" />
                <span>{item.label}</span>
                {item.id === 'page-settings' && (
                  <CommandShortcut>
                    <kbd>Cmd</kbd>+<kbd>,</kbd>
                  </CommandShortcut>
                )}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
