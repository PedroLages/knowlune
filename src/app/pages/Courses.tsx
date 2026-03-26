import { useState, useEffect, useMemo, useRef } from 'react'
import { Card } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/app/components/ui/collapsible'
import { CourseCard, categoryLabels } from '@/app/components/figma/CourseCard'
import { ImportedCourseCard } from '@/app/components/figma/ImportedCourseCard'
import { TopicFilter } from '@/app/components/figma/TopicFilter'
import { StatusFilter } from '@/app/components/figma/StatusFilter'
import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'
import { Search, FolderOpen, BookOpen, ChevronDown } from 'lucide-react'
import { useCourseStore } from '@/stores/useCourseStore'
import { getCourseCompletionPercent, getProgress } from '@/lib/progress'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { db } from '@/db'
import { calculateMomentumScore } from '@/lib/momentum'
import { calculateAtRiskStatus } from '@/lib/atRisk'
import { EmptyState } from '@/app/components/EmptyState'
import { calculateCompletionEstimate } from '@/lib/completionEstimate'
import type { LearnerCourseStatus } from '@/data/types'
import type { MomentumScore } from '@/lib/momentum'
import type { AtRiskStatus } from '@/lib/atRisk'
import type { CompletionEstimate } from '@/lib/completionEstimate'

const ESTIMATED_MINUTES_PER_LESSON = 15
const COLLAPSE_KEY = 'knowlune:sample-courses-collapsed'

type SortMode = 'recent' | 'momentum'

