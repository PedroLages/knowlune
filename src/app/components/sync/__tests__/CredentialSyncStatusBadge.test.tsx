/**
 * Tests for CredentialSyncStatusBadge — E97-S05 Unit 3.
 *
 * @since E97-S05
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CredentialSyncStatusBadge } from '../CredentialSyncStatusBadge'

describe('CredentialSyncStatusBadge — status rendering (showLabel=true)', () => {
  // R1-L3: when showLabel=true, role="img" is redundant (visible text label
  // already carries the accessible name). The aria-label remains for
  // assistive-tech fallback. Tests look up the element by its accessible
  // name via aria-label (getByLabelText) rather than getByRole('img').
  it('vault status: renders Cloud icon and "Synced via Vault" label (no role=img)', () => {
    render(<CredentialSyncStatusBadge status="vault" />)
    expect(screen.getByLabelText('Synced via Vault')).toBeInTheDocument()
    expect(screen.getByText('Synced via Vault')).toBeInTheDocument()
    // Wrapper must NOT have role="img" when the label is visible.
    expect(screen.getByTestId('credential-status-badge-vault')).not.toHaveAttribute('role')
  })

  it('local status: renders Smartphone icon and "Local only" label', () => {
    render(<CredentialSyncStatusBadge status="local" />)
    expect(screen.getByLabelText('Local only')).toBeInTheDocument()
    expect(screen.getByText('Local only')).toBeInTheDocument()
  })

  it('missing status: renders CircleDashed icon and "Not configured" label', () => {
    render(<CredentialSyncStatusBadge status="missing" />)
    expect(screen.getByLabelText('Not configured')).toBeInTheDocument()
    expect(screen.getByText('Not configured')).toBeInTheDocument()
  })

  it('anonymous status: renders CheckCircle2 icon and "No credential needed" label', () => {
    render(<CredentialSyncStatusBadge status="anonymous" />)
    expect(screen.getByLabelText('No credential needed')).toBeInTheDocument()
    expect(screen.getByText('No credential needed')).toBeInTheDocument()
  })
})

describe('CredentialSyncStatusBadge — showLabel:false (icon-only variant)', () => {
  it('renders icon only, preserves accessible name, and retains role="img" wrapper', () => {
    render(<CredentialSyncStatusBadge status="vault" showLabel={false} />)
    expect(screen.getByRole('img', { name: 'Synced via Vault' })).toBeInTheDocument()
    expect(screen.queryByText('Synced via Vault')).not.toBeInTheDocument()
    // Icon-only variant MUST retain role="img" so AT announces the badge
    // as a named image rather than an unlabeled generic.
    expect(screen.getByTestId('credential-status-badge-vault')).toHaveAttribute('role', 'img')
  })
})

describe('CredentialSyncStatusBadge — test IDs', () => {
  it('each status has a distinct testid', () => {
    const { rerender } = render(<CredentialSyncStatusBadge status="vault" />)
    expect(screen.getByTestId('credential-status-badge-vault')).toBeInTheDocument()

    rerender(<CredentialSyncStatusBadge status="local" />)
    expect(screen.getByTestId('credential-status-badge-local')).toBeInTheDocument()

    rerender(<CredentialSyncStatusBadge status="missing" />)
    expect(screen.getByTestId('credential-status-badge-missing')).toBeInTheDocument()

    rerender(<CredentialSyncStatusBadge status="anonymous" />)
    expect(screen.getByTestId('credential-status-badge-anonymous')).toBeInTheDocument()
  })
})
