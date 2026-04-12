/**
 * Unit tests for BookReviewEditor component — E113-S01
 *
 * Covers AC-3 (markdown review text), AC-4 (auto-save on blur, markdown preview toggle),
 * and AC-5 (delete review from UI) at the component level.
 *
 * The store is mocked to isolate component behaviour.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BookReviewEditor } from '../BookReviewEditor'

// ── Store mock ─────────────────────────────────────────────────────────────
const mockSetRating = vi.fn()
const mockSetReviewText = vi.fn()
const mockDeleteReview = vi.fn()
const mockLoadReviews = vi.fn()
let mockReview: { rating: number; reviewText?: string } | undefined = undefined

vi.mock('@/stores/useBookReviewStore', () => ({
  useBookReviewStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      isLoaded: true,
      reviews: [],
      loadReviews: mockLoadReviews,
      getReviewForBook: () => mockReview,
      setRating: mockSetRating,
      setReviewText: mockSetReviewText,
      deleteReview: mockDeleteReview,
    }
    return selector ? selector(state) : state
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockReview = undefined
})

describe('BookReviewEditor — AC-3 & AC-4: review text and markdown preview', () => {
  it('shows textarea for review text when book is rated', () => {
    mockReview = { rating: 4 }
    render(<BookReviewEditor bookId="book-1" />)
    expect(screen.getByTestId('review-textarea')).toBeInTheDocument()
  })

  it('does not show review text area when book is unrated', () => {
    mockReview = undefined
    render(<BookReviewEditor bookId="book-1" />)
    expect(screen.queryByTestId('review-textarea')).not.toBeInTheDocument()
  })

  it('AC-4: saves review text when Save button is clicked', async () => {
    mockReview = { rating: 4 }
    render(<BookReviewEditor bookId="book-1" />)

    const textarea = screen.getByTestId('review-textarea')
    fireEvent.focus(textarea)
    fireEvent.change(textarea, { target: { value: 'Great **book**!' } })
    fireEvent.click(screen.getByText('Save review'))

    expect(mockSetReviewText).toHaveBeenCalledWith('book-1', 'Great **book**!')
  })

  it('AC-4: shows preview toggle when review text exists', () => {
    mockReview = { rating: 4, reviewText: 'A good read' }
    render(<BookReviewEditor bookId="book-1" />)
    // Preview button (Eye icon button) should be visible
    expect(screen.getByLabelText('Preview review')).toBeInTheDocument()
  })

  it('AC-4: toggles to markdown preview when preview button clicked', async () => {
    mockReview = { rating: 4, reviewText: '**Bold** text' }
    render(<BookReviewEditor bookId="book-1" />)

    fireEvent.click(screen.getByLabelText('Preview review'))

    await waitFor(() => {
      expect(screen.getByTestId('review-preview')).toBeInTheDocument()
    })
    // Bold text should be rendered as <strong>
    const preview = screen.getByTestId('review-preview')
    expect(preview.innerHTML).toContain('<strong>Bold</strong>')
  })

  it('AC-4: toggles back from preview to edit mode', async () => {
    mockReview = { rating: 4, reviewText: 'Some text' }
    render(<BookReviewEditor bookId="book-1" />)

    fireEvent.click(screen.getByLabelText('Preview review'))
    await waitFor(() => expect(screen.getByTestId('review-preview')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Edit review'))
    await waitFor(() => expect(screen.queryByTestId('review-preview')).not.toBeInTheDocument())
  })
})

describe('BookReviewEditor — AC-5: delete review', () => {
  it('shows delete button when review text exists', () => {
    mockReview = { rating: 4, reviewText: 'Worth reading' }
    render(<BookReviewEditor bookId="book-1" />)
    expect(screen.getByLabelText('Delete review')).toBeInTheDocument()
  })

  it('calls deleteReview when delete button clicked', () => {
    mockReview = { rating: 4, reviewText: 'Worth reading' }
    render(<BookReviewEditor bookId="book-1" />)

    fireEvent.click(screen.getByLabelText('Delete review'))

    expect(mockDeleteReview).toHaveBeenCalledWith('book-1')
  })

  it('does not show delete button when no review text', () => {
    mockReview = { rating: 4 }
    render(<BookReviewEditor bookId="book-1" />)
    expect(screen.queryByLabelText('Delete review')).not.toBeInTheDocument()
  })
})

describe('BookReviewEditor — markdown rendering safety (AC-3)', () => {
  it('escapes HTML entities in preview to prevent XSS', async () => {
    mockReview = { rating: 4, reviewText: '<script>alert(1)</script>' }
    render(<BookReviewEditor bookId="book-1" />)

    fireEvent.click(screen.getByLabelText('Preview review'))

    await waitFor(() => {
      const preview = screen.getByTestId('review-preview')
      expect(preview.innerHTML).not.toContain('<script>')
      expect(preview.innerHTML).toContain('&lt;script&gt;')
    })
  })
})
