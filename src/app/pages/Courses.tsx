import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/app/components/ui/card'
import { VirtualizedCoursesList } from '@/app/components/courses/VirtualizedCoursesList'
import { Button } from '@/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { ImportedCourseCard } from '@/app/components/figma/ImportedCourseCard'
import { ImportedCourseCompactCard } from '@/app/components/figma/ImportedCourseCompactCard'
import { ImportedCourseListRow } from '@/app/components/figma/ImportedCourseListRow'
import { StatusFilter, statuses as statusFilterOptions } from '@/app/components/figma/StatusFilter'
import {
  FolderOpen,
  BookOpen,
  Youtube,
  Trash2,
  X,
  Loader2,
  ListFilter,
  Settings2,
  ListChecks,
} from 'lucide-react'
import { getImportedCourseCompletionPercent } from '@/lib/progress'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useLazyStore } from '@/hooks/useLazyStore'
import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { BulkImportDialog } from '@/app/components/figma/BulkImportDialog'
import { YouTubeImportDialog } from '@/app/components/figma/YouTubeImportDialog'
import { db } from '@/db'
import { calculateMomentumScore } from '@/lib/momentum'
import { HeaderSearchButton } from '@/app/components/figma/HeaderSearchButton'
import { ViewModeToggle } from '@/app/components/courses/ViewModeToggle'
import { getGridClassName } from '@/app/components/courses/gridClassName'
import { useEngagementPrefsStore, type CourseGridColumns } from '@/stores/useEngagementPrefsStore'
import { useCourseFilterStore } from '@/stores/useCourseFilterStore'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { CourseFilterSidebar } from '@/app/components/courses/CourseFilterSidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'

import type { MomentumScore } from '@/lib/momentum'

type SortMode = 'recent' | 'name' | 'progress' | 'momentum'

function parseGridColumns(value: string): CourseGridColumns {
  if (value === 'auto') return 'auto'
  const columns = Number(value)
  return columns === 2 || columns === 3 || columns === 4 || columns === 5 ? columns : 'auto'
}

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-brand-soft px-2.5 text-xs font-medium text-brand-soft-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex size-8 items-center justify-center rounded-full hover:bg-brand/10 hover:text-destructive"
        aria-label={`Remove ${label} filter`}
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  )
}

