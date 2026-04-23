import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AIConsentDeclinedBanner } from '../AIConsentDeclinedBanner'

// Mock react-router Link
vi.mock('react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

describe('AIConsentDeclinedBanner', () => {
  it('renders the provider display name for openai', () => {
    render(<AIConsentDeclinedBanner providerId="openai" />)
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument()
  })

  it('renders the provider display name for anthropic', () => {
    render(<AIConsentDeclinedBanner providerId="anthropic" />)
    expect(screen.getByText(/Anthropic/)).toBeInTheDocument()
  })

  it('falls back gracefully for unknown provider', () => {
    render(<AIConsentDeclinedBanner providerId="some-future-provider" />)
    // Should render the fallback display name without crashing
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/AI Provider/)).toBeInTheDocument()
  })

  it('has role="status" for accessibility', () => {
    render(<AIConsentDeclinedBanner providerId="openai" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('contains a link to Settings Privacy', () => {
    render(<AIConsentDeclinedBanner providerId="openai" />)
    const link = screen.getByRole('link', { name: /settings.*privacy/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/settings/privacy')
  })

  it('link is keyboard accessible (no tabIndex=-1)', () => {
    render(<AIConsentDeclinedBanner providerId="openai" />)
    const link = screen.getByRole('link')
    expect(link).not.toHaveAttribute('tabIndex', '-1')
  })
})
