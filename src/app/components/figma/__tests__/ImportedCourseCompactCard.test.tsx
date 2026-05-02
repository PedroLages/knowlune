import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ImportedCourseCompactCard } from '../ImportedCourseCompactCard'
import type { ImportedCourse } from '@/data/types'

const mockUpdateCourseStatus = vi.fn()
const mockRemoveImportedCourse = vi.fn().mockResolvedValue(undefined)
const mockNavigate = vi.fn()

let mockImportError: string | null = null

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        updateCourseStatus: mockUpdateCourseStatus,
        removeImportedCourse: mockRemoveImportedCourse,
        thumbnailUrls: {},
      }),
    {
      getState: () => ({ importError: mockImportError }),
    }
  ),
}))

// Force lazy hook to report visible so the img element renders.
vi.mock('@/hooks/useLazyVisible', () => ({
  useLazyVisible: () => [vi.fn(), true],
}))

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'Test Course',
    importedAt: '2026-02-10T10:00:00Z',
    category: 'general',
    tags: ['test', 'sample'],
    status: 'active',
    videoCount: 5,
    pdfCount: 3,
    directoryHandle: {} as FileSystemDirectoryHandle,
    ...overrides,
  }
}

function renderCard(
  overrides: Partial<ImportedCourse> = {},
  extraProps: { readOnly?: boolean; completionPercent?: number } = {}
) {
  return render(
    <MemoryRouter>
      <ImportedCourseCompactCard course={makeCourse(overrides)} {...extraProps} />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockUpdateCourseStatus.mockReset()
  mockNavigate.mockClear()
  mockRemoveImportedCourse.mockClear()
  mockImportError = null
})

describe('ImportedCourseCompactCard — minimal metadata', () => {
  it('renders the course title', () => {
    renderCard({ name: 'My Compact Course' })
    expect(screen.getByTestId('compact-card-title')).toHaveTextContent('My Compact Course')
  })

  it('does NOT render tag badges (compact omits tags)', () => {
    renderCard({ tags: ['react', 'typescript', 'testing'] })
    expect(screen.queryByText('react')).not.toBeInTheDocument()
    expect(screen.queryByText('typescript')).not.toBeInTheDocument()
  })

  it('does NOT render video/pdf metadata text in the card body', () => {
    renderCard({ videoCount: 5, pdfCount: 3 })
    // Compact card should not show "5 videos" or "3 PDFs" anywhere visible.
    expect(screen.queryByText(/videos?$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/PDFs?$/i)).not.toBeInTheDocument()
  })

  it('applies line-clamp-2 to the title', () => {
    renderCard()
    expect(screen.getByTestId('compact-card-title').className).toContain('line-clamp-2')
  })

  it('card root has min-h-[44px] / min-w-[44px] for touch targets', () => {
    renderCard()
    const card = screen.getByTestId('imported-course-compact-card')
    expect(card.className).toContain('min-h-[44px]')
    expect(card.className).toContain('min-w-[44px]')
  })
})

describe('ImportedCourseCompactCard — progress overlay', () => {
  it('does NOT render progress bar when progress is 0', () => {
    renderCard({}, { completionPercent: 0 })
    expect(screen.queryByTestId('compact-progress-bar')).not.toBeInTheDocument()
  })

  it('renders progress bar with correct width when progress > 0', () => {
    renderCard({}, { completionPercent: 73 })
    const bar = screen.getByTestId('compact-progress-bar')
    expect(bar).toBeInTheDocument()
    expect(bar.style.width).toBe('73%')
  })

  it('progress bar uses bg-brand token (no hardcoded colors)', () => {
    renderCard({}, { completionPercent: 50 })
    expect(screen.getByTestId('compact-progress-bar').className).toContain('bg-brand')
  })

  it('progress bar is replaced by completion overlay when progress = 100', () => {
    renderCard({}, { completionPercent: 100 })
    expect(screen.queryByTestId('compact-progress-bar')).not.toBeInTheDocument()
    expect(screen.getByTestId('compact-completion-overlay')).toBeInTheDocument()
  })
})

