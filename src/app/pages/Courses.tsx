import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { CourseCard } from '@/app/components/figma/CourseCard'
import { ImportedCourseCard } from '@/app/components/figma/ImportedCourseCard'
import { Search, FolderOpen, Loader2 } from 'lucide-react'
import { allCourses } from '@/data/courses'
import { getCourseCompletionPercent } from '@/lib/progress'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { importCourseFromFolder } from '@/lib/courseImport'
import type { CourseCategory } from '@/data/types'

const tabs: { value: string; label: string; category?: CourseCategory }[] = [
  { value: 'all', label: 'All Courses' },
  { value: 'behavioral-analysis', label: 'Behavioral Analysis', category: 'behavioral-analysis' },
  { value: 'influence-authority', label: 'Influence & Authority', category: 'influence-authority' },
  { value: 'confidence-mastery', label: 'Confidence', category: 'confidence-mastery' },
  { value: 'operative-training', label: 'Operative Training', category: 'operative-training' },
  { value: 'research-library', label: 'Research Library', category: 'research-library' },
]

export function Courses() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const isImporting = useCourseImportStore(state => state.isImporting)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)

  useEffect(() => {
    loadImportedCourses()
  }, [loadImportedCourses])

  const filtered = useMemo(() => {
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
  }, [activeTab, searchQuery])

  const filteredImportedCourses = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return importedCourses.filter(
        c => c.name.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return importedCourses
  }, [importedCourses, searchQuery])

  const sortedImportedCourses = useMemo(
    () =>
      [...filteredImportedCourses].sort(
        (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
      ),
    [filteredImportedCourses]
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
          <h1 className="text-3xl font-bold mb-2">All Courses</h1>
          <p className="text-muted-foreground">
            Chase Hughes — The Operative Kit ({allCourses.length} courses
            {importedCourses.length > 0 && ` + ${importedCourses.length} imported`})
          </p>
        </div>
        <Button
          onClick={handleImportCourse}
          disabled={isImporting}
          className="bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] hover:shadow-md rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <FolderOpen className="h-4 w-4 mr-2" />
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
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setSearchQuery('')}
            aria-label={searchQuery ? 'Clear search' : 'Search courses'}
          >
            {searchQuery ? 'Clear' : 'Search'}
          </Button>
        </div>
      </Card>

      {/* Imported Courses Section */}
      {(importedCourses.length > 0 || !searchQuery.trim()) && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Imported Courses</h2>
          {importedCourses.length === 0 ? (
            <Card
              className="bg-card rounded-[24px] border-0 shadow-sm p-8 text-center"
              role="region"
              aria-label="Import courses"
            >
              <FolderOpen
                className="h-12 w-12 text-muted-foreground mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-muted-foreground mb-4">Import your first course to get started</p>
              <Button
                onClick={handleImportCourse}
                disabled={isImporting}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Import Your First Course
                  </>
                )}
              </Button>
            </Card>
          ) : filteredImportedCourses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No imported courses match your search
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {sortedImportedCourses.map(course => (
                <ImportedCourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="flex-wrap">
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No courses match your search
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filtered.map(course => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
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
