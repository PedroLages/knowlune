/**
 * E97-S05 Unit 8: Tests for ABS server badge wiring and deep-link focus.
 *
 * @since E97-S05
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/app/hooks/useMissingCredentials', () => ({
  useMissingCredentials: vi.fn(),
}))

vi.mock('@/app/hooks/useDeepLinkFocus', () => ({
  useDeepLinkFocus: vi.fn(),
}))

import { AudiobookshelfServerCard } from '../AudiobookshelfServerCard'
import type { AudiobookshelfServer } from '@/data/types'
import type { CredentialStatus } from '@/lib/credentials/credentialStatus'

function makeServer(overrides: Partial<AudiobookshelfServer> = {}): AudiobookshelfServer {
  return {
    id: 'srv-1',
    name: 'Home Server',
    url: 'http://192.168.1.50:13378',
    libraryIds: [],
    status: 'connected',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderCard(server: AudiobookshelfServer, credentialStatus?: CredentialStatus) {
  return render(
    <MemoryRouter>
      <ul>
        <AudiobookshelfServerCard
          server={server}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onReauthenticate={vi.fn()}
          credentialStatus={credentialStatus}
        />
      </ul>
    </MemoryRouter>
  )
}

describe('AudiobookshelfServerCard — E97-S05 badge wiring', () => {
  it('vault credential status → "Synced via Vault" badge', () => {
    renderCard(makeServer(), 'vault')
    expect(screen.getByRole('img', { name: 'Synced via Vault' })).toBeInTheDocument()
  })

  it('missing credential status → "Not configured" badge', () => {
    renderCard(makeServer(), 'missing')
    expect(screen.getByRole('img', { name: 'Not configured' })).toBeInTheDocument()
  })

  it('no credentialStatus prop → no vault badge shown', () => {
    renderCard(makeServer())
    expect(screen.queryByRole('img', { name: 'Synced via Vault' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Not configured' })).not.toBeInTheDocument()
  })
})
