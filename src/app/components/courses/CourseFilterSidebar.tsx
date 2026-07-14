import { useMemo, useState, type ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/app/components/ui/drawer'
import { Checkbox } from '@/app/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { Switch } from '@/app/components/ui/switch'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { useCourseFilterStore, type CourseSourceFilter } from '@/stores/useCourseFilterStore'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { cn } from '@/app/components/ui/utils'
import type { Difficulty, ImportedAuthor, ImportedCourse } from '@/data/types'

const DEFAULT_VISIBLE_TAGS = 12

const SOURCE_OPTIONS: ReadonlyArray<{ value: CourseSourceFilter; label: string }> = [
  { value: 'all', label: 'All Sources' },
  { value: 'local', label: 'Local Folder' },
  { value: 'server', label: 'Course Server' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'drive', label: 'Google Drive' },
]

const DIFFICULTY_OPTIONS: ReadonlyArray<{ value: Difficulty; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
]

interface CourseFilterSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableCourses: ImportedCourse[]
  availableAuthors?: ImportedAuthor[]
  courseIdsInTracks?: Set<string>
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border py-5 last:border-b-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function FilterCheckbox({
  checked,
  label,
  count,
  onCheckedChange,
}: {
  checked: boolean
  label: string
  count?: number
  onCheckedChange: () => void
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-sm hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span
          className="text-xs tabular-nums text-muted-foreground"
          aria-label={`${count} courses`}
        >
          {count}
        </span>
      )}
    </label>
  )
}

