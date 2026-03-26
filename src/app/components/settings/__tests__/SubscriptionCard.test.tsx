import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartCheckout = vi.fn()
const mockPollEntitlement = vi.fn()
const mockGetCachedEntitlement = vi.fn()
const mockCacheEntitlement = vi.fn()
const mockCreatePortalSession = vi.fn()

vi.mock('@/lib/checkout', () => ({
  startCheckout: (...args: unknown[]) => mockStartCheckout(...args),
  pollEntitlement: (...args: unknown[]) => mockPollEntitlement(...args),
  getCachedEntitlement: (...args: unknown[]) => mockGetCachedEntitlement(...args),
  cacheEntitlement: (...args: unknown[]) => mockCacheEntitlement(...args),
  createPortalSession: (...args: unknown[]) => mockCreatePortalSession(...args),
}))

// Mock useIsPremium — returns non-stale, no error by default
const mockUseIsPremium = vi.fn().mockReturnValue({
  isPremium: false,
  loading: false,
  tier: 'free',
  isStale: false,
  error: null,
})

vi.mock('@/lib/entitlement/isPremium', () => ({
  useIsPremium: () => mockUseIsPremium(),
}))

const mockToastError = vi.fn()
const mockToastInfo = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastSuccess: {
    saved: vi.fn(),
    exported: vi.fn(),
    imported: vi.fn(),
    reset: vi.fn(),
  },
  toastError: {
    saveFailed: vi.fn(),
    importFailed: vi.fn(),
    invalidFile: vi.fn(),
    deleteFailed: vi.fn(),
  },
}))

// Mock the auth store with a controllable user value
let mockUser: { id: string; email: string } | null = { id: 'user-123', email: 'test@test.com' }

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}))

import { SubscriptionCard } from '../SubscriptionCard'
import type { CachedEntitlement } from '@/data/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCard(props: { checkoutStatus?: 'success' | 'cancel' | null } = {}) {
  return render(
    <MemoryRouter>
      <SubscriptionCard {...props} />
    </MemoryRouter>
  )
}

