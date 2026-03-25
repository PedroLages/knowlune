import { useState } from 'react'
import { SwissLayout } from './layouts/SwissLayout'
import { SwissCourseCard } from './components/SwissCourseCard'
import { ComparisonToggle } from './components/ComparisonToggle'
import { Search } from 'lucide-react'
import { useCourseStore } from '@/stores/useCourseStore'
import { getCourseCompletionPercent } from '@/lib/progress'
import type { CourseCategory } from '@/data/types'

const tabs: { value: string; label: string; category?: CourseCategory }[] = [
  { value: 'all', label: 'All' },
  {
    value: 'behavioral-analysis',
    label: 'Behavioral Analysis',
    category: 'behavioral-analysis',
  },
  {
    value: 'influence-authority',
    label: 'Influence & Authority',
    category: 'influence-authority',
  },
  {
    value: 'confidence-mastery',
    label: 'Confidence',
    category: 'confidence-mastery',
  },
  {
    value: 'operative-training',
    label: 'Operative Training',
    category: 'operative-training',
  },
  {
    value: 'research-library',
    label: 'Research Library',
    category: 'research-library',
  },
]

export function SwissCourses() {
  const allCourses = useCourseStore(s => s.courses)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const filtered = (() => {
    let courses = allCourses

    // Filter by tab category
    const tab = tabs.find(t => t.value === activeTab)
    if (tab?.category) {
      courses = courses.filter(c => c.category === tab.category)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      courses = courses.filter(
        c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
      )
    }

    return courses
  })()

  return (
    <SwissLayout>
      {/* Page title */}
      <h1 className="text-[48px] font-bold tracking-tight leading-none mb-2">Courses</h1>
      <p className="text-sm text-neutral-500 mb-2">{allCourses.length} courses</p>
      <hr className="border-t border-black/10 mb-8" />

      {/* Search bar */}
      <div className="flex items-center gap-3 border border-neutral-200 bg-white px-4 py-3 mb-8 hover:border-neutral-900 transition-colors">
        <Search className="size-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="bg-transparent outline-none flex-1 text-sm placeholder:text-neutral-300"
        />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0 border-b border-neutral-200 mb-8">
        {tabs.map(tab => {
          const isActive = activeTab === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`
                px-4 py-3 text-sm transition-colors border-b-2
                ${
                  isActive
                    ? 'font-bold text-black border-[#DC2626]'
                    : 'text-neutral-400 border-transparent hover:text-black'
                }
              `}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Course grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-4 gap-6">
          {filtered.map(course => (
            <SwissCourseCard
              key={course.id}
              course={course}
              completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-400 py-12 text-center">No courses match your search</p>
      )}

      {/* Comparison Toggle */}
      <ComparisonToggle />
    </SwissLayout>
  )
}