function SidebarHeaderContent({ isDrawer = false }: { isDrawer?: boolean }) {
  const source = useCourseFilterStore(state => state.source)
  const showTrackCourses = useCourseFilterStore(state => state.showTrackCourses)
  const selectedTags = useCourseFilterStore(state => state.selectedTags)
  const selectedDifficulties = useCourseFilterStore(state => state.selectedDifficulties)
  const selectedCategories = useCourseFilterStore(state => state.selectedCategories)
  const selectedAuthorIds = useCourseFilterStore(state => state.selectedAuthorIds)
  const clearFilter = useCourseFilterStore(state => state.clearFilter)

  const isAnyActive =
    source !== 'all' ||
    !showTrackCourses ||
    selectedTags.length > 0 ||
    selectedDifficulties.length > 0 ||
    selectedCategories.length > 0 ||
    selectedAuthorIds.length > 0

  const handleClearAll = () => {
    clearFilter('source')
    clearFilter('showTrackCourses')
    clearFilter('selectedTags')
    clearFilter('selectedDifficulties')
    clearFilter('selectedCategories')
    clearFilter('selectedAuthorIds')
  }

  const title = 'More Filters'
  const clearButton = isAnyActive ? (
    <button
      type="button"
      onClick={handleClearAll}
      className="min-h-11 px-2 text-sm font-semibold text-brand hover:text-brand-hover"
      data-testid="sidebar-clear-all-filters"
    >
      Clear All
    </button>
  ) : null

  if (isDrawer) {
    return (
      <DrawerHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
        <div>
          <DrawerTitle className="text-lg font-semibold">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            Narrow courses by source, track membership, difficulty, category, author, or tag.
          </DrawerDescription>
        </div>
        {clearButton}
      </DrawerHeader>
    )
  }

  return (
    <SheetHeader className="flex flex-row items-center justify-between px-6 pb-3 pt-6">
      <div>
        <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
        <SheetDescription className="sr-only">
          Narrow courses by source, track membership, difficulty, category, author, or tag.
        </SheetDescription>
      </div>
      {clearButton}
    </SheetHeader>
  )
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

export function CourseFilterSidebar({
  open,
  onOpenChange,
  availableCourses,
  availableAuthors = [],
  courseIdsInTracks: courseIdsInTracksProp,
}: CourseFilterSidebarProps) {
  const source = useCourseFilterStore(state => state.source)
  const showTrackCourses = useCourseFilterStore(state => state.showTrackCourses)
  const selectedTags = useCourseFilterStore(state => state.selectedTags)
  const selectedDifficulties = useCourseFilterStore(state => state.selectedDifficulties)
  const selectedCategories = useCourseFilterStore(state => state.selectedCategories)
  const selectedAuthorIds = useCourseFilterStore(state => state.selectedAuthorIds)
  const setFilter = useCourseFilterStore(state => state.setFilter)

  const isMobile = useMediaQuery('(max-width: 767px)')
  const [tagExpanded, setTagExpanded] = useState(false)
  const courseIdsInTracks = courseIdsInTracksProp ?? new Set<string>()

  const facets = useMemo(() => {
    const tagCounts = new Map<string, number>()
    const categoryCounts = new Map<string, number>()
    const difficultyCounts = new Map<Difficulty, number>()
    const authorCounts = new Map<string, number>()

    for (const course of availableCourses) {
      for (const tag of course.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      if (course.category.trim()) {
        categoryCounts.set(course.category, (categoryCounts.get(course.category) ?? 0) + 1)
      }
      if (course.difficulty) {
        difficultyCounts.set(course.difficulty, (difficultyCounts.get(course.difficulty) ?? 0) + 1)
      }
      if (course.authorId) {
        authorCounts.set(course.authorId, (authorCounts.get(course.authorId) ?? 0) + 1)
      }
    }

    const tags = Array.from(tagCounts.keys()).sort((a, b) => {
      const countDifference = (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0)
      return countDifference || a.localeCompare(b)
    })
    const categories = Array.from(categoryCounts.keys()).sort((a, b) => a.localeCompare(b))
    const authors = availableAuthors
      .filter(author => authorCounts.has(author.id) || selectedAuthorIds.includes(author.id))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { tagCounts, categoryCounts, difficultyCounts, authorCounts, tags, categories, authors }
  }, [availableAuthors, availableCourses, selectedAuthorIds])

  const needsTagCollapse = facets.tags.length > DEFAULT_VISIBLE_TAGS
  const visibleTags = useMemo(() => {
    if (tagExpanded || !needsTagCollapse) return facets.tags
    const topTags = facets.tags.slice(0, DEFAULT_VISIBLE_TAGS)
    return [...topTags, ...selectedTags.filter(tag => !topTags.includes(tag))]
  }, [facets.tags, needsTagCollapse, selectedTags, tagExpanded])

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 pb-12">
        <FilterSection title="Source">
          <RadioGroup
            value={source}
            onValueChange={value => setFilter('source', value as CourseSourceFilter)}
            aria-label="Filter by source"
            className="gap-1"
          >
            {SOURCE_OPTIONS.map(option => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center justify-between rounded-md px-1 text-sm hover:bg-muted/50"
              >
                <span>{option.label}</span>
                <RadioGroupItem value={option.value} aria-label={option.label} />
              </label>
            ))}
          </RadioGroup>
        </FilterSection>

        {courseIdsInTracks.size > 0 && (
          <FilterSection title="Learning Tracks">
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
              <span className="text-sm">
                Include Track Courses
                <span className="ml-2 text-xs text-muted-foreground">{courseIdsInTracks.size}</span>
              </span>
              <Switch
                checked={showTrackCourses}
                onCheckedChange={checked => setFilter('showTrackCourses', checked)}
                aria-label="Include courses in learning tracks"
              />
            </label>
          </FilterSection>
        )}

        {facets.difficultyCounts.size > 0 && (
          <FilterSection title="Difficulty">
            <div className="space-y-1">
              {DIFFICULTY_OPTIONS.filter(
                option =>
                  facets.difficultyCounts.has(option.value) ||
                  selectedDifficulties.includes(option.value)
              ).map(option => (
                <FilterCheckbox
                  key={option.value}
                  label={option.label}
                  count={facets.difficultyCounts.get(option.value) ?? 0}
                  checked={selectedDifficulties.includes(option.value)}
                  onCheckedChange={() =>
                    setFilter(
                      'selectedDifficulties',
                      toggleValue(selectedDifficulties, option.value)
                    )
                  }
                />
              ))}
            </div>
          </FilterSection>
        )}

        {facets.categories.length > 0 && (
          <FilterSection title="Category">
            <div className="space-y-1">
              {facets.categories.map(category => (
                <FilterCheckbox
                  key={category}
                  label={category}
                  count={facets.categoryCounts.get(category)}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() =>
                    setFilter('selectedCategories', toggleValue(selectedCategories, category))
                  }
                />
              ))}
            </div>
          </FilterSection>
        )}

        {facets.authors.length > 0 && (
          <FilterSection title="Author">
            <div className="space-y-1">
              {facets.authors.map(author => (
                <FilterCheckbox
                  key={author.id}
                  label={author.name}
                  count={facets.authorCounts.get(author.id) ?? 0}
                  checked={selectedAuthorIds.includes(author.id)}
                  onCheckedChange={() =>
                    setFilter('selectedAuthorIds', toggleValue(selectedAuthorIds, author.id))
                  }
                />
              ))}
            </div>
          </FilterSection>
        )}

        <FilterSection title="Tags">
          {facets.tags.length > 0 ? (
            <>
              <ScrollArea className={cn(tagExpanded ? 'max-h-[400px]' : 'max-h-[300px]')}>
                <div className="space-y-1 pr-2">
                  {visibleTags.map(tag => (
                    <FilterCheckbox
                      key={tag}
                      label={tag}
                      count={facets.tagCounts.get(tag)}
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() =>
                        setFilter('selectedTags', toggleValue(selectedTags, tag))
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
              {needsTagCollapse && (
                <button
                  type="button"
                  onClick={() => setTagExpanded(expanded => !expanded)}
                  aria-expanded={tagExpanded}
                  className="mt-2 min-h-11 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {tagExpanded
                    ? 'Show Fewer'
                    : `Show ${facets.tags.length - visibleTags.length} More`}
                </button>
              )}
            </>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">No tags available.</p>
          )}
        </FilterSection>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] overscroll-contain">
          <SidebarHeaderContent isDrawer />
          {sidebarContent}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[340px] flex-col overscroll-contain p-0 sm:w-[400px]"
        data-testid="course-filter-sidebar"
        showCloseButton
      >
        <SidebarHeaderContent />
        {sidebarContent}
      </SheetContent>
    </Sheet>
  )
}
