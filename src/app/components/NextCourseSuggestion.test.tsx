import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { NextCourseSuggestion } from './NextCourseSuggestion'
import type { ImportedCourse } from '@/data/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-2',
    name: 'Advanced Influence',
    importedAt: '2025-06-01T00:00:00.000Z',
    category: 'influence-authority',
    tags: ['influence', 'authority'],
    status: 'active',
    videoCount: 8,
    pdfCount: 2,
    directoryHandle: null,
    ...overrides,
  }
}

const defaultProps = () => ({
  suggestedCourse: makeCourse(),
  sharedTags: ['influence', 'authority'],
  onDismiss: vi.fn(),
})

function renderComponent(propsOverrides: Partial<Parameters<typeof NextCourseSuggestion>[0]> = {}) {
  const props = { ...defaultProps(), ...propsOverrides }
  return { ...render(
    <MemoryRouter>
      <NextCourseSuggestion {...props} />
    </MemoryRouter>
  ), props }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NextCourseSuggestion', () => {
  it('renders suggestion card with course name', () => {
    renderComponent()

    expect(screen.getByText('Advanced Influence')).toBeDefined()
    expect(screen.getByText('Start Learning')).toBeDefined()
  })

  it('navigates to the suggested course when "Start Learning" is clicked', () => {
    const onDismiss = vi.fn()
    renderComponent({
      suggestedCourse: makeCourse({ id: 'adv-influence' }),
      onDismiss,
    })

    fireEvent.click(screen.getByText('Start Learning'))

    expect(mockNavigate).toHaveBeenCalledWith('/courses/adv-influence')
    expect(onDismiss).toHaveBeenCalled()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    renderComponent({ onDismiss })

    const dismissBtn = screen.getByLabelText('Dismiss suggestion')
    fireEvent.click(dismissBtn)

    expect(onDismiss).toHaveBeenCalled()
  })

  it('shows shared tags on the suggestion card', () => {
    renderComponent({ sharedTags: ['influence', 'authority'] })

    expect(screen.getByText('influence')).toBeDefined()
    expect(screen.getByText('authority')).toBeDefined()
  })

  it('renders with no tags when sharedTags is empty', () => {
    renderComponent({ sharedTags: [] })

    expect(screen.getByTestId('next-course-suggestion')).toBeDefined()
    expect(screen.queryByLabelText('Shared topics')).toBeNull()
  })

  it('renders thumbnail when thumbnailUrl is provided', () => {
    renderComponent({ thumbnailUrl: 'https://example.com/thumb.jpg' })

    const card = screen.getByTestId('next-course-suggestion')
    const img = card.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe('https://example.com/thumb.jpg')
  })

  it('renders fallback icon when thumbnailUrl is not provided', () => {
    renderComponent({ thumbnailUrl: undefined })

    // No <img> should exist — fallback BookOpen icon is shown
    const card = screen.getByTestId('next-course-suggestion')
    expect(card.querySelector('img')).toBeNull()
  })
})
