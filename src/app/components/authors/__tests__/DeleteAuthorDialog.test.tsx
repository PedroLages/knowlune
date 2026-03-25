import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteAuthorDialog } from '../DeleteAuthorDialog'
import { useAuthorStore } from '@/stores/useAuthorStore'
import type { Author } from '@/data/types'

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

const mockDeleteAuthor = vi.fn()

const sampleAuthor: Author = {
  id: 'author-1',
  name: 'Jane Smith',
  title: 'Software Engineer',
  bio: 'A bio paragraph.',
  shortBio: 'Short bio',
  specialties: ['React'],
  yearsExperience: 10,
  avatar: 'https://example.com/avatar.jpg',
  socialLinks: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuthorStore).mockReturnValue({ deleteAuthor: mockDeleteAuthor } as never)
})

describe('DeleteAuthorDialog', () => {
  it('renders warning text with author name', () => {
    render(<DeleteAuthorDialog open={true} onOpenChange={vi.fn()} author={sampleAuthor} />)

    expect(screen.getByText(/jane smith/i)).toBeInTheDocument()
    expect(screen.getByText(/permanently remove/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('calls deleteAuthor on confirm', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onDeleted = vi.fn()
    mockDeleteAuthor.mockResolvedValue(undefined)

    render(
      <DeleteAuthorDialog
        open={true}
        onOpenChange={onOpenChange}
        author={sampleAuthor}
        onDeleted={onDeleted}
      />
    )

    await user.click(screen.getByTestId('delete-author-confirm'))

    await waitFor(() => {
      expect(mockDeleteAuthor).toHaveBeenCalledWith('author-1')
    })
  })

  it('has a cancel button', () => {
    render(<DeleteAuthorDialog open={true} onOpenChange={vi.fn()} author={sampleAuthor} />)

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls onDeleted callback after successful delete', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    mockDeleteAuthor.mockResolvedValue(undefined)

    render(
      <DeleteAuthorDialog
        open={true}
        onOpenChange={vi.fn()}
        author={sampleAuthor}
        onDeleted={onDeleted}
      />
    )

    await user.click(screen.getByTestId('delete-author-confirm'))

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalled()
    })
  })
})
