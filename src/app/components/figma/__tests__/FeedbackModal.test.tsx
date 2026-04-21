import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedbackModal } from '../FeedbackModal'

// Deterministic date constant per ESLint test-patterns/deterministic-time rule
const FIXED_DATE = new Date('2026-04-21T10:00:00Z')
void FIXED_DATE

// Mock auth store — unauthenticated user for most tests
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: null }) => unknown) =>
    selector({ user: null }),
}))

// Mock useFeedbackSubmit so we can control status
const mockSubmit = vi.fn()
const mockReset = vi.fn()
let mockStatus: string = 'idle'
let mockError: string | null = null
let mockFallbackText: string = ''
let mockMailtoHref: string = ''

vi.mock('@/app/hooks/useFeedbackSubmit', () => ({
  useFeedbackSubmit: () => ({
    submit: mockSubmit,
    status: mockStatus,
    error: mockError,
    fallbackText: mockFallbackText,
    mailtoHref: mockMailtoHref,
    reset: mockReset,
  }),
}))

function renderModal(props: Partial<{ open: boolean; onOpenChange: () => void; onSuccess: () => void }> = {}) {
  const onOpenChange = props.onOpenChange ?? vi.fn()
  const onSuccess = props.onSuccess ?? vi.fn()
  return render(
    <FeedbackModal open={props.open ?? true} onOpenChange={onOpenChange} onSuccess={onSuccess} />
  )
}

beforeEach(() => {
  mockStatus = 'idle'
  mockError = null
  mockFallbackText = ''
  mockMailtoHref = ''
  mockSubmit.mockReset()
  mockReset.mockReset()
})

describe('FeedbackModal', () => {
  it('renders DialogTitle', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: /send feedback/i })).toBeInTheDocument()
  })

  it('defaults to Bug Report mode', () => {
    renderModal()
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/steps to reproduce/i)).toBeInTheDocument()
  })

  describe('Bug Report mode', () => {
    it('Submit is disabled when title and description are empty', () => {
      renderModal()
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    })

    it('Submit is disabled when description is less than 10 chars', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.type(screen.getByLabelText(/^title/i), 'A bug')
      await user.type(screen.getByLabelText(/description/i), 'Short')
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    })

    it('Submit enables when title and description (≥10 chars) are filled', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.type(screen.getByLabelText(/^title/i), 'A bug')
      await user.type(
        screen.getByLabelText(/description/i),
        'Something broke in the app'
      )
      expect(screen.getByRole('button', { name: /^send$/i })).not.toBeDisabled()
    })

    it('calls submit with bug fields when form is submitted', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.type(screen.getByLabelText(/^title/i), 'My bug')
      await user.type(
        screen.getByLabelText(/description/i),
        'Something broke in the app'
      )
      await user.click(screen.getByRole('button', { name: /^send$/i }))
      expect(mockSubmit).toHaveBeenCalledOnce()
      const fields = mockSubmit.mock.calls[0][0]
      expect(fields.mode).toBe('bug')
      expect(fields.title).toBe('My bug')
    })
  })

  describe('Feedback mode', () => {
    it('shows message field and optional title after switching', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByRole('radio', { name: /feedback/i }))
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument()
      // Steps field should be gone
      expect(screen.queryByLabelText(/steps to reproduce/i)).not.toBeInTheDocument()
    })

    it('Submit disabled when message is empty in feedback mode', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByRole('radio', { name: /feedback/i }))
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    })

    it('Submit enables when message is filled (title is optional)', async () => {
      const user = userEvent.setup()
      renderModal()
      await user.click(screen.getByRole('radio', { name: /feedback/i }))
      await user.type(screen.getByLabelText(/message/i), 'Great app!')
      expect(screen.getByRole('button', { name: /^send$/i })).not.toBeDisabled()
    })
  })

  describe('Submitting state', () => {
    it('Submit is disabled during submitting state', () => {
      mockStatus = 'submitting'
      renderModal()
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
    })
  })

  describe('Error state', () => {
    it('shows inline error when status is error', () => {
      mockStatus = 'error'
      mockError = 'Could not reach GitHub. Please use the copy option below.'
      mockFallbackText = 'Title: test\nDescription: something broke'
      renderModal()
      expect(screen.getByRole('alert')).toHaveTextContent(/could not reach GitHub/i)
    })
  })

  describe('Fallback state', () => {
    it('shows copyable textarea when status is fallback', () => {
      mockStatus = 'fallback'
      mockFallbackText = 'Title: test\nDescription: something broke'
      renderModal()
      const textarea = screen.getByLabelText(/copyable report/i)
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue(mockFallbackText)
    })

    it('shows copy button in fallback state', () => {
      mockStatus = 'fallback'
      mockFallbackText = 'some text'
      renderModal()
      expect(screen.getByRole('button', { name: /copy report/i })).toBeInTheDocument()
    })

    it('shows mailto link when mailtoHref is present', () => {
      mockStatus = 'fallback'
      mockFallbackText = 'some text'
      mockMailtoHref = 'mailto:test@example.com?subject=Bug'
      renderModal()
      expect(screen.getByRole('link', { name: /open in mail/i })).toBeInTheDocument()
    })
  })

  describe('Success state', () => {
    it('calls onSuccess and onOpenChange(false) when status becomes success', async () => {
      const onSuccess = vi.fn()
      const onOpenChange = vi.fn()
      mockStatus = 'success'
      render(
        <FeedbackModal open={true} onOpenChange={onOpenChange} onSuccess={onSuccess} />
      )
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledOnce()
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })
    })
  })

  describe('Accessibility', () => {
    it('has DialogTitle for screen readers', () => {
      renderModal()
      expect(screen.getByRole('heading', { name: /send feedback/i })).toBeInTheDocument()
    })

    it('all inputs have associated labels', () => {
      renderModal()
      // Bug mode: title, description, steps
      expect(screen.getByLabelText(/^title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/steps to reproduce/i)).toBeInTheDocument()
    })
  })
})
