import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/app/components/ui/card'
import { VirtualizedCoursesList } from '@/app/components/courses/VirtualizedCoursesList'
import { CourseTimelineView } from '@/app/components/courses/CourseTimelineView'
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
import { FolderOpen, BookOpen, Youtube, Trash2, X, Loader2, ListFilter } from 'lucide-react'
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
import { GridColumnControl } from '@/app/components/courses/GridColumnControl'
import { ControlBarSection } from '@/app/components/courses/ControlBarSection'
import { getGridClassName } from '@/app/components/courses/gridClassName'
import { useEngagementPrefsStore } from '@/stores/useEngagementPrefsStore'
import { Separator } from '@/app/components/ui/separator'
import { buildGroupedCurriculum, type ChapterGroup } from '@/lib/curriculumGrouping'
import { useCourseFilterStore } from '@/stores/useCourseFilterStore'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { CourseFilterSidebar } from '@/app/components/courses/CourseFilterSidebar'

import type { ImportedVideo, ImportedPdf, YouTubeCourseChapter, VideoProgress } from '@/data/types'
import type { MomentumScore } from '@/lib/momentum'

type SortMode = 'recent' | 'momentum'

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

  // Timeline view data
  const [timelineProgressMap, setTimelineProgressMap] = useState<Map<string, VideoProgress>>(new Map())
  const [lessonGroupsByCourse, setLessonGroupsByCourse] = useState<Map<string, ChapterGroup[]>>(new Map())
  const [timelineIsLoading, setTimelineIsLoading] = useState(false)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)

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
  const isAnyFilterActive = useCourseFilterStore(s => s.isAnyFilterActive)

  // Learning path store — for track membership computation
  const learningPathEntries = useLearningPathStore(s => s.entries)
  const isLoaded = useLearningPathStore(s => s.isLoaded)
  const loadPaths = useLearningPathStore(s => s.loadPaths)

  // Lazy-load stores on mount
  useLazyStore(loadImportedCourses)
  useLazyStore(loadPaths)

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
      setTimelineRefreshKey(k => k + 1)
    }
    window.addEventListener('study-log-updated', handleStudyLogUpdated)
    return () => {
      ignore = true
      window.removeEventListener('study-log-updated', handleStudyLogUpdated)
    }
  }, [importedCourses])

  // Keep legacy allTags for ImportedCourseCard (imported-only tags)
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

  // Filter chain: track → source → status → tags (AND composition)
  const filteredImportedCourses = useMemo(() => {
    // Apply track visibility filter (R1)
    let result = showTrackCourses
      ? importedCourses
      : importedCourses.filter(c => !courseIdsInTracks.has(c.id))

    // Apply source filter (R4)
    if (sourceFilter === 'youtube') {
      result = result.filter(c => c.source === 'youtube')
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      result = result.filter(c => selectedStatuses.includes(c.status))
    }

    // Apply tag filter — OR semantics within tags, AND with other filters (R6, R8)
    if (selectedTags.length > 0) {
      const tagSet = new Set(selectedTags.map(t => t.toLowerCase()))
      result = result.filter(c => c.tags.some(t => tagSet.has(t.toLowerCase())))
    }

    return result
  }, [importedCourses, courseIdsInTracks, showTrackCourses, sourceFilter, selectedStatuses, selectedTags])

  // AC1-AC4 (E1C-S05): Sort imported courses by momentum or importedAt
  const sortedImportedCourses = useMemo(() => {
    return [...filteredImportedCourses].sort((a, b) => {
      if (sortMode === 'momentum') {
        const scoreA = momentumMap.get(a.id)?.score ?? 0
        const scoreB = momentumMap.get(b.id)?.score ?? 0
        // AC1: Higher momentum first
        if (scoreA !== scoreB) return scoreB - scoreA
        // AC4: Zero-momentum (and equal-score) tiebreaker: importedAt newest first
        return new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
      }
      // AC3: "Most Recent" sorts by importedAt (newest first)
      return new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    })
  }, [filteredImportedCourses, sortMode, momentumMap])

  // Fetch per-course lesson data for the timeline view (positioned after sortedImportedCourses)
  useEffect(() => {
    if (courseViewMode !== 'timeline' || sortedImportedCourses.length === 0) return

    let ignore = false
    setTimelineIsLoading(true)

    const courseIds = sortedImportedCourses.map(c => c.id)

    Promise.all([
      db.importedVideos
        .where('courseId')
        .anyOf(courseIds)
        .sortBy('order'),
      db.importedPdfs
        .where('courseId')
        .anyOf(courseIds)
        .toArray(),
      db.youtubeChapters
        .where('courseId')
        .anyOf(courseIds)
        .sortBy('order')
        .catch(() => [] as YouTubeCourseChapter[]),
      db.progress.toArray(),
    ])
      .then(([allVideos, allPdfs, allChapters, allProgress]) => {
        if (ignore) return

        const videosByCourse = new Map<string, ImportedVideo[]>()
        for (const v of allVideos) {
          const arr = videosByCourse.get(v.courseId) ?? []
          arr.push(v)
          videosByCourse.set(v.courseId, arr)
        }

        const pdfsByCourse = new Map<string, ImportedPdf[]>()
        for (const p of allPdfs) {
          const arr = pdfsByCourse.get(p.courseId) ?? []
          arr.push(p)
          pdfsByCourse.set(p.courseId, arr)
        }

        const chaptersByCourse = new Map<string, YouTubeCourseChapter[]>()
        for (const ch of allChapters) {
          const arr = chaptersByCourse.get(ch.courseId) ?? []
          arr.push(ch)
          chaptersByCourse.set(ch.courseId, arr)
        }

        const progMap = new Map<string, VideoProgress>()
        for (const r of allProgress) {
          if (r.videoId) progMap.set(r.videoId, r)
        }

        const groupsByCourse = new Map<string, ChapterGroup[]>()
        for (const courseId of courseIds) {
          const course = importedCourses.find(c => c.id === courseId)
          const prefYoutube =
            (course?.source ?? 'local') === 'youtube' && (chaptersByCourse.get(courseId)?.length ?? 0) > 0
          groupsByCourse.set(
            courseId,
            buildGroupedCurriculum({
              videos: videosByCourse.get(courseId) ?? [],
              pdfs: pdfsByCourse.get(courseId) ?? [],
              chapters: chaptersByCourse.get(courseId) ?? [],
              preferChapterGrouping: prefYoutube,
            })
          )
        }

        setTimelineProgressMap(progMap)
        setLessonGroupsByCourse(groupsByCourse)
        setTimelineIsLoading(false)
      })
      .catch((error) => {
        if (!ignore) {
          setTimelineIsLoading(false)
        }
        // silent-catch-ok: timeline data failure is non-fatal — courses still load without progress/momentum
        console.warn('[Courses] Failed to load course timeline data:', error)
      })

    return () => {
      ignore = true
    }
  }, [courseViewMode, sortedImportedCourses, importedCourses, timelineRefreshKey])

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

  const filterSummaryLabel = selectedStatuses
    .map(s => statusLabelMap.get(s) ?? s)
    .join(', ')

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
          {/* Selection mode action bar replaces the control bar */}
          {selectionMode ? (
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
              data-testid="selection-action-bar"
            >
              <span className="text-sm font-medium" data-testid="selected-count">
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
                    Deleting...
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
              >
                <X className="size-4 mr-1" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          ) : (
            /* Grouped control bar: Filter, Sort, Select, View sections */
            <div
              className="flex w-full min-w-0 flex-nowrap items-center gap-x-4 overflow-x-auto overflow-y-visible pb-1 scroll-smooth sm:gap-x-6"
              data-testid="courses-control-bar"
            >
              {importedCourses.length > 0 && (
                <ControlBarSection label="Filter" showDivider={false}>
                  <StatusFilter
                    selectedStatuses={selectedStatuses}
                    onSelectedStatusesChange={statuses => setFilter('selectedStatuses', statuses)}
                  />
                </ControlBarSection>
              )}
              <ControlBarSection label="Filters">
                <button
                  type="button"
                  onClick={() => setFilterSidebarOpen(true)}
                  className="relative inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-full border border-input bg-background text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  data-testid="open-filter-sidebar-btn"
                  aria-label={isAnyFilterActive() ? 'Active filters — open filter sidebar' : 'Open filter sidebar'}
                >
                  <ListFilter className="size-4" aria-hidden="true" />
                  Filters
                  {isAnyFilterActive() && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand" aria-hidden="true" />
                  )}
                </button>
              </ControlBarSection>
              <ControlBarSection label="Sort">
                <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
                  <SelectTrigger
                    data-testid="sort-select"
                    aria-label="Sort courses"
                    className="w-full sm:w-[180px] rounded-xl min-h-[44px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="momentum">Sort by Momentum</SelectItem>
                  </SelectContent>
                </Select>
              </ControlBarSection>
              <ControlBarSection label="Select">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectionMode(true)}
                  data-testid="enter-selection-mode-btn"
                  className="min-h-[44px]"
                >
                  Select
                </Button>
              </ControlBarSection>
              <ControlBarSection label="View">
                <div className="flex items-center gap-3">
                  <ViewModeToggle
                    value={courseViewMode}
                    onChange={mode => setEngagementPref('courseViewMode', mode)}
                  />
                  {/* E99-S02: grid column control. Visible only in grid view. */}
                  {courseViewMode === 'grid' && (
                    <>
                      <Separator orientation="vertical" className="!h-6" />
                      <GridColumnControl
                        value={courseGridColumns}
                        onChange={cols => setEngagementPref('courseGridColumns', cols)}
                      />
                    </>
                  )}
                </div>
              </ControlBarSection>
            </div>
          )}

          {/* Filter summary chip — visible when any status filter is active */}
          {selectedStatuses.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1 text-xs text-muted-foreground">
                Filtered by: {filterSummaryLabel}
              </span>
              <button
                type="button"
                onClick={() => setFilter('selectedStatuses', [])}
                className="inline-flex min-h-11 items-center px-2 text-xs text-muted-foreground hover:text-foreground underline"
                data-testid="clear-all-filters"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Info message: track courses are hidden (R2) */}
          {!showTrackCourses && courseIdsInTracks.size > 0 && (
            <div
              className="mb-4 flex items-center gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-soft-foreground"
              data-testid="track-courses-info"
              role="status"
            >
              <span>
                {courseIdsInTracks.size}{' '}
                {courseIdsInTracks.size === 1 ? 'course is' : 'courses are'} organized in learning tracks.
              </span>
              <button
                type="button"
                onClick={() => {
                  setFilterSidebarOpen(true)
                  setFilter('showTrackCourses', true)
                }}
                className="font-bold underline hover:no-underline whitespace-nowrap"
                data-testid="show-track-courses-link"
              >
                Show &rarr;
              </button>
            </div>
          )}

          {/* Sidebar filter chips (Unit 4 — R10) */}
          {isAnyFilterActive() && (
            <div
              className="mb-4 flex items-center gap-2 flex-wrap overflow-x-auto"
              data-testid="filter-chips-row"
            >
              {sourceFilter === 'youtube' && (
                <span className="inline-flex items-center gap-1 bg-brand-soft text-brand-soft-foreground rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap">
                  YouTube
                  <button
                    type="button"
                    onClick={() => setFilter('source', 'all')}
                    className="hover:text-destructive transition-colors"
                    aria-label="Remove YouTube filter"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {showTrackCourses && (
                <span className="inline-flex items-center gap-1 bg-brand-soft text-brand-soft-foreground rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap">
                  Including tracks
                  <button
                    type="button"
                    onClick={() => setFilter('showTrackCourses', false)}
                    className="hover:text-destructive transition-colors"
                    aria-label="Remove track filter"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {selectedTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-brand-soft text-brand-soft-foreground rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() =>
                      setFilter(
                        'selectedTags',
                        selectedTags.filter(t => t !== tag)
                      )
                    }
                    className="hover:text-destructive transition-colors"
                    aria-label={`Remove ${tag} filter`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
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
              ) : filteredImportedCourses.length === 0 ? (
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
                    Clear all filters
                  </Button>
                </div>
              ) : courseViewMode === 'timeline' ? (
              <CourseTimelineView
                courses={sortedImportedCourses}
                completionMap={importedCompletionMap}
                momentumMap={momentumMap}
                progressMap={timelineProgressMap}
                lessonGroupsByCourse={lessonGroupsByCourse}
                isLoading={timelineIsLoading}
                allTags={allTags}
              />
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
                      momentumScore={momentumMap.get(course.id)}
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
          availableCourses={filteredImportedCourses}
        />
      </>
    )}
  </div>
  )
}
