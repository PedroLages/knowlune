import { describe, it, expect, vi, beforeEach } from 'vitest'
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

vi.mock('@/lib/checkout', () => ({
  startCheckout: (...args: unknown[]) => mockStartCheckout(...args),
  pollEntitlement: (...args: unknown[]) => mockPollEntitlement(...args),
  getCachedEntitlement: (...args: unknown[]) => mockGetCachedEntitlement(...args),
  cacheEntitlement: (...args: unknown[]) => mockCacheEntitlement(...args),
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

  it('shows skeleton when entitlement is loading', () => {
    // getCachedEntitlement is a promise that hasn't resolved yet
    mockGetCachedEntitlement.mockReturnValue(new Promise(() => {})) // never resolves

    renderCard()

    // The loading skeleton has animate-pulse divs
    const section = screen.getByTestId('subscription-section')
    expect(section.querySelector('.animate-pulse')).not.toBeNull()
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

  it('shows plan details and badges when user is premium', async () => {
    mockGetCachedEntitlement.mockResolvedValue(makePremiumEntitlement())

    renderCard()

    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeInTheDocument()
    })

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    // Next billing date should be shown
    expect(screen.getByText(/January 1, 2027/)).toBeInTheDocument()
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
