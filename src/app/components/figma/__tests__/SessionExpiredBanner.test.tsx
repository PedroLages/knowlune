// E43-S04: Tests for SessionExpiredBanner component
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { SessionExpiredBanner, RETURN_TO_KEY, SESSION_DISMISSED_KEY } from '../SessionExpiredBanner'

describe('SessionExpiredBanner', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useAuthStore.setState({
      sessionExpired: false,
      _userInitiatedSignOut: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  function renderBanner(isOffline = false, initialPath = '/courses') {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <SessionExpiredBanner isOffline={isOffline} />
      </MemoryRouter>
    )
  }

  it('renders when sessionExpired is true and not offline', () => {
    useAuthStore.setState({ sessionExpired: true })
    renderBanner(false)

    expect(screen.getByText('Session expired. Sign in to resume syncing.')).toBeInTheDocument()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('does NOT render when sessionExpired is false', () => {
    renderBanner(false)
    expect(
      screen.queryByText('Session expired. Sign in to resume syncing.')
    ).not.toBeInTheDocument()
  })

  it('does NOT render when offline (offline banner takes priority)', () => {
    useAuthStore.setState({ sessionExpired: true })
    renderBanner(true)
    expect(
      screen.queryByText('Session expired. Sign in to resume syncing.')
    ).not.toBeInTheDocument()
  })

  it('dismiss button sets sessionStorage flag', async () => {
    useAuthStore.setState({ sessionExpired: true })
    renderBanner(false)

    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    await userEvent.click(dismissButton)

    expect(sessionStorage.getItem(SESSION_DISMISSED_KEY)).toBe('true')
    // Banner should disappear after dismiss
    expect(
      screen.queryByText('Session expired. Sign in to resume syncing.')
    ).not.toBeInTheDocument()
  })

  it('"Sign in" link stores current route in sessionStorage', async () => {
    useAuthStore.setState({ sessionExpired: true })
    renderBanner(false, '/courses')

    const signInLink = screen.getByText('Sign in')
    await userEvent.click(signInLink)

    expect(sessionStorage.getItem(RETURN_TO_KEY)).toBe('/courses')
  })

  it('does NOT render when previously dismissed (sessionStorage flag)', () => {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true')
    useAuthStore.setState({ sessionExpired: true })
    renderBanner(false)

    expect(
      screen.queryByText('Session expired. Sign in to resume syncing.')
    ).not.toBeInTheDocument()
  })
})
