import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

const mocks = vi.hoisted(() => {
  let initialized = true
  let user: { id: string } | null = null
  return {
    setInitialized: (v: boolean) => { initialized = v },
    setUser: (u: { id: string } | null) => { user = u },
    getState: () => ({ initialized, user }),
  }
})

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: { initialized: boolean; user: { id: string } | null }) => unknown) =>
    selector(mocks.getState()),
  selectIsGuestMode: (state: { initialized: boolean; user: { id: string } | null }) =>
    state.initialized && state.user === null && sessionStorage.getItem('knowlune-guest') === 'true',
}))

import { GuestBanner } from '../GuestBanner'

beforeEach(() => {
  sessionStorage.clear()
  mocks.setInitialized(true)
  mocks.setUser(null)
})

afterEach(() => {
  cleanup()
})

function renderBanner() {
  return render(
    <MemoryRouter>
      <GuestBanner />
    </MemoryRouter>
  )
}

describe('GuestBanner', () => {
  it('renders with correct copy and role="status" when in guest mode', () => {
    sessionStorage.setItem('knowlune-guest', 'true')
    renderBanner()
    expect(screen.getByTestId('guest-banner')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(/You're browsing as a guest/)).toBeTruthy()
  })

  it('does not render when not in guest mode (signed-in user)', () => {
    mocks.setUser({ id: 'user-1' })
    const { container } = renderBanner()
    expect(container.innerHTML).toBe('')
  })

  it('does not render when sessionStorage flag absent', () => {
    const { container } = renderBanner()
    expect(container.innerHTML).toBe('')
  })

  it('hides banner on dismiss and sets sessionStorage key', async () => {
    sessionStorage.setItem('knowlune-guest', 'true')
    const user = userEvent.setup()
    renderBanner()

    await user.click(screen.getByRole('button', { name: /dismiss guest banner/i }))

    expect(screen.queryByTestId('guest-banner')).toBeNull()
    expect(sessionStorage.getItem('knowlune-guest-banner-dismissed')).toBe('true')
  })

  it('stays hidden when dismissed flag already set in sessionStorage', () => {
    sessionStorage.setItem('knowlune-guest', 'true')
    sessionStorage.setItem('knowlune-guest-banner-dismissed', 'true')
    const { container } = renderBanner()
    expect(container.innerHTML).toBe('')
  })
})