export function Courses() {
  const allCourses = useCourseStore(s => s.courses)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search filtering by 250ms so filtering doesn't run on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250)
    return () => clearTimeout(timer)
  }, [searchQuery])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<LearnerCourseStatus[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [momentumMap, setMomentumMap] = useState<Map<string, MomentumScore>>(new Map())
  const [atRiskMap, setAtRiskMap] = useState<Map<string, AtRiskStatus>>(new Map())
  const [estimateMap, setEstimateMap] = useState<Map<string, CompletionEstimate>>(new Map())

  // Collapse state for sample courses section — persisted to localStorage
  const [sampleCollapsed, setSampleCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY)
      if (stored !== null) return stored === 'true'
    } catch {
      // silent-catch-ok: localStorage unavailable in restricted contexts — silent fallback is correct
    }
    return false // Will be re-evaluated in useEffect when importedCourses loads
  })

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
  const getAllTags = useCourseImportStore(state => state.getAllTags)

  useEffect(() => {
    loadImportedCourses()
  }, [loadImportedCourses])

  // Auto-collapse when imported courses first appear; auto-expand when all imports removed.
  // useRef prevents re-triggering the initial collapse on subsequent imports during the session.
  const hasAutoCollapsed = useRef(false)
  useEffect(() => {
    try {
      if (importedCourses.length > 0 && !hasAutoCollapsed.current) {
        const stored = localStorage.getItem(COLLAPSE_KEY)
        if (stored === null) {
          hasAutoCollapsed.current = true
          setSampleCollapsed(true)
          localStorage.setItem(COLLAPSE_KEY, 'true')
        }
      } else if (importedCourses.length === 0 && sampleCollapsed && hasAutoCollapsed.current) {
        // All imports removed — restore sample courses visibility (only undo auto-collapse, not manual)
        setSampleCollapsed(false)
        localStorage.removeItem(COLLAPSE_KEY)
        hasAutoCollapsed.current = false
      }
    } catch {
      // silent-catch-ok: localStorage unavailable — session still works without persistence
    }
  }, [importedCourses.length, sampleCollapsed])

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
        const atRiskMap = new Map<string, AtRiskStatus>()
        const estimateMap = new Map<string, CompletionEstimate>()

        for (const course of allCourses) {
          const courseSessions = sessionsByCourse.get(course.id) ?? []
          const completionPercent = getCourseCompletionPercent(course.id, course.totalLessons)

          // Calculate momentum
          const momentum = calculateMomentumScore({
            courseId: course.id,
            totalLessons: course.totalLessons,
            completionPercent,
            sessions: courseSessions,
          })
          momentumMap.set(course.id, momentum)

          // Calculate at-risk status
          const atRisk = calculateAtRiskStatus(courseSessions, momentum)
          atRiskMap.set(course.id, atRisk)

          // Calculate completion estimate
          const progress = getProgress(course.id)
          const remainingLessons = course.totalLessons - progress.completedLessons.length
          const remainingMinutes = remainingLessons * ESTIMATED_MINUTES_PER_LESSON

          const estimate = calculateCompletionEstimate(courseSessions, remainingMinutes)
          estimateMap.set(course.id, estimate)
        }

        // Calculate momentum for imported courses (AC: E07-S01)
        for (const course of importedCourses) {
          const courseSessions = sessionsByCourse.get(course.id) ?? []

          // For imported courses: use videoCount as totalLessons, default completion to 0
          // Momentum driven primarily by study sessions (recency + frequency)
          const momentum = calculateMomentumScore({
            courseId: course.id,
            totalLessons: course.videoCount,
            completionPercent: 0, // TODO: Calculate from contentProgress when implemented
            sessions: courseSessions,
          })
          momentumMap.set(course.id, momentum)
        }

        setMomentumMap(momentumMap)
        setAtRiskMap(atRiskMap)
        setEstimateMap(estimateMap)
      } catch (err) {
        // silent-catch-ok: metrics failure is non-fatal — courses still load without momentum/risk indicators
        console.warn('[Courses] Failed to load course metrics:', err)
      }
    }

    loadCourseMetrics()

    const handleStudyLogUpdated = () => loadCourseMetrics()
    window.addEventListener('study-log-updated', handleStudyLogUpdated)
    return () => {
      ignore = true
      window.removeEventListener('study-log-updated', handleStudyLogUpdated)
    }
  }, [allCourses, importedCourses])

  // Extract unique categories dynamically from actual course data
  const availableCategories = useMemo(
    () => [...new Set(allCourses.map(c => c.category))],
    [allCourses]
  )

  const filtered = useMemo(() => {
    let courses = allCourses

    if (selectedCategory && selectedCategory !== 'all') {
      courses = courses.filter(c => c.category === selectedCategory)
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      courses = courses.filter(
        c =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    // AC3: Apply topic filter to pre-seeded courses too
    if (selectedTopics.length > 0) {
      courses = courses.filter(c =>
        selectedTopics.every(topic => c.tags.some(t => t.toLowerCase() === topic))
      )
    }

    return courses
  }, [allCourses, selectedCategory, debouncedSearch, selectedTopics])

  const sortedCourses = useMemo(() => {
    if (sortMode !== 'momentum') return filtered
    return [...filtered].sort(
      (a, b) => (momentumMap.get(b.id)?.score ?? 0) - (momentumMap.get(a.id)?.score ?? 0)
    )
  }, [filtered, sortMode, momentumMap])

  // AC1+AC2: Merge tags from both pre-seeded and imported courses,
  // deduplicate, and sort by frequency (most courses first)
  const { mergedTags, tagCounts } = useMemo(() => {
    const counts = new Map<string, number>()

    // Count tags from pre-seeded courses
    for (const course of allCourses) {
      for (const tag of course.tags) {
        const normalized = tag.trim().toLowerCase()
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
      }
    }

    // Count tags from imported courses (AI-generated tags)
    for (const course of importedCourses) {
      for (const tag of course.tags) {
        const normalized = tag.trim().toLowerCase()
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
      }
    }

    // Sort by frequency descending, then alphabetically for ties
    const sorted = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag)

    return { mergedTags: sorted, tagCounts: counts }
  }, [allCourses, importedCourses])

  // Keep legacy allTags for ImportedCourseCard (imported-only tags)
  const allTags = useMemo(() => getAllTags(), [getAllTags])

  const filteredImportedCourses = (() => {
    let courses = importedCourses

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      courses = courses.filter(
        c => c.name.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    if (selectedTopics.length > 0) {
      courses = courses.filter(c =>
        selectedTopics.every(topic => c.tags.some(t => t.toLowerCase() === topic))
      )
    }

    if (selectedStatuses.length > 0) {
      courses = courses.filter(c => selectedStatuses.includes(c.status))
    }

    return courses
  })()

  // AC6 (E23-S05): Auto-expand pre-seeded section when a filter/search matches
  // pre-seeded courses while the section is collapsed, so users don't miss results.
  useEffect(() => {
    if (!sampleCollapsed) return
    const hasActiveFilter =
      selectedTopics.length > 0 ||
      debouncedSearch.trim() !== '' ||
      (selectedCategory !== 'all' && selectedCategory !== '')
    if (hasActiveFilter && filtered.length > 0) {
      setSampleCollapsed(false)
      try {
        localStorage.removeItem(COLLAPSE_KEY)
      } catch {
        // silent-catch-ok: localStorage unavailable — auto-expand still works for the session
      }
    }
  }, [sampleCollapsed, selectedTopics, debouncedSearch, selectedCategory, filtered.length])

  const sortedImportedCourses = [...filteredImportedCourses].sort(
    (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
  )

  function handleOpenWizard() {
    setWizardOpen(true)
  }

  function handleCollapseToggle(open: boolean) {
    const collapsed = !open
    setSampleCollapsed(collapsed)
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed))
    } catch {
      // silent-catch-ok: localStorage unavailable — collapse state still works for the session
    }
  }

  const totalCourses = allCourses.length + importedCourses.length

  return (
    <div>
      <div data-testid="courses-header" className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">All Courses</h1>
          {totalCourses > 0 && (
            <p className="text-muted-foreground">
              {totalCourses} {totalCourses === 1 ? 'course' : 'courses'}
            </p>
          )}
        </div>
        <Button
          variant="brand"
          onClick={handleOpenWizard}
          className="hover:scale-[1.02] hover:shadow-md rounded-xl transition-[transform,box-shadow] duration-200"
        >
          <FolderOpen className="size-4 mr-2" />
          Import Course
        </Button>
      </div>

      <ImportWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />

      {totalCourses === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Import a course folder to get started"
          actionLabel="Import Course"
          onAction={handleOpenWizard}
          data-testid="courses-empty-state"
        />
      ) : (
        <>
          <Card className="bg-card rounded-[24px] border-0 shadow-sm p-6 mb-6">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  type="text"
                  name="course-search"
                  autoComplete="off"
                  placeholder="Search for courses\u2026"
                  aria-label="Search courses"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted border-0"
                />
              </div>
              <Button
                variant="brand"
                onClick={() => {
                  setSearchQuery('')
                  setDebouncedSearch('')
                }}
                aria-label={searchQuery ? 'Clear search' : 'Search courses'}
              >
                {searchQuery ? 'Clear' : 'Search'}
              </Button>
            </div>
          </Card>

          {/* AC1: Show unified topic filter with merged tags from both course types */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-start">
            <TopicFilter
              availableTags={mergedTags}
              selectedTags={selectedTopics}
              onSelectedTagsChange={setSelectedTopics}
              tagCounts={tagCounts}
            />
            {importedCourses.length > 0 && (
              <StatusFilter
                selectedStatuses={selectedStatuses}
                onSelectedStatusesChange={setSelectedStatuses}
              />
            )}
          </div>

          {/* Imported Courses Section */}
          {(importedCourses.length > 0 || !searchQuery.trim()) && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Imported Courses</h2>
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
                    onClick={handleOpenWizard}
                    className="text-brand-soft-foreground h-auto p-0"
                  >
                    Import a course &rarr;
                  </Button>
                </div>
              ) : filteredImportedCourses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No imported courses match your{' '}
                  {selectedTopics.length > 0 || selectedStatuses.length > 0 ? 'filters' : 'search'}
                </div>
              ) : (
                <div
                  data-testid="imported-courses-grid"
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                >
                  {sortedImportedCourses.map(course => (
                    <ImportedCourseCard
                      key={course.id}
                      course={course}
                      allTags={allTags}
                      momentumScore={momentumMap.get(course.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sample Courses Section */}
          {allCourses.length > 0 && (
            <Collapsible
              open={!sampleCollapsed}
              onOpenChange={handleCollapseToggle}
              data-testid="sample-courses-section"
              role="region"
              aria-labelledby="sample-courses-heading"
              className="mb-6 rounded-[24px] border border-border/50 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h2
                  id="sample-courses-heading"
                  className="text-lg font-semibold text-muted-foreground"
                >
                  Sample Courses ({allCourses.length})
                </h2>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="sample-courses-toggle"
                    aria-label={
                      sampleCollapsed ? 'Expand sample courses' : 'Collapse sample courses'
                    }
                    className="min-h-[44px] min-w-[44px] p-2"
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${
                        !sampleCollapsed ? 'rotate-180' : ''
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent
                className={`transition-opacity duration-200 motion-reduce:transition-none ${
                  importedCourses.length > 0 ? 'opacity-60 hover:opacity-100' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                  <div className="overflow-x-auto flex-1 min-w-0">
                    <ToggleGroup
                      type="single"
                      value={selectedCategory}
                      onValueChange={v => setSelectedCategory(v || 'all')}
                      aria-label="Filter by category"
                      className="flex flex-nowrap gap-1.5 sm:gap-2"
                    >
                      {[
                        { value: 'all', label: 'All Courses' },
                        ...availableCategories.map(cat => ({
                          value: cat,
                          label: categoryLabels[cat] ?? cat,
                        })),
                      ].map((chip, i) => (
                        <ToggleGroupItem
                          key={chip.value}
                          value={chip.value}
                          className={`h-auto rounded-full! border px-3 sm:px-4 py-3 sm:py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:hover:bg-brand-hover data-[state=on]:border-transparent data-[state=off]:bg-card data-[state=off]:text-muted-foreground data-[state=off]:hover:bg-accent data-[state=off]:hover:text-foreground data-[state=off]:border-border cursor-pointer shadow-none${i === 0 ? ' mr-1' : ''}`}
                        >
                          {chip.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                  <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
                    <SelectTrigger
                      data-testid="sort-select"
                      aria-label="Sort courses"
                      className="w-full sm:w-[180px] rounded-xl"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Most Recent</SelectItem>
                      <SelectItem value="momentum">Sort by Momentum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sortedCourses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No courses match your search
                  </div>
                ) : (
                  <div
                    data-testid="sample-courses-grid"
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                  >
                    {sortedCourses.map(course => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        completionPercent={getCourseCompletionPercent(
                          course.id,
                          course.totalLessons
                        )}
                        momentumScore={momentumMap.get(course.id)}
                        atRiskStatus={atRiskMap.get(course.id)}
                        completionEstimate={estimateMap.get(course.id)}
                      />
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  )
}
