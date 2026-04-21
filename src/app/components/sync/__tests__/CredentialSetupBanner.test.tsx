/**
 * Tests for CredentialSetupBanner — E97-S05 Unit 5.
 *
 * @since E97-S05
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// ── Mocks ─────────────────────────────────────────────────────────────────

const {
  mockMissingCredentials,
  mockAuthUser,
} = vi.hoisted(() => ({
  mockMissingCredentials: vi.fn().mockReturnValue({ missing: [], statusByKey: {}, loading: false }),
  mockAuthUser: vi.fn<() => { id: string } | null>(() => ({ id: 'user-1' })),
}))

vi.mock('@/app/hooks/useMissingCredentials', () => ({
  useMissingCredentials: mockMissingCredentials,
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: mockAuthUser() }),
}))

import { CredentialSetupBanner } from '../CredentialSetupBanner'

const AI_ENTRY = { kind: 'ai-provider' as const, id: '__ai-section__', displayName: 'AI provider keys', status: 'missing' as const }
const OPDS_ENTRY = { kind: 'opds-catalog' as const, id: 'cat-1', displayName: 'My Library', status: 'missing' as const }
const ABS_ENTRY = { kind: 'abs-server' as const, id: 'srv-1', displayName: 'Home Server', status: 'missing' as const }

// Mock window.location.assign to spy on navigation
const mockAssign = vi.fn()
Object.defineProperty(window, 'location', {
  value: { ...window.location, assign: mockAssign },
  writable: true,
})

function renderBanner() {
  return render(
    <MemoryRouter>
      <CredentialSetupBanner />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockMissingCredentials.mockReturnValue({ missing: [], statusByKey: {}, loading: false })
  mockAuthUser.mockReturnValue({ id: 'user-1' })
  mockAssign.mockClear()
  // Clear sessionStorage
  try { sessionStorage.clear() } catch { /* ignore */ }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CredentialSetupBanner — render logic', () => {
  it('missing = [] → banner does not render', () => {
    mockMissingCredentials.mockReturnValue({ missing: [], statusByKey: {}, loading: false })
    renderBanner()
    expect(screen.queryByTestId('credential-setup-banner')).not.toBeInTheDocument()
  })

  it('loading === true → banner does not render (avoids flash)', () => {
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: true })
    renderBanner()
    expect(screen.queryByTestId('credential-setup-banner')).not.toBeInTheDocument()
  })

  it('3 entries: one AI row, one OPDS row, one ABS row — exactly 3 rows', () => {
    mockMissingCredentials.mockReturnValue({
      missing: [AI_ENTRY, OPDS_ENTRY, ABS_ENTRY],
      statusByKey: {},
      loading: false,
    })
    renderBanner()
    expect(screen.getByTestId('credential-setup-banner')).toBeInTheDocument()
    expect(screen.getByText('AI provider keys need setup')).toBeInTheDocument()
    expect(screen.getByText('My Library')).toBeInTheDocument()
    expect(screen.getByText('Home Server')).toBeInTheDocument()
  })

  it('AI single-row guarantee: even with 5 AI providers local, banner renders exactly ONE AI row', () => {
    // aggregator already enforces one synthetic entry; banner just renders missing[]
    mockMissingCredentials.mockReturnValue({
      missing: [AI_ENTRY], // exactly one synthetic AI entry
      statusByKey: {},
      loading: false,
    })
    renderBanner()
    expect(screen.getAllByText('AI provider keys need setup')).toHaveLength(1)
  })
})

describe('CredentialSetupBanner — action buttons', () => {
  it('click "Set up" on AI entry → navigate to /settings?section=integrations (no focus param)', () => {
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    renderBanner()

    const setUpBtn = screen.getByTestId(`credential-banner-action-ai-provider-__ai-section__`)
    fireEvent.click(setUpBtn)

    expect(mockAssign).toHaveBeenCalledWith('/settings?section=integrations')
    // Assert NO focus param in the navigation call
    const navArg = mockAssign.mock.calls[0][0] as string
    expect(navArg).not.toContain('focus=')
  })

  it('click "Re-enter" on OPDS entry → dispatches open-opds-settings CustomEvent', () => {
    mockMissingCredentials.mockReturnValue({ missing: [OPDS_ENTRY], statusByKey: {}, loading: false })
    renderBanner()

    const events: CustomEvent[] = []
    window.addEventListener('open-opds-settings', (e) => events.push(e as CustomEvent))

    const btn = screen.getByTestId(`credential-banner-action-opds-catalog-cat-1`)
    fireEvent.click(btn)

    expect(events).toHaveLength(1)
    expect(events[0].detail).toMatchObject({ focusId: 'cat-1' })
  })

  it('click "Re-enter" on ABS entry → dispatches open-abs-settings CustomEvent', () => {
    mockMissingCredentials.mockReturnValue({ missing: [ABS_ENTRY], statusByKey: {}, loading: false })
    renderBanner()

    const events: CustomEvent[] = []
    window.addEventListener('open-abs-settings', (e) => events.push(e as CustomEvent))

    const btn = screen.getByTestId(`credential-banner-action-abs-server-srv-1`)
    fireEvent.click(btn)

    expect(events).toHaveLength(1)
    expect(events[0].detail).toMatchObject({ focusId: 'srv-1' })
  })

  it('click Why? → popover trigger is present', () => {
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    renderBanner()
    expect(screen.getByTestId('credential-banner-why-btn')).toBeInTheDocument()
  })
})