describe('ImportedCourseCompactCard — hover-revealed actions', () => {
  it('overflow trigger exists in DOM but parent is opacity-0 by default', () => {
    renderCard()
    const wrapper = screen.getByTestId('compact-overflow-wrapper')
    expect(wrapper.className).toContain('opacity-0')
    expect(wrapper.className).toContain('group-hover:opacity-100')
    expect(wrapper.className).toContain('[@media(hover:none)]:opacity-100')
  })

  it('status badge wrapper uses hover-reveal classes', () => {
    renderCard()
    const wrapper = screen.getByTestId('compact-status-wrapper')
    expect(wrapper.className).toContain('opacity-0')
    expect(wrapper.className).toContain('group-hover:opacity-100')
    expect(wrapper.className).toContain('[@media(hover:none)]:opacity-100')
  })

  it('motion-safe transition prefix is used (respects prefers-reduced-motion)', () => {
    renderCard()
    expect(screen.getByTestId('compact-overflow-wrapper').className).toContain(
      'motion-safe:transition-opacity'
    )
  })
})

describe('ImportedCourseCompactCard — navigation', () => {
  it('clicking the card navigates to course detail', () => {
    renderCard({ id: 'abc-123' })
    fireEvent.click(screen.getByTestId('imported-course-compact-card'))
    expect(mockNavigate).toHaveBeenCalledWith('/courses/abc-123/overview')
  })

  it('Enter key navigates to course detail', () => {
    renderCard({ id: 'abc-123' })
    const card = screen.getByTestId('imported-course-compact-card')
    card.focus()
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith('/courses/abc-123/overview')
  })
})

describe('ImportedCourseCompactCard — long-press', () => {
  it('long-press > 500ms opens the overflow menu', () => {
    vi.useFakeTimers()
    try {
      renderCard()
      const card = screen.getByTestId('imported-course-compact-card')
      fireEvent.pointerDown(card, { pointerType: 'touch', clientX: 50, clientY: 50, button: 0 })
      act(() => {
        vi.advanceTimersByTime(600)
      })
      // After timer fires, the menu open state should be true; verify by
      // looking for one of the menu items in the rendered DOM.
      expect(screen.getByTestId('compact-delete-menu-item')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('pointer movement > 10px cancels the long-press timer', () => {
    vi.useFakeTimers()
    try {
      renderCard()
      const card = screen.getByTestId('imported-course-compact-card')
      // jsdom does not always propagate clientX/clientY through fireEvent.pointer*.
      // Build the event explicitly so the handler observes the move delta.
      act(() => {
        const downEvent = new Event('pointerdown', { bubbles: true })
        Object.assign(downEvent, { pointerType: 'touch', clientX: 50, clientY: 50, button: 0 })
        card.dispatchEvent(downEvent)
      })
      act(() => {
        const moveEvent = new Event('pointermove', { bubbles: true })
        Object.assign(moveEvent, { pointerType: 'touch', clientX: 80, clientY: 50 })
        card.dispatchEvent(moveEvent)
      })
      act(() => {
        vi.advanceTimersByTime(600)
      })
      // Menu items should NOT be in the DOM (menu remained closed).
      expect(screen.queryByTestId('compact-delete-menu-item')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('short tap (pointerup before 500ms) does NOT open the menu', () => {
    vi.useFakeTimers()
    try {
      renderCard()
      const card = screen.getByTestId('imported-course-compact-card')
      fireEvent.pointerDown(card, { pointerType: 'touch', clientX: 50, clientY: 50, button: 0 })
      act(() => {
        vi.advanceTimersByTime(200)
      })
      fireEvent.pointerUp(card, { pointerType: 'touch', clientX: 50, clientY: 50 })
      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(screen.queryByTestId('compact-delete-menu-item')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('long-press swallows the subsequent click so navigation does not fire', () => {
    vi.useFakeTimers()
    try {
      renderCard({ id: 'abc-123' })
      const card = screen.getByTestId('imported-course-compact-card')
      fireEvent.pointerDown(card, { pointerType: 'touch', clientX: 50, clientY: 50, button: 0 })
      act(() => {
        vi.advanceTimersByTime(600)
      })
      fireEvent.click(card)
      expect(mockNavigate).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('ImportedCourseCompactCard — accessibility', () => {
  it('card has an accessible name including the course title', () => {
    renderCard({ name: 'Special Course' })
    const card = screen.getByTestId('imported-course-compact-card')
    expect(card).toHaveAttribute('aria-label', expect.stringContaining('Special Course'))
  })

  it('progress bar has role and aria-valuenow', () => {
    renderCard({}, { completionPercent: 42 })
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '42')
  })
})
