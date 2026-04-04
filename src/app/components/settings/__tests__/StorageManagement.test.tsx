import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter } from 'react-router'
import type { StorageOverview, StorageCategory } from '@/lib/storageEstimate'

// ---------------------------------------------------------------------------
// Mocks (before imports)
// ---------------------------------------------------------------------------

const mockGetStorageOverview = vi.fn()
const mockGetPerCourseUsage = vi.fn()
const mockClearCourseThumbnail = vi.fn()
const mockDeleteCourseData = vi.fn()

vi.mock('@/lib/storageEstimate', () => ({
  getStorageOverview: (...args: unknown[]) => mockGetStorageOverview(...args),
  getPerCourseUsage: (...args: unknown[]) => mockGetPerCourseUsage(...args),
  clearCourseThumbnail: (...args: unknown[]) => mockClearCourseThumbnail(...args),
  deleteCourseData: (...args: unknown[]) => mockDeleteCourseData(...args),
  STORAGE_CATEGORIES: [
    'courses',
    'notes',
    'flashcards',
    'embeddings',
    'thumbnails',
    'transcripts',
  ] as StorageCategory[],
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastError: {
    saveFailed: vi.fn(),
    importFailed: vi.fn(),
    invalidFile: vi.fn(),
    deleteFailed: vi.fn(),
  },
}))

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>()
  const Passthrough = ({ children }: React.PropsWithChildren) => <div>{children}</div>
  return {
    ...actual,
    BarChart: Passthrough,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    ResponsiveContainer: Passthrough,
  }
})

// ---------------------------------------------------------------------------
// Import (after mocks)
// ---------------------------------------------------------------------------

import { StorageManagement } from '../StorageManagement'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockOverview(overrides: Partial<StorageOverview> = {}): StorageOverview {
  return {
    totalUsage: 500_000_000,
    totalQuota: 2_000_000_000,
    usagePercent: 0.25,
    categories: [
      { category: 'courses', label: 'Courses', sizeBytes: 200_000_000, tableBreakdown: {} },
      { category: 'notes', label: 'Notes', sizeBytes: 100_000_000, tableBreakdown: {} },
      { category: 'flashcards', label: 'Flashcards', sizeBytes: 80_000_000, tableBreakdown: {} },
      {
        category: 'embeddings',
        label: 'AI Search Data',
        sizeBytes: 50_000_000,
        tableBreakdown: {},
      },
      { category: 'thumbnails', label: 'Thumbnails', sizeBytes: 40_000_000, tableBreakdown: {} },
      { category: 'transcripts', label: 'Transcripts', sizeBytes: 30_000_000, tableBreakdown: {} },
    ],
    categorizedTotal: 500_000_000,
    uncategorizedBytes: 0,
    apiAvailable: true,
    ...overrides,
  }
}

function createEmptyOverview(overrides: Partial<StorageOverview> = {}): StorageOverview {
  return {
    totalUsage: 1000,
    totalQuota: 2_000_000_000,
    usagePercent: 0,
    categories: [
      { category: 'courses', label: 'Courses', sizeBytes: 0, tableBreakdown: {} },
      { category: 'notes', label: 'Notes', sizeBytes: 0, tableBreakdown: {} },
      { category: 'flashcards', label: 'Flashcards', sizeBytes: 0, tableBreakdown: {} },
      { category: 'embeddings', label: 'AI Search Data', sizeBytes: 0, tableBreakdown: {} },
      { category: 'thumbnails', label: 'Thumbnails', sizeBytes: 0, tableBreakdown: {} },
      { category: 'transcripts', label: 'Transcripts', sizeBytes: 0, tableBreakdown: {} },
    ],
    categorizedTotal: 0,
    uncategorizedBytes: 0,
    apiAvailable: true,
    ...overrides,
  }
}

function renderComponent() {
  return render(
    <MemoryRouter>
      <StorageManagement />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  // Default implementations for new functions
  mockGetPerCourseUsage.mockResolvedValue([])
  mockClearCourseThumbnail.mockResolvedValue(0)
  mockDeleteCourseData.mockResolvedValue(0)
})

