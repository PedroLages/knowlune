import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ImportedCourseCard } from '../ImportedCourseCard'
import type { ImportedCourse } from '@/data/types'

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'Test Course',
    importedAt: '2026-02-10T10:00:00Z',
    category: 'general',
    tags: ['test'],
    videoCount: 5,
    pdfCount: 3,
    directoryHandle: {} as FileSystemDirectoryHandle,
    ...overrides,
  }
}

describe('ImportedCourseCard', () => {
  it('renders course title', () => {
    render(<ImportedCourseCard course={makeCourse()} />)
    expect(screen.getByText('Test Course')).toBeInTheDocument()
  })

  it('renders video count', () => {
    render(<ImportedCourseCard course={makeCourse({ videoCount: 12 })} />)
    expect(screen.getByText('12 videos')).toBeInTheDocument()
  })

  it('renders PDF count', () => {
    render(<ImportedCourseCard course={makeCourse({ pdfCount: 7 })} />)
    expect(screen.getByText('7 PDFs')).toBeInTheDocument()
  })

  it('renders import date', () => {
    render(<ImportedCourseCard course={makeCourse({ importedAt: '2026-02-10T10:00:00Z' })} />)
    expect(screen.getByText(/Imported/)).toBeInTheDocument()
  })

  it('has accessible article with aria-label', () => {
    render(
      <ImportedCourseCard course={makeCourse({ name: 'My Course', videoCount: 3, pdfCount: 2 })} />
    )
    const article = screen.getByRole('article')
    expect(article).toHaveAttribute('aria-label', 'My Course — 3 videos, 2 PDFs')
  })

  it('uses rounded-[24px] border radius', () => {
    const { container } = render(<ImportedCourseCard course={makeCourse()} />)
    const card = container.querySelector('.rounded-\\[24px\\]')
    expect(card).toBeInTheDocument()
  })

  it('has elevated hover shadow', () => {
    const { container } = render(<ImportedCourseCard course={makeCourse()} />)
    const shadow = container.querySelector('.hover\\:shadow-2xl')
    expect(shadow).toBeInTheDocument()
  })

  it('has hover scale effect', () => {
    const { container } = render(<ImportedCourseCard course={makeCourse()} />)
    const scaled = container.querySelector('.hover\\:scale-\\[1\\.02\\]')
    expect(scaled).toBeInTheDocument()
  })

  it('has group-hover title color change', () => {
    const { container } = render(<ImportedCourseCard course={makeCourse()} />)
    const title = container.querySelector('.group-hover\\:text-blue-600')
    expect(title).toBeInTheDocument()
  })

  it('is keyboard-focusable with focus ring', () => {
    const { container } = render(<ImportedCourseCard course={makeCourse()} />)
    const focusable = container.querySelector('[tabindex="0"]')
    expect(focusable).toBeInTheDocument()
    expect(focusable).toHaveClass('focus-visible:ring-2')
  })

  it('respects prefers-reduced-motion', () => {
    const { container } = render(<ImportedCourseCard course={makeCourse()} />)
    const motionSafe = container.querySelector('.motion-reduce\\:hover\\:scale-100')
    expect(motionSafe).toBeInTheDocument()
  })

  it('uses singular form for count of 1', () => {
    render(<ImportedCourseCard course={makeCourse({ videoCount: 1, pdfCount: 1 })} />)
    expect(screen.getByText('1 video')).toBeInTheDocument()
    expect(screen.getByText('1 PDF')).toBeInTheDocument()
    const article = screen.getByRole('article')
    expect(article).toHaveAttribute('aria-label', 'Test Course — 1 video, 1 PDF')
  })

  it('marks icons as aria-hidden', () => {
    const { container } = render(<ImportedCourseCard course={makeCourse()} />)
    const hiddenIcons = container.querySelectorAll('[aria-hidden="true"]')
    expect(hiddenIcons.length).toBeGreaterThanOrEqual(2)
  })
})
