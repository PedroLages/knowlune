import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/app/components/ui/card'
import { VirtualizedGrid } from '@/app/components/VirtualizedGrid'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { ImportedCourseCard } from '@/app/components/figma/ImportedCourseCard'
import { StatusFilter } from '@/app/components/figma/StatusFilter'
import { Search, FolderOpen, BookOpen, Youtube } from 'lucide-react'
import { getImportedCourseCompletionPercent } from '@/lib/progress'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useLazyStore } from '@/hooks/useLazyStore'
import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { BulkImportDialog } from '@/app/components/figma/BulkImportDialog'
import { YouTubeImportDialog } from '@/app/components/figma/YouTubeImportDialog'
import { db } from '@/db'
import { calculateMomentumScore } from '@/lib/momentum'

import type { LearnerCourseStatus } from '@/data/types'
import type { MomentumScore } from '@/lib/momentum'

type SortMode = 'recent' | 'momentum'

export function Courses() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search filtering by 250ms so filtering doesn't run on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250)
    return () => clearTimeout(timer)
  }, [searchQuery])
  const [selectedStatuses, setSelectedStatuses] = useState<LearnerCourseStatus[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [youtubeImportOpen, setYoutubeImportOpen] = useState(false)
  const [momentumMap, setMomentumMap] = useState<Map<string, MomentumScore>>(new Map())
  const [importedCompletionMap, setImportedCompletionMap] = useState<Map<string, number>>(new Map())

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
  const getAllTags = useCourseImportStore(state => state.getAllTags)

  // Lazy-load imported courses on mount (deferred — not critical for initial app load)
  useLazyStore(loadImportedCourses)

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

    const handleStudyLogUpdated = () => loadCourseMetrics()
    window.addEventListener('study-log-updated', handleStudyLogUpdated)
    return () => {
      ignore = true
      window.removeEventListener('study-log-updated', handleStudyLogUpdated)
    }
  }, [importedCourses])

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

    if (selectedStatuses.length > 0) {
      courses = courses.filter(c => selectedStatuses.includes(c.status))
    }

    return courses
  })()

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
        {totalCourses > 0 && (
          <Button
            variant="brand"
            onClick={handleOpenBulkImport}
            className="hover:scale-[1.02] hover:shadow-md rounded-xl transition-[transform,box-shadow] duration-200"
            data-testid="import-course-btn"
          >
            <FolderOpen className="size-4 mr-2" />
            Import Course
          </Button>
        )}
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
          <Card className="bg-card rounded-2xl border-0 shadow-sm p-6 mb-6">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  type="text"
                  name="course-search"
                  autoComplete="off"
                  placeholder="Search for courses…"
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

          {/* AC5 (E1C-S05): Sort dropdown alongside filters */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-start">
            {importedCourses.length > 0 && (
              <StatusFilter
                selectedStatuses={selectedStatuses}
                onSelectedStatusesChange={setSelectedStatuses}
              />
            )}
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
                    onClick={handleOpenBulkImport}
                    className="text-brand-soft-foreground h-auto p-0"
                  >
                    Import a course &rarr;
                  </Button>
                </div>
              ) : filteredImportedCourses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No imported courses match your{' '}
                  {selectedStatuses.length > 0 ? 'filters' : 'search'}
                </div>
              ) : (
                <VirtualizedGrid
                  items={sortedImportedCourses}
                  getItemKey={course => course.id}
                  renderItem={course => (
                    <ImportedCourseCard
                      course={course}
                      allTags={allTags}
                      completionPercent={importedCompletionMap.get(course.id) ?? 0}
                      momentumScore={momentumMap.get(course.id)}
                    />
                  )}
                  data-testid="imported-courses-grid"
                  gridClassName="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]"
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