describe('StorageManagement', () => {
  // -------------------------------------------------------------------------
  // AC2: Loading state
  // -------------------------------------------------------------------------

  it('shows skeleton placeholders with aria-busy during load', () => {
    mockGetStorageOverview.mockReturnValue(new Promise(() => {})) // never resolves

    renderComponent()

    const busyRegion = document.querySelector('[aria-busy="true"]')
    expect(busyRegion).toBeInTheDocument()

    // Should show skeleton placeholders (multiple skeleton elements)
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(3) // summary + bar + legend grid
  })

  // -------------------------------------------------------------------------
  // AC1: Normal state — summary, chart, legend
  // -------------------------------------------------------------------------

  it('renders summary line with total usage', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview())

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Total Usage/)).toBeInTheDocument()
    })

    // Should show formatted usage and quota
    expect(screen.getByText(/477 MB/)).toBeInTheDocument() // ~500M formatted
    expect(screen.getByText(/25%/)).toBeInTheDocument()
  })

  it('renders category legend with 6 categories', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview())

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    const legend = screen.getByRole('list')
    expect(within(legend).getByText('Courses')).toBeInTheDocument()
    expect(within(legend).getByText('Notes')).toBeInTheDocument()
    expect(within(legend).getByText('Flashcards')).toBeInTheDocument()
    expect(within(legend).getByText('AI Search Data')).toBeInTheDocument()
    expect(within(legend).getByText('Thumbnails')).toBeInTheDocument()
    expect(within(legend).getByText('Transcripts')).toBeInTheDocument()
  })

  it('renders legend grid with role="list"', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview())

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    const list = screen.getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(6)
  })

  it('renders accessible table for screen readers', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview())

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('table', { name: /storage usage by category/i })).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // AC3: Warning banner (80-94%)
  // -------------------------------------------------------------------------

  it('shows amber warning when usage is between 80-94%', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview({ usagePercent: 0.85 }))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Storage is getting full/)).toBeInTheDocument()
    })

    expect(screen.getByText(/Storage is getting full \(85%\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('dismisses warning and stores in sessionStorage', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview({ usagePercent: 0.85 }))

    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Storage is getting full/)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    // Warning should be gone
    expect(screen.queryByText(/Storage is getting full/)).not.toBeInTheDocument()

    // sessionStorage should have dismiss key
    expect(sessionStorage.getItem('storage-warning-dismissed')).toBe('true')
  })

  it('does not show warning when usage below 80%', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview({ usagePercent: 0.5 }))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Total Usage/)).toBeInTheDocument()
    })

    expect(screen.queryByText(/Storage is getting full/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Storage almost full/)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // AC4: Critical banner (95%+)
  // -------------------------------------------------------------------------

  it('shows red critical banner when usage >= 95%', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview({ usagePercent: 0.97 }))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Storage almost full/)).toBeInTheDocument()
    })

    expect(screen.getByText(/Storage almost full \(97%\)/)).toBeInTheDocument()
    expect(screen.getByText(/View Storage/)).toBeInTheDocument()
  })

  it('critical banner has aria-live assertive', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview({ usagePercent: 0.96 }))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Storage almost full/)).toBeInTheDocument()
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
  })

  it('View Storage button scrolls to data management', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview({ usagePercent: 0.96 }))

    // Create a target element to scroll to
    const target = document.createElement('div')
    target.id = 'data-management'
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)

    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/View Storage/)).toBeInTheDocument()
    })

    await user.click(screen.getByText(/View Storage/))
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })

    document.body.removeChild(target)
  })

  // -------------------------------------------------------------------------
  // AC5: Refresh button
  // -------------------------------------------------------------------------

  it('re-fetches data when refresh button is clicked', async () => {
    const initialOverview = createMockOverview({ usagePercent: 0.25 })
    const refreshedOverview = createMockOverview({ usagePercent: 0.3 })

    mockGetStorageOverview
      .mockResolvedValueOnce(initialOverview)
      .mockResolvedValueOnce(refreshedOverview)

    const user = userEvent.setup()
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/25%/)).toBeInTheDocument()
    })

    const refreshBtn = screen.getByRole('button', { name: /refresh storage estimates/i })
    await user.click(refreshBtn)

    await waitFor(() => {
      expect(screen.getByText(/30%/)).toBeInTheDocument()
    })

    expect(mockGetStorageOverview).toHaveBeenCalledTimes(2)
  })

  // -------------------------------------------------------------------------
  // AC6: API unavailable fallback
  // -------------------------------------------------------------------------

  it('shows fallback message when API is unavailable', async () => {
    mockGetStorageOverview.mockResolvedValue(createMockOverview({ apiAvailable: false }))

    renderComponent()

    await waitFor(() => {
      expect(
        screen.getByText(/Storage estimation is not available in this browser/)
      ).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // AC7: Empty state
  // -------------------------------------------------------------------------

  it('shows empty state when all categories are zero', async () => {
    mockGetStorageOverview.mockResolvedValue(createEmptyOverview())

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/No learning data stored yet/)).toBeInTheDocument()
    })
  })

  it('empty state has Browse Courses link', async () => {
    mockGetStorageOverview.mockResolvedValue(createEmptyOverview())

    renderComponent()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Browse Courses/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: /Browse Courses/i })).toHaveAttribute(
      'href',
      '/courses'
    )
  })

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('shows error state when getStorageOverview throws', async () => {
    mockGetStorageOverview.mockRejectedValue(new Error('Network error'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Unable to estimate storage/)).toBeInTheDocument()
    })

    // Refresh button should be available for retry
    expect(screen.getByRole('button', { name: /refresh storage estimates/i })).toBeInTheDocument()
  })
})
