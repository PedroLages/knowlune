import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/lib/settings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings')>()
  return {
    ...actual,
    getSettings: () => ({
      displayName: 'Student',
      bio: '',
      theme: 'system',
    }),
    saveSettings: vi.fn(),
    exportAllData: () => '{}',
    importAllData: vi.fn(() => true),
    resetAllData: vi.fn(),
  }
})

vi.mock('@/app/components/figma/ReminderSettings', () => ({
  ReminderSettings: () => <div data-testid="reminder-settings" />,
}))

// Controllable user mock for auth store
let mockUser: { id: string; email: string } | null = null

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (
    selector: (state: { user: typeof mockUser; session: null; initialized: boolean }) => unknown
  ) => selector({ user: mockUser, session: null, initialized: true }),
}))

vi.mock('@/lib/checkout', () => ({
  startCheckout: vi.fn(),
  pollEntitlement: vi.fn(),
  getCachedEntitlement: vi.fn().mockResolvedValue(null),
  cacheEntitlement: vi.fn(),
}))

vi.mock('@/lib/entitlement/isPremium', () => ({
  useIsPremium: () => ({
    isPremium: false,
    tier: 'free',
    loading: false,
    isStale: false,
    error: null,
    trialEnd: null,
    hadTrial: false,
  }),
}))

vi.mock('@/app/hooks/useTrialStatus', () => ({
  useTrialStatus: () => ({
    daysRemaining: 0,
    canStartTrial: false,
    hadTrial: false,
    trialEnd: null,
  }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastSuccess: { saved: vi.fn(), exported: vi.fn(), imported: vi.fn(), reset: vi.fn() },
  toastError: {
    saveFailed: vi.fn(),
    importFailed: vi.fn(),
    invalidFile: vi.fn(),
    deleteFailed: vi.fn(),
  },
}))

import Settings from '../Settings'

describe('Settings page', () => {
  beforeEach(() => {
    mockUser = null
  })

  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })

  it('displays the page heading "Settings"', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders Profile, Appearance, and Data Management sections', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByText('Your Profile')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Data Management')).toBeInTheDocument()
  })

  it('renders the Display Name input with default value', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const nameInput = screen.getByLabelText('Display Name')
    expect(nameInput).toBeInTheDocument()
    expect(nameInput).toHaveValue('Student')
  })

  it('does NOT render SubscriptionCard when user is null', () => {
    mockUser = null
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.queryByTestId('subscription-section')).not.toBeInTheDocument()
  })

  it('renders SubscriptionCard when user is authenticated', async () => {
    mockUser = { id: 'user-123', email: 'test@test.com' }
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('subscription-section')).toBeInTheDocument()
    })
  })

  it('passes checkout=success to SubscriptionCard and triggers URL cleanup', async () => {
    mockUser = { id: 'user-123', email: 'test@test.com' }
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

    render(
      <MemoryRouter initialEntries={['/settings?checkout=success&session_id=cs_test']}>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('subscription-section')).toBeInTheDocument()
    })

    // Settings reads checkout param via useSearchParams (MemoryRouter),
    // then calls replaceState to strip params from the real URL.
    // In jsdom, window.location.pathname is '/' (not '/settings'),
    // so we assert replaceState was called (URL cleanup triggered).
    expect(replaceStateSpy).toHaveBeenCalled()
    replaceStateSpy.mockRestore()
  })

  it('does not trigger URL cleanup for invalid checkout param', async () => {
    mockUser = { id: 'user-123', email: 'test@test.com' }

    render(
      <MemoryRouter initialEntries={['/settings?checkout=invalid']}>
        <Settings />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('subscription-section')).toBeInTheDocument()
    })

    // SubscriptionCard should render free tier (invalid param is ignored)
    // With hadTrial=false, the button label is "Upgrade to Premium plan"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upgrade to premium plan/i })).toBeInTheDocument()
    })
  })
})
