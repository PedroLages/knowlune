import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthorFormDialog } from '../AuthorFormDialog'
import { useAuthorStore } from '@/stores/useAuthorStore'
import type { ImportedAuthor } from '@/data/types'

// Mock the store
vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockAddAuthor = vi.fn()
const mockUpdateAuthor = vi.fn()

const defaultStoreReturn = {
  addAuthor: mockAddAuthor,
  updateAuthor: mockUpdateAuthor,
}

const sampleAuthor: ImportedAuthor = {
  id: 'author-1',
  name: 'Jane Smith',
  title: 'Software Engineer',
  bio: 'A bio paragraph.',
  shortBio: 'Short bio',
  specialties: ['React', 'TypeScript'],
  yearsExperience: 10,
  photoUrl: 'https://example.com/avatar.jpg',
  socialLinks: { website: 'https://example.com' },
  featuredQuote: 'Keep learning.',
  courseIds: [],
  isPreseeded: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuthorStore).mockReturnValue(defaultStoreReturn as never)
})

describe('AuthorFormDialog', () => {
  it('renders form fields when open in create mode', () => {
    render(<AuthorFormDialog open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Create Author' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Bio')).toBeInTheDocument()
    expect(screen.getByLabelText('Short Bio')).toBeInTheDocument()
    expect(screen.getByLabelText('Specialties')).toBeInTheDocument()
    expect(screen.getByLabelText('Years of Experience')).toBeInTheDocument()
    expect(screen.getByLabelText('Avatar URL')).toBeInTheDocument()
  })

  it('shows edit title when author is provided', () => {
    render(<AuthorFormDialog open={true} onOpenChange={vi.fn()} author={sampleAuthor} />)

    expect(screen.getByText('Edit Author')).toBeInTheDocument()
  })

  it('validates that name is required', async () => {
    const user = userEvent.setup()
    render(<AuthorFormDialog open={true} onOpenChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /create author/i }))

    expect(await screen.findByText('Author name is required')).toBeInTheDocument()
    expect(mockAddAuthor).not.toHaveBeenCalled()
  })

  it('submits correctly with valid data in create mode', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    mockAddAuthor.mockResolvedValue({ id: 'new-id', name: 'Test Author' })

    render(<AuthorFormDialog open={true} onOpenChange={onOpenChange} />)

    await user.type(screen.getByLabelText('Name *'), 'Test Author')
    await user.type(screen.getByLabelText('Title'), 'Expert')
    await user.click(screen.getByRole('button', { name: /create author/i }))

    await waitFor(() => {
      expect(mockAddAuthor).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Author',
          title: 'Expert',
        })
      )
    })
  })

  it('pre-populates fields in edit mode', () => {
    render(<AuthorFormDialog open={true} onOpenChange={vi.fn()} author={sampleAuthor} />)

    expect(screen.getByLabelText('Name *')).toHaveValue('Jane Smith')
    expect(screen.getByLabelText('Title')).toHaveValue('Software Engineer')
  })

  it('clears validation errors when correcting input', async () => {
    const user = userEvent.setup()
    render(<AuthorFormDialog open={true} onOpenChange={vi.fn()} />)

    // Trigger validation
    await user.click(screen.getByRole('button', { name: /create author/i }))
    expect(await screen.findByText('Author name is required')).toBeInTheDocument()

    // Start typing to clear error
    await user.type(screen.getByLabelText('Name *'), 'A')
    expect(screen.queryByText('Author name is required')).not.toBeInTheDocument()
  })
})
