/**
 * CourseFilterSidebar — filter sidebar for the Courses page.
 *
 * Provides source (All Courses / YouTube), track visibility toggle, and
 * tag-based filtering. Uses Sheet at ≥768px and Drawer below 768px.
 * Follows the FilterSidebar pattern from the library page.
 *
 * @module CourseFilterSidebar
 * @since feat: courses-content-separation
 */

import { useState, useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/app/components/ui/drawer'
import { Checkbox } from '@/app/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { Switch } from '@/app/components/ui/switch'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { useCourseFilterStore } from '@/stores/useCourseFilterStore'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { cn } from '@/app/components/ui/utils'
import type { ImportedCourse } from '@/data/types'

const DEFAULT_VISIBLE_TAGS = 12

interface CourseFilterSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableCourses: ImportedCourse[]
}

/**
 * SidebarHeaderContent — separate component that independently subscribes
 * to the Zustand store so the Clear All button re-renders inside the Radix
 * Sheet portal when filter state changes (R7 fix).
 */
function SidebarHeaderContent({ isDrawer = false }: { isDrawer?: boolean }) {
  const isAnyFilterActive = useCourseFilterStore(s => s.isAnyFilterActive)
  const clearFilter = useCourseFilterStore(s => s.clearFilter)

  const handleClearAll = () => {
    clearFilter('source')
    clearFilter('showTrackCourses')
    clearFilter('selectedTags')
  }

  if (isDrawer) {
    return (
      <DrawerHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
        <DrawerTitle className="text-lg font-bold">Filters</DrawerTitle>
        {isAnyFilterActive() && (
          <button
            onClick={handleClearAll}
            className="text-sm font-bold text-brand hover:text-brand-hover transition-colors"
            data-testid="sidebar-clear-all-filters"
          >
            Clear All
          </button>
        )}
      </DrawerHeader>
    )
  }

  return (
    <SheetHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
      <SheetTitle className="text-lg font-bold">Filters</SheetTitle>
      {isAnyFilterActive() && (
        <button
          onClick={handleClearAll}
          className="text-sm font-bold text-brand hover:text-brand-hover transition-colors"
          data-testid="sidebar-clear-all-filters"
        >
          Clear All
        </button>
      )}
    </SheetHeader>
  )
}

