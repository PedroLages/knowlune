import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  BarChart3,
  Settings,
  Library,
  Info,
  Notebook,
  FileText,
  PlayCircle,
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
import { allCourses } from '@/data/courses'

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
    id: 'page-my-progress',
    label: 'My Progress',
    path: '/my-class',
    group: 'Pages',
    icon: BookOpen,
    keywords: ['progress', 'class', 'my'],
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
    id: 'page-library',
    label: 'Library',
    path: '/library',
    group: 'Pages',
    icon: Library,
    keywords: ['library', 'resources', 'files'],
  },
  {
    id: 'page-journal',
    label: 'Journal',
    path: '/messages',
    group: 'Pages',
    icon: Notebook,
    keywords: ['journal', 'messages', 'notes'],
  },
  {
    id: 'page-about',
    label: 'About',
    path: '/instructors',
    group: 'Pages',
    icon: Info,
    keywords: ['about', 'instructors', 'info'],
  },
  {
    id: 'page-reports',
    label: 'Reports',
    path: '/reports',
    group: 'Pages',
    icon: BarChart3,
    keywords: ['reports', 'analytics', 'stats'],
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

function buildSearchIndex(): SearchItem[] {
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
          path: `/courses/${course.id}/${lesson.id}`,
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
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Capture the element that had focus before the dialog opened
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement
    }
  }, [open])

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
    if (!newOpen && previouslyFocusedRef.current) {
      requestAnimationFrame(() => previouslyFocusedRef.current?.focus())
    }
  }

  const searchIndex = buildSearchIndex()

  const handleSelect = (path: string) => {
    handleOpenChange(false)
    navigate(path)
  }

  // Group items
  const pages = searchIndex.filter(item => item.group === 'Pages')
  const courses = searchIndex.filter(item => item.group === 'Courses')
  const lessons = searchIndex.filter(item => item.group === 'Lessons')

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Search for pages, courses, and lessons"
    >
      <CommandInput placeholder="Search pages, courses, lessons..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {pages.map(item => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={[item.label, ...item.keywords].join(' ')}
                onSelect={() => handleSelect(item.path)}
              >
                <Icon className="mr-2 h-4 w-4 shrink-0" />
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
                <Icon className="mr-2 h-4 w-4 shrink-0" />
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
                <Icon className="mr-2 h-4 w-4 shrink-0" />
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