function makePremiumEntitlement(overrides: Partial<CachedEntitlement> = {}): CachedEntitlement {
  return {
    userId: 'user-123',
    tier: 'premium',
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
    planId: 'plan_test',
    expiresAt: '2027-01-01T00:00:00.000Z',
    cachedAt: '2026-03-25T12:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubscriptionCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockUser = { id: 'user-123', email: 'test@test.com' }
    mockGetCachedEntitlement.mockResolvedValue(null)
    mockStartCheckout.mockResolvedValue({ url: 'https://checkout.stripe.com/pay' })
    mockPollEntitlement.mockResolvedValue(null)
    mockCreatePortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/session/test' })
    mockUseIsPremium.mockReturnValue({
      isPremium: false,
      loading: false,
      tier: 'free',
      isStale: false,
      error: null,
    })
  })

  // -------------------------------------------------------------------------
  // Null user guard
  // -------------------------------------------------------------------------

  it('returns null when user is null', () => {
    mockUser = null
    const { container } = renderCard()
    expect(container.innerHTML).toBe('')
  })

  // -------------------------------------------------------------------------
  // Loading / skeleton state
  // -------------------------------------------------------------------------

  it('shows skeleton loader when entitlement is loading', () => {
    // getCachedEntitlement is a promise that hasn't resolved yet
    mockGetCachedEntitlement.mockReturnValue(new Promise(() => {})) // never resolves

    renderCard()

    // The loading skeleton has aria-busy and aria-label
    const loadingStatus = screen.getByLabelText('Loading subscription status')
    expect(loadingStatus).toHaveAttribute('aria-busy', 'true')
  })

  // -------------------------------------------------------------------------
  // Free tier state
  // -------------------------------------------------------------------------

  it('shows "Upgrade to Premium" button and feature list when user is on free tier', async () => {
    mockGetCachedEntitlement.mockResolvedValue(null) // no cache = free tier

    renderCard()

    // Wait for the effect to resolve and state to settle
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upgrade to premium/i })).toBeInTheDocument()
    })

    // Check feature list
    expect(screen.getByText('AI Video Summaries')).toBeInTheDocument()
    expect(screen.getByText('Knowledge Gap Detection')).toBeInTheDocument()
    expect(screen.getByText('AI Learning Paths')).toBeInTheDocument()
    expect(screen.getByText('Auto Note Organization')).toBeInTheDocument()

    // Free badge
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Premium state
  // -------------------------------------------------------------------------

  it('shows plan details, Manage Billing, and Cancel buttons when user is premium', async () => {
    mockGetCachedEntitlement.mockResolvedValue(makePremiumEntitlement())
    mockUseIsPremium.mockReturnValue({
      isPremium: true,
      loading: false,
      tier: 'premium',
      isStale: false,
      error: null,
    })

    renderCard()

    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeInTheDocument()
    })

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    // Next billing date should be shown
    expect(screen.getByText(/January 1, 2027/)).toBeInTheDocument()
    // AC1: Manage Billing and Cancel buttons
    expect(
      screen.getByRole('button', { name: /manage.*billing|billing.*portal/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel.*subscription/i })).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Manage Billing (AC2, AC6)
  // -------------------------------------------------------------------------

  it('opens Stripe Portal when "Manage Billing" is clicked', async () => {
    mockGetCachedEntitlement.mockResolvedValue(makePremiumEntitlement())
    mockUseIsPremium.mockReturnValue({
      isPremium: true,
      loading: false,
      tier: 'premium',
      isStale: false,
      error: null,
    })

    renderCard()

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /manage.*billing|billing.*portal/i })
      ).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /manage.*billing|billing.*portal/i }))

    expect(mockCreatePortalSession).toHaveBeenCalledWith()
  })

  it('shows error with retry when portal creation fails', async () => {
    mockGetCachedEntitlement.mockResolvedValue(makePremiumEntitlement())
    mockUseIsPremium.mockReturnValue({
      isPremium: true,
      loading: false,
      tier: 'premium',
      isStale: false,
      error: null,
    })
    mockCreatePortalSession.mockResolvedValue({
      error: 'Unable to open billing portal. Please try again.',
    })

    renderCard()

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /manage.*billing|billing.*portal/i })
      ).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /manage.*billing|billing.*portal/i }))

    await waitFor(() => {
      expect(screen.getByText(/unable to open billing portal/i)).toBeInTheDocument()
    })

    // AC6: Retry button should be visible
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Cancel Subscription (AC3)
  // -------------------------------------------------------------------------

  it('shows confirmation dialog when Cancel Subscription is clicked', async () => {
    mockGetCachedEntitlement.mockResolvedValue(makePremiumEntitlement())
    mockUseIsPremium.mockReturnValue({
      isPremium: true,
      loading: false,
      tier: 'premium',
      isStale: false,
      error: null,
    })

    renderCard()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel.*subscription/i })).toBeInTheDocument()
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel.*subscription/i }))

    // Confirmation dialog with what they lose/keep
    await waitFor(() => {
      expect(screen.getByText(/cancel your subscription/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/keep premium access until/i)).toBeInTheDocument()
    expect(
      screen.getByText(/progress, notes, and achievements are never deleted/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/lose access to AI Summaries/i)).toBeInTheDocument()
    expect(screen.getByText(/resubscribe anytime/i)).toBeInTheDocument()

    // Keep Subscription button should be available
    expect(screen.getByRole('button', { name: /keep subscription/i })).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Offline / stale cached state (AC7)
  // -------------------------------------------------------------------------

  it('shows cached status with "Last updated" note when offline', async () => {
    mockGetCachedEntitlement.mockResolvedValue(makePremiumEntitlement())
    mockUseIsPremium.mockReturnValue({
      isPremium: true,
      loading: false,
      tier: 'premium',
      isStale: true,
      error: 'Offline',
    })
    // Simulate offline
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    renderCard()

    await waitFor(() => {
      expect(screen.getByText(/using cached subscription data/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/last updated/i)).toBeInTheDocument()

    // Buttons should be disabled
    const manageBillingBtn = screen.getByRole('button', {
      name: /manage.*billing|billing.*portal/i,
    })
    expect(manageBillingBtn).toBeDisabled()
    const cancelBtn = screen.getByRole('button', { name: /cancel subscription/i })
    expect(cancelBtn).toBeDisabled()

    // Restore navigator
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  // -------------------------------------------------------------------------
  // Checkout loading
  // -------------------------------------------------------------------------

  it('shows spinner and disables button when checkout is loading', async () => {
    mockGetCachedEntitlement.mockResolvedValue(null)
    // Never-resolving promise to keep checkout loading
    mockStartCheckout.mockReturnValue(new Promise(() => {}))

    renderCard()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upgrade to premium/i })).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: /upgrade to premium/i })

    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText('Starting checkout...')).toBeInTheDocument()
    })

    // Button should be disabled and show aria-busy
    const loadingButton = screen.getByRole('button', { name: /upgrade to premium/i })
    expect(loadingButton).toBeDisabled()
    expect(loadingButton).toHaveAttribute('aria-busy', 'true')
  })

  // -------------------------------------------------------------------------
  // Activation state (checkoutStatus='success')
  // -------------------------------------------------------------------------

  it('shows "Activating..." during polling when checkoutStatus is success', async () => {
    // getCachedEntitlement must never resolve — otherwise it sets state='free'
    // which overwrites the 'activating' state set by the checkout success effect
    mockGetCachedEntitlement.mockReturnValue(new Promise(() => {}))
    // pollEntitlement never resolves — stays in activating state
    mockPollEntitlement.mockReturnValue(new Promise(() => {}))

    renderCard({ checkoutStatus: 'success' })

    await waitFor(() => {
      expect(screen.getByText('Activating...')).toBeInTheDocument()
    })

    // Should show the activating progress/status region
    expect(screen.getByLabelText('Activating subscription')).toBeInTheDocument()
    expect(screen.getByText(/usually takes a few seconds/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Activated → premium transition
  // -------------------------------------------------------------------------

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows "Welcome to Premium!" then transitions to premium after 3s', async () => {
      mockGetCachedEntitlement.mockResolvedValue(null)
      mockPollEntitlement.mockResolvedValue(makePremiumEntitlement())

      renderCard({ checkoutStatus: 'success' })

      // Wait for activation to complete
      await waitFor(() => {
        expect(screen.getByText('Welcome to Premium!')).toBeInTheDocument()
      })

      expect(screen.getByText('All premium features are now unlocked.')).toBeInTheDocument()

      // Advance 3s to trigger transition to premium view
      await act(async () => {
        vi.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument()
        expect(screen.getByText('Active')).toBeInTheDocument()
      })
    })
  })

  // -------------------------------------------------------------------------
  // Cancel state
  // -------------------------------------------------------------------------

  it('falls back to free tier with error toast when poll times out', async () => {
    mockGetCachedEntitlement.mockResolvedValue(null)
    // pollEntitlement returns null = webhook never processed
    mockPollEntitlement.mockResolvedValue(null)

    const { toastError } = await import('@/lib/toastHelpers')

    renderCard({ checkoutStatus: 'success' })

    // Should show activating first, then fall back to free
    await waitFor(() => {
      expect(toastError.saveFailed).toHaveBeenCalledWith(expect.stringContaining('being processed'))
    })

    // Should be back on free tier
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upgrade to premium/i })).toBeInTheDocument()
    })
  })

  it('shows toast error when checkoutStatus is cancel and remains on free tier', async () => {
    mockGetCachedEntitlement.mockResolvedValue(null)

    renderCard({ checkoutStatus: 'cancel' })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Upgrade not completed')
    })

    // Verify the card remains on free tier — upgrade button should still be visible
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /upgrade to premium/i })).toBeInTheDocument()
    })
  })
})