export function Courses() {
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [youtubeImportOpen, setYoutubeImportOpen] = useState(false)
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false)
  const [momentumMap, setMomentumMap] = useState<Map<string, MomentumScore>>(new Map())
  const [importedCompletionMap, setImportedCompletionMap] = useState<Map<string, number>>(new Map())
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
  const getAllTags = useCourseImportStore(state => state.getAllTags)
  const removeImportedCourses = useCourseImportStore(state => state.removeImportedCourses)
  const courseViewMode = useEngagementPrefsStore(state => state.courseViewMode)
  const courseGridColumns = useEngagementPrefsStore(state => state.courseGridColumns)
  const setEngagementPref = useEngagementPrefsStore(state => state.setPreference)

  // Course filter store
  const selectedStatuses = useCourseFilterStore(s => s.selectedStatuses)
  const setFilter = useCourseFilterStore(s => s.setFilter)
  const clearAllFilters = useCourseFilterStore(s => s.clearAllFilters)
  const sourceFilter = useCourseFilterStore(s => s.source)
  const showTrackCourses = useCourseFilterStore(s => s.showTrackCourses)
  const selectedTags = useCourseFilterStore(s => s.selectedTags)
  const selectedDifficulties = useCourseFilterStore(s => s.selectedDifficulties)
  const selectedCategories = useCourseFilterStore(s => s.selectedCategories)
  const selectedAuthorIds = useCourseFilterStore(s => s.selectedAuthorIds)
  const isAnyFilterActive = useCourseFilterStore(s => s.isAnyFilterActive)

  // Learning path store — for track membership computation
  const learningPathEntries = useLearningPathStore(s => s.entries)
  const isLoaded = useLearningPathStore(s => s.isLoaded)
  const loadPaths = useLearningPathStore(s => s.loadPaths)
  const authors = useAuthorStore(s => s.authors)
  const loadAuthors = useAuthorStore(s => s.loadAuthors)

  // Lazy-load stores on mount
  useLazyStore(loadImportedCourses)
  useLazyStore(loadPaths)
  useLazyStore(loadAuthors)

  useEffect(() => {
    let ignore = false

    async function loadCourseMetrics() {
      try {
        const rawSessions = await db.studySessions.toArray()
        if (ignore) return
        // Filter out corrupted sessions with invalid courseId before grouping
        const sessions = rawSessions.filter(
          s => s != null && typeof s.courseId === 'string' && s.courseId
        )
        const sessionsByCourse = new Map<string, typeof sessions>()
        for (const s of sessions) {
          const arr = sessionsByCourse.get(s.courseId) ?? []
          arr.push(s)
          sessionsByCourse.set(s.courseId, arr)
        }
        const momentumMap = new Map<string, MomentumScore>()

        // Calculate momentum + completion for imported courses (AC: E07-S01, E43-S05)
        const completionMap = new Map<string, number>()
        for (const course of importedCourses) {
          const courseSessions = sessionsByCourse.get(course.id) ?? []

          // Compute actual completion % from Dexie progress table
          const completionPercent = await getImportedCourseCompletionPercent(
            course.id,
            course.videoCount
          )
          completionMap.set(course.id, completionPercent)

          const momentum = calculateMomentumScore({
            courseId: course.id,
            totalLessons: course.videoCount,
            completionPercent,
            sessions: courseSessions,
          })
          momentumMap.set(course.id, momentum)
        }

        setImportedCompletionMap(completionMap)
        setMomentumMap(momentumMap)
      } catch (err) {
        // silent-catch-ok: metrics failure is non-fatal — courses still load without momentum/risk indicators
        console.warn('[Courses] Failed to load course metrics:', err)
      }
    }

    loadCourseMetrics()

    const handleStudyLogUpdated = () => {
      loadCourseMetrics()
    }
    window.addEventListener('study-log-updated', handleStudyLogUpdated)
    return () => {
      ignore = true
      window.removeEventListener('study-log-updated', handleStudyLogUpdated)
    }
  }, [importedCourses])

  // Tags remain editable in the course editor even though card surfaces stay uncluttered.
  const allTags = useMemo(() => getAllTags(), [getAllTags])

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

  const finalFilteredCourses = useMemo(() => {
    let result = showTrackCourses
      ? importedCourses
      : importedCourses.filter(c => !courseIdsInTracks.has(c.id))

    if (sourceFilter !== 'all') {
      result = result.filter(c => (c.source ?? 'local') === sourceFilter)
    }

    if (selectedStatuses.length > 0) {
      result = result.filter(c => selectedStatuses.includes(c.status))
    }

    if (selectedDifficulties.length > 0) {
      result = result.filter(c => c.difficulty && selectedDifficulties.includes(c.difficulty))
    }

    if (selectedCategories.length > 0) {
      result = result.filter(c => selectedCategories.includes(c.category))
    }

    if (selectedAuthorIds.length > 0) {
      result = result.filter(c => c.authorId && selectedAuthorIds.includes(c.authorId))
    }

    if (selectedTags.length > 0) {
      const tagSet = new Set(selectedTags.map(tag => tag.toLowerCase()))
      result = result.filter(c => c.tags.some(tag => tagSet.has(tag.toLowerCase())))
    }

    return result
  }, [
    importedCourses,
    courseIdsInTracks,
    showTrackCourses,
    sourceFilter,
    selectedStatuses,
    selectedDifficulties,
    selectedCategories,
    selectedAuthorIds,
    selectedTags,
  ])

  // AC1-AC4 (E1C-S05): Sort imported courses by momentum or importedAt
  const sortedImportedCourses = useMemo(() => {
    return [...finalFilteredCourses].sort((a, b) => {
      if (sortMode === 'momentum') {
        const scoreA = momentumMap.get(a.id)?.score ?? 0
        const scoreB = momentumMap.get(b.id)?.score ?? 0
        // AC1: Higher momentum first
        if (scoreA !== scoreB) return scoreB - scoreA
        // AC4: Zero-momentum (and equal-score) tiebreaker: importedAt newest first
        return new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
      }
      if (sortMode === 'name') return a.name.localeCompare(b.name)
      if (sortMode === 'progress') {
        const progressDifference =
          (importedCompletionMap.get(b.id) ?? 0) - (importedCompletionMap.get(a.id) ?? 0)
        return progressDifference || a.name.localeCompare(b.name)
      }
      return new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    })
  }, [finalFilteredCourses, sortMode, momentumMap, importedCompletionMap])

  function handleOpenBulkImport() {
    setBulkImportOpen(true)
  }

  function handleSingleImportFromBulk() {
    setBulkImportOpen(false)
    setWizardOpen(true)
  }

  function handleYouTubeImportFromBulk() {
    setBulkImportOpen(false)
    setYoutubeImportOpen(true)
  }

  const totalCourses = importedCourses.length

  // Lookup map for human-readable status labels (F03)
  const statusLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of statusFilterOptions) {
      map.set(s.value, s.label)
    }
    return map
  }, [])

  const authorNameMap = useMemo(
    () => new Map(authors.map(author => [author.id, author.name])),
    [authors]
  )
  const advancedFilterCount =
    (sourceFilter !== 'all' ? 1 : 0) +
    (!showTrackCourses ? 1 : 0) +
    selectedTags.length +
    selectedDifficulties.length +
    selectedCategories.length +
    selectedAuthorIds.length
  const hasAnyActiveFilters = selectedStatuses.length > 0 || isAnyFilterActive()

  // Selection mode handlers
  function handleToggleSelect(courseId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(courseId)) {
        next.delete(courseId)
      } else {
        next.add(courseId)
      }
      return next
    })
  }

  function handleSelectAll() {
    setSelectedIds(new Set(sortedImportedCourses.map(c => c.id)))
  }

  function handleDeselectAll() {
    setSelectedIds(new Set())
  }

  function handleCancelSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  async function handleDeleteSelected() {
    if (isDeleting || selectedIds.size === 0) return
    setIsDeleting(true)
    const ids = Array.from(selectedIds)
    await removeImportedCourses(ids)
    setSelectedIds(new Set())
    setSelectionMode(false)
    setIsDeleting(false)
  }

  // Escape key exits selection mode
  useEffect(() => {
    if (!selectionMode) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectionMode(false)
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectionMode])

  return (
    <div>
      <div
        data-testid="courses-header"
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold mb-2">All Courses</h1>
          {totalCourses > 0 && (
            <p className="text-muted-foreground">
              {totalCourses} {totalCourses === 1 ? 'course' : 'courses'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <HeaderSearchButton scope="course" />
          {totalCourses > 0 && (
            <Button
              variant="brand"
              onClick={handleOpenBulkImport}
              className="hover:scale-[1.02] hover:shadow-md rounded-xl transition-[transform,box-shadow] duration-200"
              data-testid="import-course-btn"
            >
              <FolderOpen className="size-4 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Import Course</span>
              <span className="sr-only sm:hidden">Import Course</span>
            </Button>
          )}
        </div>
      </div>

      <ImportWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSingleImport={handleSingleImportFromBulk}
        onYouTubeImport={handleYouTubeImportFromBulk}
      />
      <YouTubeImportDialog open={youtubeImportOpen} onOpenChange={setYoutubeImportOpen} />

      {totalCourses === 0 ? (
        <Card className="border-2 border-dashed" data-testid="courses-empty-state">
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="size-16 rounded-full bg-brand-soft flex items-center justify-center mb-4">
              <BookOpen className="size-8 text-brand-muted" aria-hidden="true" />
            </div>
            <h2 className="font-display text-lg font-medium mb-2">No courses yet</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Import a course folder or build one from YouTube videos
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="brand"
                size="lg"
                onClick={handleOpenBulkImport}
                data-testid="empty-import-folder-btn"
              >
                <FolderOpen className="size-4 mr-2" aria-hidden="true" />
                Import from Folder
              </Button>
              <Button
                variant="brand-outline"
                size="lg"
                onClick={() => setYoutubeImportOpen(true)}
                data-testid="empty-youtube-btn"
              >
                <Youtube className="size-4 mr-2" aria-hidden="true" />
                Build from YouTube
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {selectionMode ? (
            <div
              className="mb-4 flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2"
              data-testid="selection-action-bar"
            >
              <span className="mr-2 text-sm font-semibold" data-testid="selected-count">
                {selectedIds.size} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                data-testid="select-all-btn"
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeselectAll}
                data-testid="deselect-all-btn"
                disabled={selectedIds.size === 0}
              >
                Deselect All
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0 || isDeleting}
                onClick={handleDeleteSelected}
                data-testid="delete-selected-btn"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-4 mr-1 animate-spin" aria-hidden="true" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4 mr-1" aria-hidden="true" />
                    Delete Selected ({selectedIds.size})
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelSelection}
                data-testid="cancel-selection-btn"
                className="ml-auto"
              >
                <X className="size-4 mr-1" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          ) : (
            <div
              className="mb-3 flex w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/60 p-2"
              data-testid="courses-control-bar"
            >
              <StatusFilter
                selectedStatuses={selectedStatuses}
                onSelectedStatusesChange={statuses => setFilter('selectedStatuses', statuses)}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => setFilterSidebarOpen(true)}
                className="min-h-11 rounded-full px-3 text-xs"
                data-testid="open-filter-sidebar-btn"
                aria-label={
                  advancedFilterCount > 0
                    ? `${advancedFilterCount} active advanced filters — open more filters`
                    : 'Open more course filters'
                }
              >
                <ListFilter className="size-4" aria-hidden="true" />
                More Filters
                {advancedFilterCount > 0 && (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
                    {advancedFilterCount}
                  </span>
                )}
              </Button>

              <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 pb-0.5 lg:w-auto">
                <span
                  className="whitespace-nowrap px-1 text-xs tabular-nums text-muted-foreground"
                  aria-live="polite"
                  data-testid="filtered-course-count"
                >
                  {finalFilteredCourses.length} shown
                </span>

                <Select value={sortMode} onValueChange={value => setSortMode(value as SortMode)}>
                  <SelectTrigger
                    data-testid="sort-select"
                    aria-label="Sort courses"
                    className="min-h-11 w-[172px] rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recently Imported</SelectItem>
                    <SelectItem value="name">Name A–Z</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="momentum">Momentum</SelectItem>
                  </SelectContent>
                </Select>

                <ViewModeToggle
                  value={courseViewMode}
                  onChange={mode => setEngagementPref('courseViewMode', mode)}
                  showLabels={false}
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-11 rounded-xl"
                      aria-label="Course display and selection options"
                      data-testid="course-options-menu-btn"
                    >
                      <Settings2 className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {courseViewMode === 'grid' && (
                      <>
                        <DropdownMenuLabel>Grid Columns</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={String(courseGridColumns)}
                          onValueChange={value =>
                            setEngagementPref('courseGridColumns', parseGridColumns(value))
                          }
                        >
                          {['auto', '2', '3', '4', '5'].map(value => (
                            <DropdownMenuRadioItem
                              key={value}
                              value={value}
                              data-testid={`course-grid-columns-${value}`}
                            >
                              {value === 'auto' ? 'Automatic' : `${value} Columns`}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      onSelect={() => setSelectionMode(true)}
                      data-testid="enter-selection-mode-btn"
                      className="min-h-11"
                    >
                      <ListChecks className="size-4" aria-hidden="true" />
                      Select Courses
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          {hasAnyActiveFilters && (
            <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="filter-chips-row">
              {selectedStatuses.map(status => (
                <ActiveFilterChip
                  key={status}
                  label={statusLabelMap.get(status) ?? status}
                  onRemove={() =>
                    setFilter(
                      'selectedStatuses',
                      selectedStatuses.filter(item => item !== status)
                    )
                  }
                />
              ))}
              {sourceFilter !== 'all' && (
                <ActiveFilterChip
                  label={
                    {
                      local: 'Local Folder',
                      server: 'Course Server',
                      youtube: 'YouTube',
                      drive: 'Google Drive',
                    }[sourceFilter]
                  }
                  onRemove={() => setFilter('source', 'all')}
                />
              )}
              {!showTrackCourses && (
                <ActiveFilterChip
                  label="Outside Learning Tracks"
                  onRemove={() => setFilter('showTrackCourses', true)}
                />
              )}
              {selectedDifficulties.map(difficulty => (
                <ActiveFilterChip
                  key={difficulty}
                  label={difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                  onRemove={() =>
                    setFilter(
                      'selectedDifficulties',
                      selectedDifficulties.filter(item => item !== difficulty)
                    )
                  }
                />
              ))}
              {selectedCategories.map(category => (
                <ActiveFilterChip
                  key={category}
                  label={category}
                  onRemove={() =>
                    setFilter(
                      'selectedCategories',
                      selectedCategories.filter(item => item !== category)
                    )
                  }
                />
              ))}
              {selectedAuthorIds.map(authorId => (
                <ActiveFilterChip
                  key={authorId}
                  label={authorNameMap.get(authorId) ?? 'Unknown author'}
                  onRemove={() =>
                    setFilter(
                      'selectedAuthorIds',
                      selectedAuthorIds.filter(item => item !== authorId)
                    )
                  }
                />
              ))}
              {selectedTags.map(tag => (
                <ActiveFilterChip
                  key={tag}
                  label={tag}
                  onRemove={() =>
                    setFilter(
                      'selectedTags',
                      selectedTags.filter(item => item !== tag)
                    )
                  }
                />
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex min-h-9 items-center px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                data-testid="clear-all-filters"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Loading state while learning paths initialize */}
          {!isLoaded && importedCourses.length > 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : (
            /* Your Courses Section */
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Your Courses</h2>
              {importedCourses.length === 0 ? (
                <div
                  data-testid="imported-courses-empty-state"
                  className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
                  role="region"
                  aria-label="Import courses"
                >
                  <FolderOpen className="size-5 shrink-0" aria-hidden="true" />
                  <span>No imported courses yet.</span>
                  <Button
                    variant="link"
                    size="sm"
                    data-testid="import-first-course-cta"
                    aria-label="Import your first course"
                    onClick={handleOpenBulkImport}
                    className="text-brand-soft-foreground h-auto p-0"
                  >
                    Import a course &rarr;
                  </Button>
                </div>
              ) : finalFilteredCourses.length === 0 ? (
                <div
                  className="text-center py-8 text-muted-foreground"
                  data-testid="filtered-empty-state"
                >
                  <p className="mb-3">No courses match the active filters.</p>
                  <Button
                    variant="brand-outline"
                    size="sm"
                    onClick={clearAllFilters}
                    data-testid="clear-all-filters-empty"
                  >
                    Clear All Filters
                  </Button>
                </div>
              ) : (
                <VirtualizedCoursesList
                  courses={sortedImportedCourses}
                  viewMode={courseViewMode}
                  gridClassName={getGridClassName(
                    courseGridColumns,
                    courseViewMode === 'compact' ? 'compact' : 'grid'
                  )}
                  data-testid={
                    courseViewMode === 'list' ? 'imported-courses-list' : 'imported-courses-grid'
                  }
                  renderItem={course =>
                    courseViewMode === 'list' ? (
                      <ImportedCourseListRow
                        course={course}
                        allTags={allTags}
                        completionPercent={importedCompletionMap.get(course.id) ?? 0}
                        selected={selectedIds.has(course.id)}
                        onToggleSelect={selectionMode ? handleToggleSelect : undefined}
                      />
                    ) : courseViewMode === 'compact' ? (
                      <ImportedCourseCompactCard
                        course={course}
                        allTags={allTags}
                        completionPercent={importedCompletionMap.get(course.id) ?? 0}
                        selected={selectedIds.has(course.id)}
                        onToggleSelect={selectionMode ? handleToggleSelect : undefined}
                      />
                    ) : (
                      <ImportedCourseCard
                        course={course}
                        allTags={allTags}
                        completionPercent={importedCompletionMap.get(course.id) ?? 0}
                        selected={selectedIds.has(course.id)}
                        onToggleSelect={selectionMode ? handleToggleSelect : undefined}
                      />
                    )
                  }
                />
              )}
            </div>
          )}

          {/* CourseFilterSidebar */}
          <CourseFilterSidebar
            open={filterSidebarOpen}
            onOpenChange={setFilterSidebarOpen}
            availableCourses={importedCourses}
            availableAuthors={authors}
            courseIdsInTracks={courseIdsInTracks}
          />
        </>
      )}
    </div>
  )
}
