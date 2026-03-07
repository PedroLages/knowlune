import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/data/courses', () => ({
  allCourses: [
    {
      id: 'c1',
      title: 'Test Course',
      shortTitle: 'Test',
      description: 'desc',
      category: 'Behavior Analysis',
      difficulty: 'Beginner',
      totalLessons: 3,
      totalVideos: 3,
      totalPDFs: 0,
      estimatedHours: 1,
      tags: [],
      modules: [
        {
          id: 'm1',
          title: 'Module 1',
          lessons: [{ id: 'l1', title: 'Lesson 1', type: 'video' }],
        },
      ],
      isSequential: false,
      basePath: '/test',
      instructorId: 'i1',
    },
  ],
}))

vi.mock('@/lib/progress', () => ({
  getCoursesInProgress: () => [],
  getCompletedCourses: () => [],
  getTotalCompletedLessons: () => 0,
  getTotalStudyNotes: () => Promise.resolve(0),
  getCourseCompletionPercent: () => 0,
}))

vi.mock('@/lib/studyLog', () => ({
  getActionsPerDay: () => [],
  getRecentActions: () => [],
}))

// Mock recharts — use importOriginal so chart.tsx namespace access works
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>()
  const Passthrough = ({ children }: React.PropsWithChildren) => <div>{children}</div>
  return {
    ...actual,
    BarChart: Passthrough,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    AreaChart: Passthrough,
    Area: () => null,
    PieChart: Passthrough,
    Pie: () => null,
    Cell: () => null,
    ResponsiveContainer: Passthrough,
  }
})

import Reports from '../Reports'

describe('Reports page', () => {
  it('renders without crashing', () => {
    const { container } = render(<Reports />)
    expect(container).toBeTruthy()
  })

  it('displays the page heading "Reports"', () => {
    render(<Reports />)
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })

  it('renders stat labels', () => {
    render(<Reports />)
    expect(screen.getByText('Lessons Completed')).toBeInTheDocument()
    expect(screen.getByText('Courses In Progress')).toBeInTheDocument()
    expect(screen.getByText('Courses Completed')).toBeInTheDocument()
    expect(screen.getByText('Study Notes')).toBeInTheDocument()
  })

  it('renders chart section headings', () => {
    render(<Reports />)
    expect(screen.getByText('Course Completion')).toBeInTheDocument()
    expect(screen.getByText('Progress by Category')).toBeInTheDocument()
    expect(screen.getByText('Study Activity (Last 30 Days)')).toBeInTheDocument()
  })
})
