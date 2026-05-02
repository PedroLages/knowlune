/**
 * E97-S05 Unit 7: Tests for OPDS catalog badge wiring and deep-link focus.
 *
 * @since E97-S05
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockStatusByKey, mockMissingCredentials } = vi.hoisted(() => ({
  mockStatusByKey: vi.fn(() => ({})),
  mockMissingCredentials: vi.fn(),
}))

mockMissingCredentials.mockReturnValue({ missing: [], statusByKey: mockStatusByKey(), loading: false })

vi.mock('@/app/hooks/useMissingCredentials', () => ({
  useMissingCredentials: () => mockMissingCredentials(),
}))

vi.mock('@/app/hooks/useDeepLinkFocus', () => ({
  useDeepLinkFocus: vi.fn(),
}))

vi.mock('@/stores/useOpdsCatalogStore', () => ({
  useOpdsCatalogStore: (selector: (s: unknown) => unknown) =>
    selector({
      catalogs: [
        { id: 'cat-anon', name: 'Public Feed', url: 'https://pub.example.com/opds', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'cat-auth', name: 'Protected Library', url: 'https://lib.example.com/opds', auth: { username: 'user' }, createdAt: '2026-01-01T00:00:00Z' },
      ],
      loadCatalogs: vi.fn(),
      addCatalog: vi.fn(),
      updateCatalog: vi.fn(),
      removeCatalog: vi.fn(),
    }),
}))

vi.mock('@/services/OpdsService', () => ({
  validateCatalog: vi.fn(),
}))

vi.mock('@/lib/vaultCredentials', () => ({
  checkCredential: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/credentials/opdsPasswordResolver', () => ({
  getOpdsPassword: vi.fn(),
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastSuccess: { saved: vi.fn() },
}))

import { CatalogListView } from '../CatalogListView'

function renderCatalogList(statusByKey: Record<string, string> = {}) {
  return render(
    <MemoryRouter>
      <CatalogListView
        catalogs={[
          { id: 'cat-anon', name: 'Public Feed', url: 'https://pub.example.com/opds', createdAt: '2026-01-01T00:00:00Z' },
          { id: 'cat-auth', name: 'Protected Library', url: 'https://lib.example.com/opds', auth: { username: 'user' }, createdAt: '2026-01-01T00:00:00Z' },
          { id: 'cat-vault', name: 'Vault Library', url: 'https://vault.example.com/opds', auth: { username: 'user' }, createdAt: '2026-01-01T00:00:00Z' },
        ]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        statusByKey={statusByKey as Record<string, import('@/lib/credentials/credentialStatus').CredentialStatus>}
      />
    </MemoryRouter>
  )
}

describe('CatalogListView — E97-S05 badge wiring', () => {
  it('anonymous catalog (no status in map) → no badge shown', () => {
    renderCatalogList({})
    expect(screen.queryByRole('img', { name: 'No credential needed' })).not.toBeInTheDocument()
  })

  it('anonymous status → "No credential needed" badge', () => {
    renderCatalogList({ 'opds-catalog:cat-anon': 'anonymous' })
    expect(screen.getByRole('img', { name: 'No credential needed' })).toBeInTheDocument()
  })

  it('vault status for auth catalog → "Synced via Vault" badge', () => {
    renderCatalogList({ 'opds-catalog:cat-vault': 'vault' })
    expect(screen.getByRole('img', { name: 'Synced via Vault' })).toBeInTheDocument()
  })

  it('missing status for auth catalog → "Not configured" badge', () => {
    renderCatalogList({ 'opds-catalog:cat-auth': 'missing' })
    expect(screen.getByRole('img', { name: 'Not configured' })).toBeInTheDocument()
  })
})