export function CourseFilterSidebar({
  open,
  onOpenChange,
  availableCourses,
}: CourseFilterSidebarProps) {
  const source = useCourseFilterStore(s => s.source)
  const showTrackCourses = useCourseFilterStore(s => s.showTrackCourses)
  const selectedTags = useCourseFilterStore(s => s.selectedTags)
  const setFilter = useCourseFilterStore(s => s.setFilter)
  const learningPathEntries = useLearningPathStore(s => s.entries)

  const isMobile = useMediaQuery('(max-width: 767px)')
  const [tagExpanded, setTagExpanded] = useState(false)

  // Compute distinct course IDs in any learning track
  const courseIdsInTracks = useMemo(() => {
    const ids = new Set<string>()
    for (const entry of learningPathEntries) {
      if (entry.courseType === 'imported') {
        ids.add(entry.courseId)
      }
    }
    return ids
  }, [learningPathEntries])

  // Number of courses in any learning track (unaffected by filters)
  const totalTrackCourseCount = courseIdsInTracks.size
  const hasTracks = totalTrackCourseCount > 0

  // Derive available tags with counts from the filtered courses prop
  const { availableTags, tagCounts } = useMemo(() => {
    const countMap = new Map<string, number>()
    for (const course of availableCourses) {
      for (const tag of course.tags) {
        countMap.set(tag, (countMap.get(tag) ?? 0) + 1)
      }
    }
    const sorted = Array.from(countMap.entries()).sort((a, b) => {
      // Sort by count descending, then alphabetically
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    return {
      availableTags: sorted.map(([tag]) => tag),
      tagCounts: countMap,
    }
  }, [availableCourses])

  const hasTags = availableTags.length > 0
  const needsCollapse = availableTags.length > DEFAULT_VISIBLE_TAGS

  const visibleTags = useMemo(() => {
    if (tagExpanded || !needsCollapse) return availableTags
    const topTags = availableTags.slice(0, DEFAULT_VISIBLE_TAGS)
    const selectedOutside = selectedTags.filter(tag => !topTags.includes(tag))
    return [...topTags, ...selectedOutside]
  }, [availableTags, selectedTags, tagExpanded, needsCollapse])

  const hiddenTagCount = availableTags.length - visibleTags.length

  const handleTagToggle = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag]
    setFilter('selectedTags', next)
  }

  const sidebarContent = (
    <div className="flex flex-col h-full group/sidebar">
      {/* Scrollable filter sections */}
      <div className="flex-1 overflow-y-auto px-6 pb-20">
        {/* Source filter */}
        <div className="mb-8">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Source
          </h4>
          <RadioGroup
            value={source}
            onValueChange={value => setFilter('source', value as 'all' | 'youtube')}
            aria-label="Filter by source"
            className="space-y-3"
          >
            <label className="flex items-center justify-between cursor-pointer group">
              <span
                className={cn(
                  'text-sm font-medium transition-colors',
                  source === 'all'
                    ? 'text-foreground'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                All Courses
              </span>
              <RadioGroupItem
                value="all"
                id="source-all"
                className="border-muted-foreground/30 data-[state=checked]:border-brand data-[state=checked]:text-brand"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer group">
              <span
                className={cn(
                  'text-sm font-medium transition-colors',
                  source === 'youtube'
                    ? 'text-foreground'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                YouTube
              </span>
              <RadioGroupItem
                value="youtube"
                id="source-youtube"
                className="border-muted-foreground/30 data-[state=checked]:border-brand data-[state=checked]:text-brand"
              />
            </label>
          </RadioGroup>
        </div>

        {/* Separator */}
        <div className="h-px bg-border mb-8" />

        {/* Track visibility toggle */}
        {hasTracks && (
          <>
            <div className="mb-8">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Learning Tracks
              </h4>
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Include courses in tracks
                  </span>
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-soft text-brand-soft-foreground text-[10px] font-bold"
                    aria-label={`${totalTrackCourseCount} courses in tracks`}
                  >
                    {totalTrackCourseCount}
                  </span>
                </div>
                <Switch
                  checked={showTrackCourses}
                  onCheckedChange={checked =>
                    setFilter('showTrackCourses', checked)
                  }
                  aria-label="Include courses in learning tracks"
                  className="data-[state=checked]:bg-brand"
                />
              </label>
            </div>

            <div className="h-px bg-border mb-8" />
          </>
        )}

        {/* Tag filter */}
        <div className="mb-8">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
            Tags
          </h4>
          {hasTags ? (
            <ScrollArea className={cn(needsCollapse && !tagExpanded ? 'max-h-[300px]' : 'max-h-[400px]')}>
              <div className="space-y-3 pr-1">
                {visibleTags.map(tag => (
                  <label key={tag} className="flex items-center gap-3 cursor-pointer group">
                    <Checkbox
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() => handleTagToggle(tag)}
                      className="border-muted-foreground/30 data-[state=checked]:border-brand data-[state=checked]:bg-brand"
                    />
                    <span className="text-sm font-medium text-foreground flex-1">{tag}</span>
                    {tagCounts.has(tag) && (
                      <span
                        className="text-[10px] text-muted-foreground"
                        aria-label={`${tagCounts.get(tag)} courses`}
                      >
                        {tagCounts.get(tag)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              No tags available for the current selection.
            </p>
          )}
          {needsCollapse && (
            <button
              type="button"
              onClick={() => setTagExpanded(prev => !prev)}
              aria-expanded={tagExpanded}
              aria-label={
                tagExpanded
                  ? `Show fewer tags, currently showing all ${availableTags.length}`
                  : `Show all ${availableTags.length} tags, currently showing ${visibleTags.length}`
              }
              className="mt-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {tagExpanded ? 'Show less' : `+${hiddenTagCount} more`}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
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
        className="w-[320px] sm:w-[380px] flex flex-col p-0"
        data-testid="course-filter-sidebar"
        showCloseButton={false}
      >
        <SidebarHeaderContent />
        {sidebarContent}
      </SheetContent>
    </Sheet>
  )
}
