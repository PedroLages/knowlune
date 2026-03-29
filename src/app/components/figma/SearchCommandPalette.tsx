import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router'
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
  PlayCircle,
  StickyNote,
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
import { useCourseStore } from '@/stores/useCourseStore'
import type { Course } from '@/data/types'
import { searchNotesWithContext, type NoteSearchResult } from '@/lib/noteSearch'
import { truncateSnippet, highlightMatches, buildHighlightPatterns } from '@/lib/searchUtils'

interface SearchItem {
  id: string
  label: string
  sublabel?: string
  path: string
  group: 'Pages' | 'Courses' | 'Lessons'
  icon: React.ComponentType<{ className?: string }>
  keywords: string[]
}

const navigationPages: SearchItem[] = [
  {
    id: 'page-overview',
    label: 'Overview',
    path: '/',
    group: 'Pages',
    icon: LayoutDashboard,
    keywords: ['overview', 'dashboard', 'home'],
  },
  {
    id: 'page-my-courses',
    label: 'My Courses',
    path: '/my-class',
    group: 'Pages',
    icon: BookOpen,
    keywords: ['courses', 'progress', 'class', 'my'],
  },
  {
    id: 'page-courses',
    label: 'Courses',
    path: '/courses',
    group: 'Pages',
    icon: GraduationCap,
    keywords: ['courses', 'catalog', 'all'],
  },
  {
    id: 'page-notes',
    label: 'Notes & Bookmarks',
    path: '/notes',
    group: 'Pages',
    icon: StickyNote,
    keywords: ['notes', 'bookmarks', 'library', 'resources', 'files'],
  },
  {
    id: 'page-about',
    label: 'About',
    path: '/authors',
    group: 'Pages',
    icon: Info,
    keywords: ['about', 'authors', 'instructors', 'info'],
  },
  {
    id: 'page-reports-study',
    label: 'Study Analytics',
    path: '/reports?tab=study',
    group: 'Pages',
    icon: BarChart3,
    keywords: ['reports', 'study', 'analytics', 'stats', 'lessons', 'completion'],
  },
  {
    id: 'page-reports-quizzes',
    label: 'Quiz Analytics',
    path: '/reports?tab=quizzes',
    group: 'Pages',
    icon: ClipboardList,
    keywords: ['reports', 'quiz', 'analytics', 'quizzes', 'performance', 'score'],
  },
  {
    id: 'page-reports-ai',
    label: 'AI Analytics',
    path: '/reports?tab=ai',
    group: 'Pages',
    icon: BrainCircuit,
    keywords: ['reports', 'ai', 'analytics', 'artificial intelligence', 'insights'],
  },
  {
    id: 'page-settings',
    label: 'Settings',
    path: '/settings',
    group: 'Pages',
    icon: Settings,
    keywords: ['settings', 'preferences', 'config'],
  },
]

function buildSearchIndex(allCourses: Course[]): SearchItem[] {
  const items: SearchItem[] = [...navigationPages]

  for (const course of allCourses) {
    items.push({
      id: `course-${course.id}`,
      label: course.shortTitle || course.title,
      sublabel: `${course.totalLessons} lessons · ${course.estimatedHours}h`,
      path: `/courses/${course.id}`,
      group: 'Courses',
      icon: GraduationCap,
      keywords: [course.title.toLowerCase(), course.shortTitle.toLowerCase(), ...course.tags],
    })

    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        const hasVideo = lesson.resources.some(r => r.type === 'video')
        items.push({
          id: `lesson-${course.id}-${lesson.id}`,
          label: lesson.title,
          sublabel: `${course.shortTitle} · ${mod.title}`,
          path: `/courses/${course.id}/lessons/${lesson.id}`,
          group: 'Lessons',
          icon: hasVideo ? PlayCircle : FileText,
          keywords: [
            lesson.title.toLowerCase(),
            mod.title.toLowerCase(),
            course.shortTitle.toLowerCase(),
            ...lesson.keyTopics,
          ],
        })
      }
    }
  }

  return items
}

interface SearchCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchCommandPalette({ open, onOpenChange }: SearchCommandPaletteProps) {
  const navigate = useNavigate()
  const allCourses = useCourseStore(s => s.courses)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [noteResults, setNoteResults] = useState<NoteSearchResult[]>([])

  const searchIndex = useMemo(() => buildSearchIndex(allCourses), [allCourses])

  const commandFilter = useCallback((value: string, search: string) => {
    // Note items are managed by MiniSearch — always show them
    if (value.startsWith('note:')) return 1
    // Default filtering for pages/courses/lessons
    if (!search) return 1
    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
  }, [])

  const highlightPatterns = useMemo(() => buildHighlightPatterns(debouncedQuery), [debouncedQuery])

  // Capture focus and reset state on open/close
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement
    } else {
      setSearchQuery('')
      setDebouncedQuery('')
      setNoteResults([])
    }
  }, [open])

  // 150ms debounce for note search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 150)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Run MiniSearch on debounced query
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setNoteResults([])
      return
    }
    setNoteResults(searchNotesWithContext(debouncedQuery))
  }, [debouncedQuery])

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
    if (!newOpen && previouslyFocusedRef.current) {
      requestAnimationFrame(() => previouslyFocusedRef.current?.focus())
    }
  }

  const handleSelect = (path: string) => {
    handleOpenChange(false)
    navigate(path)
  }

  const handleNoteSelect = (result: NoteSearchResult) => {
    handleOpenChange(false)
    let path = `/courses/${result.courseId}/lessons/${result.videoId}?panel=notes`
    if (result.timestamp != null) {
      path += `&t=${result.timestamp}`
    }
    navigate(path)
  }

  // Group items
  const pages = searchIndex.filter(item => item.group === 'Pages')
  const courses = searchIndex.filter(item => item.group === 'Courses')
  const lessons = searchIndex.filter(item => item.group === 'Lessons')

  const hasNoteResults = noteResults.length > 0
  const hasActiveQuery = debouncedQuery.trim().length > 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Search for pages, courses, lessons, and notes"
      filter={commandFilter}
    >
      <CommandInput
        placeholder="Search pages, courses, lessons, notes..."
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {hasActiveQuery
            ? 'No results found. Try different keywords or browse by tag.'
            : 'No results found.'}
        </CommandEmpty>

        {hasNoteResults && (
          <CommandGroup heading="Notes">
            {noteResults.map(result => (
              <CommandItem
                key={result.id}
                value={`note:${result.id}`}
                onSelect={() => handleNoteSelect(result)}
              >
                <StickyNote className="mr-2 size-4 shrink-0 text-gold" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm truncate">
                    {highlightMatches(truncateSnippet(result.content), highlightPatterns)}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {result.courseName}
                    {result.videoTitle ? ` · ${result.videoTitle}` : ''}
                  </span>
                  {result.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {result.tags.map(tag => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Pages">
          {pages.map(item => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={[item.label, ...item.keywords].join(' ')}
                onSelect={() => handleSelect(item.path)}
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

        <CommandGroup heading="Courses">
          {courses.map(item => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={[item.label, ...item.keywords].join(' ')}
                onSelect={() => handleSelect(item.path)}
              >
                <Icon className="mr-2 size-4 shrink-0" />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  {item.sublabel && (
                    <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                  )}
                </div>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandGroup heading="Lessons">
          {lessons.map(item => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={[item.label, ...item.keywords].join(' ')}
                onSelect={() => handleSelect(item.path)}
              >
                <Icon className="mr-2 size-4 shrink-0" />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  {item.sublabel && (
                    <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                  )}
                </div>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
