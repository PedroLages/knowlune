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
  ChevronDown,
  ChevronRight,
  Sparkles,
  Clock,
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
import {
  recordVisit,
  getRecentHits,
  RECENT_LIST_KEY,
  type RecentHit,
} from '@/lib/searchFrecency'
import { getMergedAuthors } from '@/lib/authors'
import type { ImportedAuthor } from '@/data/types'

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

/**
 * Per-entity-type badge tinting. Uses only tokens defined in theme.css.
 * Opacity modifiers (`/10`) on color tokens are valid Tailwind and pass
 * the design-tokens/no-hardcoded-colors ESLint rule.
 */
const TYPE_BADGE_CLASS: Record<EntityType, string> = {
  course: 'bg-brand-soft text-brand-soft-foreground',
  book: 'bg-success-soft text-success',
  lesson: 'bg-warning/10 text-warning',
  note: 'bg-muted text-muted-foreground',
  highlight: 'bg-success/10 text-success',
  author: 'bg-secondary text-secondary-foreground',
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
// Empty-state types
// ────────────────────────────────────────────────────────────────────────────

/** One row in the "Continue learning" empty-state section. */
interface ContinueLearningItem {
  type: 'course' | 'book'
  id: string
  title: string
  subtitle?: string
  /** ISO 8601 — used for ordering, not display. */
  lastAt: string
}

/** Maximum rows rendered in the "Continue learning" section. */
const CONTINUE_LEARNING_MAX = 2
/** Maximum rows rendered in the "Recently opened" section. */
const RECENT_OPENED_MAX = 5
/** Number of Best Matches rows above the grouped sections. */
const BEST_MATCHES_LIMIT = 3

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
  // Live-region announcement debounced separately from search — 400ms pause
  // before updating prevents SR verbosity on every keystroke (D-MED-1).
  const [announcedCount, setAnnouncedCount] = useState<number | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<EntityType>>(new Set())
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const commandRootRef = useRef<HTMLDivElement | null>(null)

  const { search, searchBestMatches } = useUnifiedSearchIndex()

  // ─── Empty-state state (palette-owned, not on the hook) ─────────────────
  // Story 2 invariant: other hook consumers (Courses.tsx, Authors.tsx,
  // Notes.tsx) must not re-render on palette-specific state changes.

  // Recent hits — synchronous LS read on mount; re-read on cross-tab
  // `storage` events and after `recordVisit` in this tab.
  const [recentHits, setRecentHits] = useState<RecentHit[]>(() => getRecentHits())

  // Continue Learning — `undefined` until the palette-open effect resolves,
  // so we can discriminate "loading" from "definitively empty" and avoid
  // flashing the welcome copy before Dexie answers.
  const [continueLearning, setContinueLearning] = useState<
    ContinueLearningItem[] | undefined
  >(undefined)

  // Best Matches (typed-query state).
  const [bestMatches, setBestMatches] = useState<UnifiedSearchResult[]>([])

  const highlightPatterns = useMemo(() => buildHighlightPatterns(debouncedQuery), [debouncedQuery])

  // Capture focus and reset state on open/close
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement
      // Re-read LS on every open so a visit recorded in another tab while
      // the palette was closed is reflected. The `storage` listener covers
      // the live case; this covers the open-after-a-while case.
      setRecentHits(getRecentHits())
    } else {
      setSearchQuery('')
      setDebouncedQuery('')
      setAnnouncedCount(null)
      setExpandedSections(new Set())
      setRemovedIds(new Set())
      setBestMatches([])
      // Drop Continue Learning so it re-derives on next open (handles
      // progress updates that happened between open events).
      setContinueLearning(undefined)
    }
  }, [open])

  // Cross-tab sync — re-read LS when another tab writes to the recent list.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== RECENT_LIST_KEY) return
      setRecentHits(getRecentHits())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // 150ms debounce for search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 150)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ─── Continue Learning — one-shot query gated on open + empty query ─────
  //
  // Scope note: this is deliberately NOT a useLiveQuery on the hook. Running
  // it on the hook would re-fire on every video playback tick across every
  // hook consumer (Courses.tsx, Authors.tsx, Notes.tsx) even while the
  // palette is closed. Gating on `open === true && debouncedQuery === ''`
  // keeps it cold until needed.
  useEffect(() => {
    if (!open) return
    if (debouncedQuery.trim().length > 0) return
    if (continueLearning !== undefined) return // cached for this open lifetime

    let ignore = false
    void (async () => {
      try {
        const [courses, progressRows, books] = await Promise.all([
          db.importedCourses.toArray(),
          db.progress.toArray(),
          // Non-indexed post-filter at projected scale — bounded by library size.
          db.books
            .where('lastOpenedAt')
            .above('')
            .reverse()
            .filter(
              b =>
                b.status !== 'finished' &&
                b.status !== 'abandoned' &&
                (b.progress ?? 0) < 100
            )
            .limit(10)
            .toArray(),
        ])
        if (ignore) return

        // Build course-id → aggregate progress info map.
        const progressByCourse = new Map<
          string,
          { anyStarted: boolean; maxUpdated?: string; maxCompleted?: string; completedCount: number }
        >()
        for (const row of progressRows) {
          const entry = progressByCourse.get(row.courseId) ?? {
            anyStarted: false,
            maxUpdated: undefined,
            maxCompleted: undefined,
            completedCount: 0,
          }
          if ((row.currentTime ?? 0) > 0) entry.anyStarted = true
          if (row.updatedAt && (!entry.maxUpdated || row.updatedAt > entry.maxUpdated)) {
            entry.maxUpdated = row.updatedAt
          }
          if (row.completedAt && (!entry.maxCompleted || row.completedAt > entry.maxCompleted)) {
            entry.maxCompleted = row.completedAt
          }
          if ((row.completionPercentage ?? 0) >= 90) entry.completedCount += 1
          progressByCourse.set(row.courseId, entry)
        }

        const courseItems: ContinueLearningItem[] = []
        for (const course of courses) {
          const agg = progressByCourse.get(course.id)
          if (!agg || !agg.anyStarted) continue
          const videoCount = course.videoCount ?? 0
          // Exclude fully-completed courses (>=100% completion).
          if (videoCount > 0 && agg.completedCount >= videoCount) continue
          const completionPercent =
            videoCount > 0 ? Math.round((agg.completedCount / videoCount) * 100) : 0
          if (completionPercent >= 100) continue
          const lastAt = agg.maxUpdated ?? agg.maxCompleted ?? course.importedAt
          courseItems.push({
            type: 'course',
            id: course.id,
            title: course.name,
            subtitle:
              videoCount > 0
                ? `${agg.completedCount} of ${videoCount} lessons · ${completionPercent}%`
                : undefined,
            lastAt,
          })
        }

        const bookItems: ContinueLearningItem[] = books.map(b => ({
          type: 'book' as const,
          id: b.id,
          title: b.title,
          subtitle: b.author ? `${b.author} · ${b.progress ?? 0}%` : `${b.progress ?? 0}%`,
          lastAt: b.lastOpenedAt ?? b.updatedAt ?? b.createdAt,
        }))

        // Merge, sort by most-recent, cap.
        const merged = [...courseItems, ...bookItems]
          .sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0))
          .slice(0, CONTINUE_LEARNING_MAX)

        if (!ignore) setContinueLearning(merged)
      } catch (err) {
        // silent-catch-ok: Continue Learning is a soft surface; fall back to []
        console.error('[search-palette] continue-learning query failed:', err)
        if (!ignore) setContinueLearning([])
      }
    })()

    return () => {
      ignore = true
    }
  }, [open, debouncedQuery, continueLearning])

  // ─── Best Matches — runs on typed query, clears on empty ────────────────
  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q) {
      setBestMatches([])
      return
    }
    let ignore = false
    searchBestMatches(q, { limit: BEST_MATCHES_LIMIT })
      .then(res => {
        if (!ignore) setBestMatches(res)
      })
      .catch(err => {
        // silent-catch-ok: Best Matches degrades to empty, grouped sections still render
        console.error('[search-palette] searchBestMatches failed:', err)
        if (!ignore) setBestMatches([])
      })
    return () => {
      ignore = true
    }
  }, [debouncedQuery, searchBestMatches])

  const bestMatchIds = useMemo(
    () => new Set(bestMatches.map(r => `${r.type}:${r.id}`)),
    [bestMatches]
  )

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
  // Unique-id count across Best Matches + grouped sections. Best Matches is
  // a subset of the same underlying result set, so the union produces the
  // correct "N results" SR announcement.
  const totalResults = useMemo(() => {
    if (!hasActiveQuery) return 0
    const ids = new Set<string>()
    for (const s of SECTION_ORDER) {
      for (const r of groupedResults[s.type]) ids.add(`${r.type}:${r.id}`)
    }
    for (const r of bestMatches) ids.add(`${r.type}:${r.id}`)
    return ids.size
  }, [hasActiveQuery, groupedResults, bestMatches])

  // Settle the live-region announcement after a 400ms pause so screen readers
  // don't read every intermediate count as the user types (D-MED-1).
  useEffect(() => {
    if (!hasActiveQuery) {
      setAnnouncedCount(null)
      return
    }
    const timer = setTimeout(() => setAnnouncedCount(totalResults), 400)
    return () => clearTimeout(timer)
  }, [hasActiveQuery, totalResults])

  const announcementText =
    announcedCount == null
      ? ''
      : announcedCount === 1
        ? '1 result'
        : `${announcedCount} results`

  /**
   * Home/End keyboard support (D-MED-3). cmdk handles arrows only — we
   * intercept Home/End to jump to the first/last `[cmdk-item]` in the list.
   */
  const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Home' && e.key !== 'End') return
    const root = commandRootRef.current
    if (!root) return
    const items = root.querySelectorAll<HTMLElement>(
      '[cmdk-item]:not([data-disabled="true"])'
    )
    if (items.length === 0) return
    e.preventDefault()
    const target = e.key === 'Home' ? items[0] : items[items.length - 1]
    target.scrollIntoView({ block: 'nearest' })
    // cmdk tracks selection via data-value on the item; dispatch a mousemove
    // so cmdk marks it selected (matches the library's own hover semantics).
    target.dispatchEvent(new Event('mousemove', { bubbles: true }))
  }

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
          // Authors are validated against the merged projection (pre-seeded +
          // imported), NOT raw `db.authors` — pre-seeded authors live only in
          // the merged projection and would be falsely classified as deleted
          // by a raw Dexie lookup. Story 1 latent-bug fix.
          const storeAuthors = (await db.authors.toArray()) as ImportedAuthor[]
          const merged = getMergedAuthors(storeAuthors)
          const exists2 = merged.some(a => a.id === result.id)
          if (!exists2) exists = false
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

    // Record the visit (LS + Dexie). Fire-and-forget — navigation must not
    // block on the write. Optimistically update local `recentHits` so the
    // palette's Recently-opened row reflects the new entry immediately on
    // next open (cross-tab sync via `storage` listener covers other tabs).
    void recordVisit(result.type, result.id).then(() => {
      setRecentHits(getRecentHits())
    })

    handleOpenChange(false)
    // `__viaPalette` tells Unit 5 route-mount effects to skip their own
    // `recordVisit` so openCount is not double-counted.
    navigate(path, { state: { __viaPalette: true } })
  }

  /**
   * Continue Learning row select — always valid (we just queried Dexie).
   * Records a visit, then navigates with the `__viaPalette` flag.
   */
  const handleContinueLearningSelect = (item: ContinueLearningItem) => {
    const path =
      item.type === 'course' ? `/courses/${item.id}` : `/library/${item.id}`
    void recordVisit(item.type, item.id).then(() => {
      setRecentHits(getRecentHits())
    })
    handleOpenChange(false)
    navigate(path, { state: { __viaPalette: true } })
  }

  /**
   * Recently Opened row select — validate against Dexie (the entry may refer
   * to a deleted entity). Stale entries are purged from LS on the fly.
   * For authors, validate against the merged projection (Story 1 latent-bug fix).
   */
  const handleRecentSelect = async (hit: RecentHit) => {
    let path: string | null = null
    let exists = true
    try {
      switch (hit.type) {
        case 'course': {
          const row = await db.importedCourses.get(hit.id)
          if (!row) exists = false
          else path = `/courses/${hit.id}`
          break
        }
        case 'lesson': {
          const row = await db.importedVideos.get(hit.id)
          if (!row) exists = false
          else path = `/courses/${row.courseId}/lessons/${hit.id}`
          break
        }
        case 'book': {
          const row = await db.books.get(hit.id)
          if (!row) exists = false
          else path = `/library/${hit.id}`
          break
        }
        case 'note': {
          const row = await db.notes.get(hit.id)
          if (!row) exists = false
          else
            path = `/courses/${row.courseId}/lessons/${row.videoId}?panel=notes${
              row.timestamp != null ? `&t=${row.timestamp}` : ''
            }`
          break
        }
        case 'highlight': {
          const row = await db.bookHighlights.get(hit.id)
          if (!row) exists = false
          else
            path = `/library/${row.bookId}/read?sourceHighlightId=${encodeURIComponent(hit.id)}`
          break
        }
        case 'author': {
          const storeAuthors = (await db.authors.toArray()) as ImportedAuthor[]
          const merged = getMergedAuthors(storeAuthors)
          if (!merged.some(a => a.id === hit.id)) exists = false
          else path = `/authors/${hit.id}`
          break
        }
      }
    } catch (e) {
      // silent-catch-ok: same deleted-entity fallback as handleResultSelect
      console.warn('[search-palette] recent-hit existence check failed:', e)
      exists = false
    }

    if (!exists || !path) {
      toast.error('Item no longer available')
      // Purge the stale entry from LS + local state.
      const next = recentHits.filter(
        h => !(h.type === hit.type && h.id === hit.id)
      )
      setRecentHits(next)
      try {
        localStorage.setItem(RECENT_LIST_KEY, JSON.stringify(next))
      } catch {
        // silent-catch-ok: LS purge is best-effort; user-visible toast already fired
      }
      return
    }

    void recordVisit(hit.type, hit.id).then(() => {
      setRecentHits(getRecentHits())
    })
    handleOpenChange(false)
    navigate(path, { state: { __viaPalette: true } })
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

  // Does at least one entity section have results? (controls whether empty
  // sections render a placeholder row or are suppressed — D-MED-6).
  const anyEntityHits = hasActiveQuery && totalResults > 0

  // Empty-state decision variables. `continueLearning === undefined` means
  // the Dexie query is still in flight — render Pages only and suppress the
  // welcome copy to avoid a flash.
  const isEmptyQuery = !hasActiveQuery
  const isLoadingEmptyState = isEmptyQuery && continueLearning === undefined
  const hasContinueLearning = (continueLearning?.length ?? 0) > 0
  const displayedRecentHits = recentHits.slice(0, RECENT_OPENED_MAX)
  const hasRecentOpened = displayedRecentHits.length > 0
  // Fresh-install welcome: both empty-state rows are definitively empty.
  const showWelcomeCopy =
    isEmptyQuery && !isLoadingEmptyState && !hasContinueLearning && !hasRecentOpened
  // Suppress Pages when welcome copy is visible — a 9-item nav list
  // contradicts the "nothing here yet" message.
  const showPages = !showWelcomeCopy

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Search for pages, courses, books, lessons, notes, highlights, and authors"
      shouldFilter={false}
      commandRef={commandRootRef}
      onCommandKeyDown={handleCommandKeyDown}
      // D-MED-2: full-screen on mobile viewports (<640px). Overrides the
      // default DialogContent sizing so the palette fills the viewport.
      contentClassName="max-sm:inset-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-none max-sm:h-full max-sm:w-full"
    >
      <CommandInput
        placeholder="Search pages, courses, books, lessons, notes, highlights..."
        onValueChange={setSearchQuery}
      />
      {/* Polite live region for screen readers — announces result count.
          Pluralized and debounced to a 400ms pause to limit SR verbosity. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="search-result-count"
      >
        {announcementText}
      </div>
      <CommandList>
        {/* CommandEmpty only rendered for typed-query empty state; the
            palette's own empty-query render handles welcome copy and
            continue-learning/recently-opened surfaces. */}
        {hasActiveQuery && (
          <CommandEmpty>
            No results found. Try different keywords or browse by tag.
          </CommandEmpty>
        )}

        {/* Welcome copy — fresh install, no imports, no opens. */}
        {showWelcomeCopy && (
          <div
            className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground"
            data-testid="search-welcome-copy"
          >
            <Sparkles className="size-6 text-muted-foreground" aria-hidden="true" />
            <p>
              Start by importing a course or adding a book. Press{' '}
              <kbd className="rounded bg-muted px-1 py-0.5 text-xs">Cmd+K</kbd>{' '}
              anytime to search.
            </p>
          </div>
        )}

        {/* Continue Learning — shown only on empty query, after Dexie resolves. */}
        {isEmptyQuery && hasContinueLearning && continueLearning && (
          <CommandGroup heading="Continue learning">
            {continueLearning.map(item => {
              const Icon = item.type === 'course' ? GraduationCap : BookOpen
              return (
                <CommandItem
                  key={`cl:${item.type}:${item.id}`}
                  value={`cl:${item.type}:${item.id}`}
                  onSelect={() => handleContinueLearningSelect(item)}
                  aria-label={`${item.title}, ${TYPE_BADGE_LABEL[item.type]}`}
                  className="min-h-[44px]"
                  data-testid={`search-continue-${item.type}-${item.id}`}
                >
                  <Icon className="mr-2 size-4 shrink-0" />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm truncate">{item.title}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                  <Badge
                    className={`ml-2 shrink-0 text-[10px] px-1.5 py-0 h-4 ${TYPE_BADGE_CLASS[item.type]}`}
                  >
                    {TYPE_BADGE_LABEL[item.type]}
                  </Badge>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Recently Opened — shown only on empty query. Stale entries are
            validated on select (not at render time) so render stays cheap. */}
        {isEmptyQuery && hasRecentOpened && (
          <CommandGroup heading="Recently opened">
            {displayedRecentHits.map(hit => {
              const sectionConfig = SECTION_ORDER.find(s => s.type === hit.type)
              const Icon = sectionConfig?.icon ?? Clock
              return (
                <CommandItem
                  key={`recent:${hit.type}:${hit.id}`}
                  value={`recent:${hit.type}:${hit.id}`}
                  onSelect={() => void handleRecentSelect(hit)}
                  aria-label={`${hit.id}, ${TYPE_BADGE_LABEL[hit.type]}`}
                  className="min-h-[44px]"
                  data-testid={`search-recent-${hit.type}-${hit.id}`}
                >
                  <Icon className="mr-2 size-4 shrink-0" />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm truncate">{hit.id}</span>
                  </div>
                  <Badge
                    className={`ml-2 shrink-0 text-[10px] px-1.5 py-0 h-4 ${TYPE_BADGE_CLASS[hit.type]}`}
                  >
                    {TYPE_BADGE_LABEL[hit.type]}
                  </Badge>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Best Matches — typed query only, hidden when no matches. */}
        {hasActiveQuery && bestMatches.length > 0 && (
          <CommandGroup heading="Best Matches">
            {bestMatches.map(r => {
              const sectionConfig = SECTION_ORDER.find(s => s.type === r.type)
              const Icon = sectionConfig?.icon ?? FileText
              return (
                <CommandItem
                  // Distinct `value` prefix so cmdk treats the BM copy as a
                  // separate selectable item from its duplicate (if any) in
                  // the grouped section below.
                  key={`bm:${r.type}:${r.id}`}
                  value={`bm:${r.type}:${r.id}`}
                  onSelect={() => handleResultSelect(r)}
                  aria-label={`${r.displayTitle}, ${TYPE_BADGE_LABEL[r.type]}`}
                  className="min-h-[44px]"
                  data-testid={`search-best-match-${r.type}-${r.id}`}
                >
                  <Icon className="mr-2 size-4 shrink-0" />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm truncate">
                      {highlightMatches(
                        truncateSnippet(r.displayTitle),
                        highlightPatterns
                      )}
                    </span>
                    {r.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">
                        {r.subtitle}
                      </span>
                    )}
                  </div>
                  <Badge
                    className={`ml-2 shrink-0 text-[10px] px-1.5 py-0 h-4 ${TYPE_BADGE_CLASS[r.type]}`}
                  >
                    {TYPE_BADGE_LABEL[r.type]}
                  </Badge>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Unified entity sections (fixed order). Hidden when query is empty. */}
        {hasActiveQuery &&
          SECTION_ORDER.map(section => {
            const rows = groupedResults[section.type]
            const expanded = expandedSections.has(section.type)
            const limit = expanded ? SECTION_EXPANDED_LIMIT : SECTION_COLLAPSED_LIMIT
            const shown = rows.slice(0, limit)
            const hiddenCount = rows.length - shown.length
            const SectionIcon = section.icon

            // D-MED-6: when other sections have hits, render empty sections
            // with a disabled placeholder so the user knows that section was
            // searched. When ALL sections are empty, fall through to
            // <CommandEmpty> instead.
            if (rows.length === 0) {
              if (!anyEntityHits) return null
              return (
                <CommandGroup key={section.type} heading={section.heading}>
                  <CommandItem
                    key={`${section.type}-empty`}
                    value={`${section.type}-empty`}
                    disabled
                    // min-h-[44px] keeps the row within the 44×44 touch target
                    // guideline even though it's disabled (D-HIGH-4).
                    className="min-h-[44px] cursor-default text-muted-foreground"
                    data-testid={`search-empty-${section.type}`}
                  >
                    <SectionIcon className="mr-2 size-4 shrink-0 opacity-50" />
                    <span className="text-xs">
                      {section.heading} — no matches
                    </span>
                  </CommandItem>
                </CommandGroup>
              )
            }

            return (
              <CommandGroup key={section.type} heading={section.heading}>
                {shown.map(r => {
                  const dedupKey = `${r.type}:${r.id}`
                  const isInBestMatches = bestMatchIds.has(dedupKey)
                  // Dedup dimming (R-dedup): don't remove, dim via
                  // `text-muted-foreground` on the title + `bg-muted`
                  // badge tokens. Using opacity-* on OKLCH tokens would
                  // produce unpredictable contrast per theme.
                  const titleClass = isInBestMatches
                    ? 'text-sm truncate text-muted-foreground'
                    : 'text-sm truncate'
                  const badgeClass = isInBestMatches
                    ? 'ml-2 shrink-0 text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground'
                    : `ml-2 shrink-0 text-[10px] px-1.5 py-0 h-4 ${TYPE_BADGE_CLASS[r.type]}`
                  return (
                    <CommandItem
                      key={dedupKey}
                      value={dedupKey}
                      onSelect={() => handleResultSelect(r)}
                      // D-HIGH-3: meaningful accessible name composed of
                      // "{displayTitle}, {type}" so AT announces the human
                      // label instead of the synthetic "course:abc-123" value.
                      aria-label={`${r.displayTitle}, ${TYPE_BADGE_LABEL[r.type]}`}
                      // Screen-reader equivalent of the sighted-user dimming cue.
                      aria-description={
                        isInBestMatches
                          ? 'Also shown in Best Matches above'
                          : undefined
                      }
                      data-in-best-matches={isInBestMatches || undefined}
                      // D-HIGH-4: 44×44px minimum touch target.
                      className="min-h-[44px]"
                      data-testid={`search-result-${r.type}-${r.id}`}
                    >
                      <SectionIcon className="mr-2 size-4 shrink-0" />
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span className={titleClass}>
                          {highlightMatches(
                            truncateSnippet(r.displayTitle),
                            highlightPatterns
                          )}
                        </span>
                        {r.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">
                            {r.subtitle}
                          </span>
                        )}
                      </div>
                      <Badge
                        // D-MED-5: tinted per-type badge using theme tokens.
                        // Dimmed rows drop to bg-muted / text-muted-foreground.
                        className={badgeClass}
                      >
                        {TYPE_BADGE_LABEL[r.type]}
                      </Badge>
                    </CommandItem>
                  )
                })}
                {hiddenCount > 0 && (
                  <CommandItem
                    key={`${section.type}-show-all`}
                    value={`${section.type}-show-all`}
                    onSelect={() => toggleExpand(section.type)}
                    // D-HIGH-2: disclosure affordance — expand state exposed
                    // to AT, chevron icon reflects open/closed visually,
                    // aria-label includes the expansion state.
                    aria-expanded={expanded}
                    aria-label={`Show all ${rows.length} ${section.heading.toLowerCase()}, ${
                      expanded ? 'expanded' : 'collapsed'
                    }`}
                    // D-HIGH-4: 44×44px minimum touch target.
                    className="min-h-[44px]"
                    data-testid={`search-show-all-${section.type}`}
                  >
                    {expanded ? (
                      <ChevronDown className="mr-2 size-4 shrink-0 transition-transform" />
                    ) : (
                      <ChevronRight className="mr-2 size-4 shrink-0 transition-transform" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {expanded ? 'Show fewer' : `Show all ${rows.length}`}{' '}
                      {section.heading.toLowerCase()}
                    </span>
                  </CommandItem>
                )}
              </CommandGroup>
            )
          })}

        {showPages && (
          <CommandGroup heading="Pages">
            {staticPagesFiltered.map(item => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => handleStaticSelect(item.path)}
                  // D-HIGH-4: 44×44px minimum touch target.
                  className="min-h-[44px]"
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
        )}
      </CommandList>
    </CommandDialog>
  )
}