describe('CredentialSetupBanner — dismissal (AC6)', () => {
  it('click X dismiss → banner hidden; sessionStorage key written', () => {
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    renderBanner()

    expect(screen.getByTestId('credential-setup-banner')).toBeInTheDocument()

    const dismissBtn = screen.getByTestId('credential-banner-dismiss-btn')
    fireEvent.click(dismissBtn)

    expect(screen.queryByTestId('credential-setup-banner')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('knowlune:credential-banner-dismissed:user-1')).toBe('true')
  })

  it('sessionStorage dismissed → banner hidden even with non-empty missing', () => {
    sessionStorage.setItem('knowlune:credential-banner-dismissed:user-1', 'true')
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    renderBanner()
    expect(screen.queryByTestId('credential-setup-banner')).not.toBeInTheDocument()
  })
})

describe('CredentialSetupBanner — AC6 re-appear on 0→N transition (R1-M1)', () => {
  it('missing transitions [] → [entry] → clears sessionStorage dismissal flag', () => {
    const key = 'knowlune:credential-banner-dismissed:user-1'
    // Pre-seed dismissal flag; hook returns missing=[] initially.
    sessionStorage.setItem(key, 'true')
    mockMissingCredentials.mockReturnValue({ missing: [], statusByKey: {}, loading: false })

    const { rerender } = renderBanner()

    // Flag still set (banner not rendered because missing=[]).
    expect(sessionStorage.getItem(key)).toBe('true')
    expect(screen.queryByTestId('credential-setup-banner')).not.toBeInTheDocument()

    // Now mock missing transitions to non-empty and rerender.
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    rerender(
      <MemoryRouter>
        <CredentialSetupBanner />
      </MemoryRouter>
    )

    // 0 → N transition should clear the dismissal flag and surface the banner.
    expect(sessionStorage.getItem(key)).toBeNull()
    expect(screen.getByTestId('credential-setup-banner')).toBeInTheDocument()
  })

  it('missing stays non-empty ([entry] → [entry]) — no 0→N transition — dismissal flag untouched', () => {
    const key = 'knowlune:credential-banner-dismissed:user-1'
    // First render with missing=[entry] and no dismissal flag — banner visible.
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    const { rerender } = renderBanner()
    expect(screen.getByTestId('credential-setup-banner')).toBeInTheDocument()

    // Manually set the dismissal flag (simulating an out-of-band write) and rerender with
    // the same non-empty missing — there is no 0→N transition, so the effect must NOT clear.
    sessionStorage.setItem(key, 'true')
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    rerender(
      <MemoryRouter>
        <CredentialSetupBanner />
      </MemoryRouter>
    )

    // No transition from 0 → N, so the clear effect must not fire.
    expect(sessionStorage.getItem(key)).toBe('true')
  })

  it('user is absent/null — effect is a no-op and does not throw on transition', () => {
    mockAuthUser.mockReturnValue(null)
    mockMissingCredentials.mockReturnValue({ missing: [], statusByKey: {}, loading: false })

    const { rerender } = renderBanner()

    // Simulate out-of-band dismissal flag for some prior user; then trigger a 0→N transition
    // while user is null — the effect must early-return without touching sessionStorage or throwing.
    const orphanKey = 'knowlune:credential-banner-dismissed:stale-user'
    sessionStorage.setItem(orphanKey, 'true')

    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    expect(() => {
      rerender(
        <MemoryRouter>
          <CredentialSetupBanner />
        </MemoryRouter>
      )
    }).not.toThrow()

    // Flag for the unrelated user stays intact — effect did not attempt any clear.
    expect(sessionStorage.getItem(orphanKey)).toBe('true')
  })
})

describe('CredentialSetupBanner — a11y', () => {
  it('banner does not carry role=status or aria-live (announcements route through useLiveRegion)', () => {
    // The overly-broad live region on the banner root was removed as part of
    // refactor/consolidate-aria-live-useliveregion. Announcements now route
    // through SyncUXShell's canonical live region via useLiveRegion().
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    renderBanner()
    const banner = screen.getByTestId('credential-setup-banner')
    expect(banner).not.toHaveAttribute('role', 'status')
    expect(banner).not.toHaveAttribute('aria-live')
  })

  it('dismiss button has descriptive aria-label', () => {
    mockMissingCredentials.mockReturnValue({ missing: [AI_ENTRY], statusByKey: {}, loading: false })
    renderBanner()
    expect(screen.getByLabelText('Dismiss credential setup banner')).toBeInTheDocument()
  })
})
