/**
 * Tests for CredentialSyncStatusBadge — E97-S05 Unit 3.
 *
 * @since E97-S05
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CredentialSyncStatusBadge } from '../CredentialSyncStatusBadge'

describe('CredentialSyncStatusBadge — status rendering', () => {
  it('vault status: renders Cloud icon and "Synced via Vault" label', () => {
    render(<CredentialSyncStatusBadge status="vault" />)
    expect(screen.getByRole('img', { name: 'Synced via Vault' })).toBeInTheDocument()
    expect(screen.getByText('Synced via Vault')).toBeInTheDocument()
  })

  it('local status: renders Smartphone icon and "Local only" label', () => {
    render(<CredentialSyncStatusBadge status="local" />)
    expect(screen.getByRole('img', { name: 'Local only' })).toBeInTheDocument()
    expect(screen.getByText('Local only')).toBeInTheDocument()
  })

  it('missing status: renders CircleDashed icon and "Not configured" label', () => {
    render(<CredentialSyncStatusBadge status="missing" />)
    expect(screen.getByRole('img', { name: 'Not configured' })).toBeInTheDocument()
    expect(screen.getByText('Not configured')).toBeInTheDocument()
  })

  it('anonymous status: renders CheckCircle2 icon and "No credential needed" label', () => {
    render(<CredentialSyncStatusBadge status="anonymous" />)
    expect(screen.getByRole('img', { name: 'No credential needed' })).toBeInTheDocument()
    expect(screen.getByText('No credential needed')).toBeInTheDocument()
  })
})

describe('CredentialSyncStatusBadge — showLabel:false', () => {
  it('renders icon only but preserves accessible name', () => {
    render(<CredentialSyncStatusBadge status="vault" showLabel={false} />)
    expect(screen.getByRole('img', { name: 'Synced via Vault' })).toBeInTheDocument()
    expect(screen.queryByText('Synced via Vault')).not.toBeInTheDocument()
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
