import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProviderReconsentModal } from '../ProviderReconsentModal'

// Minimal mock for radix Dialog — jsdom doesn't support focus trapping out of the box,
// but we test that content renders when open=true.
vi.mock('@/app/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/app/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
    ...rest
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    'aria-label'?: string
    [key: string]: unknown
  }) => (
    <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} {...rest}>
      {children}
    </button>
  ),
}))

const defaultProps = {
  open: true,
  providerId: 'openai',
  purpose: 'ai_tutor' as const,
  onAccept: vi.fn().mockResolvedValue(undefined),
  onDecline: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  defaultProps.onAccept = vi.fn().mockResolvedValue(undefined)
  defaultProps.onDecline = vi.fn()
})

describe('ProviderReconsentModal', () => {
  it('renders provider name when open', () => {
    render(<ProviderReconsentModal {...defaultProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Multiple elements may contain "OpenAI" (e.g. aria-label + content) — just check at least one exists
    expect(screen.getAllByText(/OpenAI/).length).toBeGreaterThan(0)
  })

  it('renders data categories', () => {
    render(<ProviderReconsentModal {...defaultProps} />)
    expect(screen.getByText(/Prompt text/)).toBeInTheDocument()
  })

  it('renders privacy notice link', () => {
    render(<ProviderReconsentModal {...defaultProps} />)
    expect(screen.getByRole('link', { name: /privacy notice/i })).toBeInTheDocument()
  })

  it('renders nothing when open=false', () => {
    render(<ProviderReconsentModal {...defaultProps} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onAccept when Accept button is clicked', async () => {
    render(<ProviderReconsentModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    await waitFor(() => expect(defaultProps.onAccept).toHaveBeenCalledTimes(1))
  })

  it('calls onDecline when Decline button is clicked', () => {
    render(<ProviderReconsentModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /decline/i }))
    expect(defaultProps.onDecline).toHaveBeenCalledTimes(1)
  })

  it('shows notice-update section when noticeUpdatePending=true', () => {
    render(
      <ProviderReconsentModal
        {...defaultProps}
        noticeUpdatePending
        noticeVersion="2026-04-23.2"
      />,
    )
    expect(screen.getByText(/Privacy notice updated/i)).toBeInTheDocument()
    expect(screen.getByText(/2026-04-23.2/)).toBeInTheDocument()
  })

  it('does NOT show notice-update section when noticeUpdatePending=false (default)', () => {
    render(<ProviderReconsentModal {...defaultProps} />)
    expect(screen.queryByText(/Privacy notice updated/i)).not.toBeInTheDocument()
  })

  it('falls back gracefully for unknown providerId without crashing', () => {
    render(<ProviderReconsentModal {...defaultProps} providerId="some-future-provider" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Falls back to the 'unknown' meta entry — should still render a display name somewhere
    expect(screen.getAllByText(/AI Provider/).length).toBeGreaterThan(0)
  })

  it('has DialogTitle (accessibility)', () => {
    render(<ProviderReconsentModal {...defaultProps} />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })
})
