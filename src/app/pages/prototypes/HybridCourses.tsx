import { useState } from 'react'
import { HybridLayout } from './layouts/HybridLayout'
import { HybridCourseCard } from './components/HybridCourseCard'
import { ComparisonToggle } from './components/ComparisonToggle'
import { Search } from 'lucide-react'
import { useCourseStore } from '@/stores/useCourseStore'
import { getCourseCompletionPercent } from '@/lib/progress'
import type { CourseCategory } from '@/data/types'

const tabs: { value: string; label: string; category?: CourseCategory }[] = [
  { value: 'all', label: 'All Courses' },
  { value: 'behavioral-analysis', label: 'Behavioral Analysis', category: 'behavioral-analysis' },
  { value: 'influence-authority', label: 'Influence & Authority', category: 'influence-authority' },
  { value: 'confidence-mastery', label: 'Confidence', category: 'confidence-mastery' },
  { value: 'operative-training', label: 'Operative Training', category: 'operative-training' },
  { value: 'research-library', label: 'Research Library', category: 'research-library' },
]

export function HybridCourses() {
  const allCourses = useCourseStore(s => s.courses)
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCourses = allCourses.filter(course => {
    const matchesCategory =
      activeTab === 'all' || course.category === tabs.find(t => t.value === activeTab)?.category

    const matchesSearch =
      searchQuery === '' ||
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesCategory && matchesSearch
  })

  return (
    <HybridLayout>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Courses</h1>
        {allCourses.length > 0 && (
          <p className="text-sm text-muted-foreground">{allCourses.length} courses</p>
        )}
      </div>

      {/* Search card */}
      <div className="bg-white rounded-xl border border-neutral-100 p-4 mb-8">
        <div className="flex items-center gap-3">
          <Search className="size-4 text-neutral-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-neutral-400"
          />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-8">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeTab === tab.value
                ? 'bg-blue-600 text-white font-medium'
                : 'bg-white text-neutral-500 border border-neutral-100 hover:border-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Course grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-4 gap-5">
          {filteredCourses.map(course => (
            <HybridCourseCard
              key={course.id}
              course={course}
              completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-400 text-center py-12">
          No courses found matching your criteria.
        </p>
      )}

      {/* Comparison Toggle */}
      <ComparisonToggle />
    </HybridLayout>
  )
}
