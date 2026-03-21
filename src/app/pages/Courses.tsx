import { useState, useEffect, useMemo } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { CourseCard } from '@/app/components/figma/CourseCard'
import { ImportedCourseCard } from '@/app/components/figma/ImportedCourseCard'
import { TopicFilter } from '@/app/components/figma/TopicFilter'
import { StatusFilter } from '@/app/components/figma/StatusFilter'
import { Search, FolderOpen, Loader2 } from 'lucide-react'
import { useCourseStore } from '@/stores/useCourseStore'
import { getCourseCompletionPercent, getProgress } from '@/lib/progress'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { importCourseFromFolder } from '@/lib/courseImport'
import { db } from '@/db'
import { calculateMomentumScore } from '@/lib/momentum'
import { calculateAtRiskStatus } from '@/lib/atRisk'
import { calculateCompletionEstimate } from '@/lib/completionEstimate'
import type { CourseCategory, LearnerCourseStatus } from '@/data/types'
import type { MomentumScore } from '@/lib/momentum'
import type { AtRiskStatus } from '@/lib/atRisk'
import type { CompletionEstimate } from '@/lib/completionEstimate'

const ESTIMATED_MINUTES_PER_LESSON = 15

const tabs: { value: string; label: string; category?: CourseCategory }[] = [
  { value: 'all', label: 'All Courses' },
  { value: 'behavioral-analysis', label: 'Behavioral Analysis', category: 'behavioral-analysis' },
  { value: 'influence-authority', label: 'Influence & Authority', category: 'influence-authority' },
  { value: 'confidence-mastery', label: 'Confidence', category: 'confidence-mastery' },
  { value: 'operative-training', label: 'Operative Training', category: 'operative-training' },
  { value: 'research-library', label: 'Research Library', category: 'research-library' },
]

type SortMode = 'recent' | 'momentum'

export function Courses() {
  const allCourses = useCourseStore(s => s.courses)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<LearnerCourseStatus[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [momentumMap, setMomentumMap] = useState<Map<string, MomentumScore>>(new Map())
  const [atRiskMap, setAtRiskMap] = useState<Map<string, AtRiskStatus>>(new Map())
  const [estimateMap, setEstimateMap] = useState<Map<string, CompletionEstimate>>(new Map())

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const isImporting = useCourseImportStore(state => state.isImporting)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
  const getAllTags = useCourseImportStore(state => state.getAllTags)

  useEffect(() => {
    loadImportedCourses()
  }, [loadImportedCourses])

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
        console.error('[Courses] Failed to load course metrics:', err)
      }
    }

    loadCourseMetrics()

    const handleStudyLogUpdated = () => loadCourseMetrics()
    window.addEventListener('study-log-updated', handleStudyLogUpdated)
    return () => {
      ignore = true
      window.removeEventListener('study-log-updated', handleStudyLogUpdated)
    }
  }, [allCourses])

  const filtered = (() => {
    let courses = allCourses

    const tab = tabs.find(t => t.value === activeTab)
    if (tab?.category) {
      courses = courses.filter(c => c.category === tab.category)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      courses = courses.filter(
        c =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    return courses
  })()

  const sortedCourses = useMemo(() => {
    if (sortMode !== 'momentum') return filtered
    return [...filtered].sort(
      (a, b) => (momentumMap.get(b.id)?.score ?? 0) - (momentumMap.get(a.id)?.score ?? 0)
    )
  }, [filtered, sortMode, momentumMap])

  const allTags = getAllTags()

  const filteredImportedCourses = (() => {
    let courses = importedCourses

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      courses = courses.filter(
        c => c.name.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    if (selectedTopics.length > 0) {
      courses = courses.filter(c => selectedTopics.every(topic => c.tags.includes(topic)))
    }

    if (selectedStatuses.length > 0) {
      courses = courses.filter(c => selectedStatuses.includes(c.status))
    }

    return courses
  })()

  const sortedImportedCourses = [...filteredImportedCourses].sort(
    (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
  )

  async function handleImportCourse() {
    try {
      await importCourseFromFolder()
    } catch {
      // Errors handled by importCourseFromFolder via toasts
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">All Courses</h1>
          <p className="text-muted-foreground">
            Chase Hughes — The Operative Kit ({allCourses.length} courses
            {importedCourses.length > 0 && ` + ${importedCourses.length} imported`})
          </p>
        </div>
        <Button
          variant="brand"
          onClick={handleImportCourse}
          disabled={isImporting}
          className="hover:scale-[1.02] hover:shadow-md rounded-xl transition-all duration-200"
        >
          {isImporting ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <FolderOpen className="size-4 mr-2" />
              Import Course
            </>
          )}
        </Button>
      </div>

      <Card className="bg-card rounded-[24px] border-0 shadow-sm p-6 mb-6">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for courses..."
              aria-label="Search courses"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-0"
            />
          </div>
          <Button
            variant="brand"
            onClick={() => setSearchQuery('')}
            aria-label={searchQuery ? 'Clear search' : 'Search courses'}
          >
            {searchQuery ? 'Clear' : 'Search'}
          </Button>
        </div>
      </Card>

      {importedCourses.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-start">
          <TopicFilter
            availableTags={allTags}
            selectedTags={selectedTopics}
            onSelectedTagsChange={setSelectedTopics}
          />
          <StatusFilter
            selectedStatuses={selectedStatuses}
            onSelectedStatusesChange={setSelectedStatuses}
          />
        </div>
      )}

      {/* Imported Courses Section */}
      {(importedCourses.length > 0 || !searchQuery.trim()) && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Imported Courses</h2>
          {importedCourses.length === 0 ? (
            <Card
              data-testid="imported-courses-empty-state"
              className="bg-card rounded-[24px] border-0 shadow-sm p-8 text-center"
              role="region"
              aria-label="Import courses"
            >
              <FolderOpen
                className="size-12 text-muted-foreground mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-muted-foreground mb-4">Import your first course to get started</p>
              <Button
                variant="brand"
                data-testid="import-first-course-cta"
                onClick={handleImportCourse}
                disabled={isImporting}
                className="rounded-xl"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <FolderOpen className="size-4 mr-2" />
                    Import Your First Course
                  </>
                )}
              </Button>
            </Card>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <TabsList className="flex-wrap flex-1">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
            <SelectTrigger
              data-testid="sort-select"
              aria-label="Sort courses"
              className="w-[180px] rounded-xl"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="momentum">Sort by Momentum</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            {sortedCourses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No courses match your search
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {sortedCourses.map(course => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
                    momentumScore={momentumMap.get(course.id)}
                    atRiskStatus={atRiskMap.get(course.id)}
                    completionEstimate={estimateMap.get(course.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
