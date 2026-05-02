import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EntitlementTier } from '@/data/types'

// ---------------------------------------------------------------------------
// Mock the useIsPremium hook
// ---------------------------------------------------------------------------

const mockEntitlementStatus: {
  isPremium: boolean
  loading: boolean
  tier: EntitlementTier
  isStale: boolean
  error: string | null
} = {
  isPremium: false,
  loading: false,
  tier: 'free',
  isStale: false,
  error: null,
}

vi.mock('@/lib/entitlement/isPremium', () => ({
  useIsPremium: () => ({ ...mockEntitlementStatus }),
}))

// Mock useTrialStatus — default: had trial, cannot start trial
const mockTrialStatus = {
  isTrialing: false,
  daysRemaining: 0,
  showReminder: false,
  hadTrial: true,
  canStartTrial: false,
  trialEnd: null,
  dismissReminder: vi.fn(),
}

vi.mock('@/app/hooks/useTrialStatus', () => ({
  useTrialStatus: () => ({ ...mockTrialStatus }),
}))

const mockStartCheckout = vi.fn()

vi.mock('@/lib/checkout', () => ({
  startCheckout: (...args: unknown[]) => mockStartCheckout(...args),
}))

const mockToastError = { saveFailed: vi.fn() }

vi.mock('@/lib/toastHelpers', () => ({
  toastError: { saveFailed: (...args: unknown[]) => mockToastError.saveFailed(...args) },
}))

// ---------------------------------------------------------------------------
// Mock the auth store with controllable user value
// ---------------------------------------------------------------------------

let mockUser: { id: string; email: string } | null = null

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { user: typeof mockUser }) => unknown) => selector({ user: mockUser }),
    {
      getState: () => ({ user: mockUser }),
      subscribe: vi.fn(() => vi.fn()),
    }
  ),
}))

import { PremiumGate } from '@/app/components/PremiumGate'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PremiumGate', () => {
  beforeEach(() => {
    mockEntitlementStatus.isPremium = false
    mockEntitlementStatus.loading = false
    mockEntitlementStatus.tier = 'free'
    mockEntitlementStatus.isStale = false
    mockEntitlementStatus.error = null
    mockUser = null
    mockStartCheckout.mockReset()
    mockToastError.saveFailed.mockReset()
  })

  it('renders children when user is premium', () => {
    mockEntitlementStatus.isPremium = true
    mockEntitlementStatus.tier = 'premium'

    render(
      <PremiumGate>
        <div data-testid="premium-content">Secret Content</div>
      </PremiumGate>
    )

    expect(screen.getByTestId('premium-content')).toBeInTheDocument()
    expect(screen.queryByTestId('premium-gate-cta')).not.toBeInTheDocument()
  })

  it('renders upgrade CTA when user is free', () => {
    mockEntitlementStatus.isPremium = false
    mockEntitlementStatus.tier = 'free'

    render(
      <PremiumGate featureLabel="AI Summaries">
        <div data-testid="premium-content">Secret Content</div>
      </PremiumGate>
    )

    expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument()
    expect(screen.getByTestId('premium-gate-cta')).toBeInTheDocument()
    expect(screen.getByText(/AI Summaries/)).toBeInTheDocument()
  })

  it('renders skeleton while loading', () => {
    mockEntitlementStatus.loading = true

    render(
      <PremiumGate featureLabel="AI Summaries">
        <div>Secret Content</div>
      </PremiumGate>
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('premium-gate-cta')).not.toBeInTheDocument()
  })

  it('renders nothing while loading when showSkeleton=false', () => {
    mockEntitlementStatus.loading = true

    const { container } = render(
      <PremiumGate showSkeleton={false}>
        <div>Secret Content</div>
      </PremiumGate>
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders custom fallback instead of default CTA', () => {
    mockEntitlementStatus.isPremium = false

    render(
      <PremiumGate fallback={<div data-testid="custom-fallback">Custom Upgrade</div>}>
        <div>Secret Content</div>
      </PremiumGate>
    )

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.queryByTestId('premium-gate-cta')).not.toBeInTheDocument()
  })

  it('shows stale cache message when isStale is true', () => {
    mockEntitlementStatus.isPremium = false
    mockEntitlementStatus.isStale = true

    render(
      <PremiumGate>
        <div>Secret Content</div>
      </PremiumGate>
    )

    expect(screen.getByText(/outdated/)).toBeInTheDocument()
  })

  it('shows error message when error is present', () => {
    mockEntitlementStatus.isPremium = false
    mockEntitlementStatus.error = 'Subscription expired'

    render(
      <PremiumGate>
        <div>Secret Content</div>
      </PremiumGate>
    )

    expect(screen.getByText('Subscription expired')).toBeInTheDocument()
  })

  it('disables premium when isStale even if isPremium would be true', () => {
    // When cache is stale, we should show CTA not content
    mockEntitlementStatus.isPremium = true
    mockEntitlementStatus.isStale = true

    render(
      <PremiumGate>
        <div data-testid="premium-content">Secret Content</div>
      </PremiumGate>
    )

    expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument()
    expect(screen.getByTestId('premium-gate-cta')).toBeInTheDocument()
  })

  it('has accessible region label with feature name', () => {
    mockEntitlementStatus.isPremium = false

    render(
      <PremiumGate featureLabel="Knowledge Graphs">
        <div>Secret Content</div>
      </PremiumGate>
    )

    expect(screen.getByRole('region', { name: /Knowledge Graphs/ })).toBeInTheDocument()
  })

  // --- Authenticated user tests ---

  describe('authenticated user', () => {
    beforeEach(() => {
      mockUser = { id: 'user-123', email: 'test@test.com' }
    })

    it('upgrade button shows "Subscribe" with accessible label for users who had trial', () => {
      mockEntitlementStatus.isPremium = false

      render(
        <PremiumGate featureLabel="AI Analysis">
          <div>Secret Content</div>
        </PremiumGate>
      )

      expect(
        screen.getByRole('button', { name: /Subscribe to unlock AI Analysis/ })
      ).toBeInTheDocument()
      expect(screen.getByText('Subscribe')).toBeInTheDocument()
    })

    it('calls startCheckout directly when clicking subscribe', async () => {
      mockEntitlementStatus.isPremium = false
      mockStartCheckout.mockRejectedValueOnce(new Error('Checkout unavailable'))

      const user = userEvent.setup()

      render(
        <PremiumGate featureLabel="AI Analysis">
          <div>Secret Content</div>
        </PremiumGate>
      )

      const button = screen.getByRole('button', { name: /Subscribe/ })
      await user.click(button)

      expect(mockStartCheckout).toHaveBeenCalled()
      // After rejection, loading state should be reset (button no longer shows "Starting checkout...")
      expect(screen.getByRole('button', { name: /Subscribe/ })).not.toBeDisabled()
    })
  })

  // --- Unauthenticated user tests ---
  // In the closed app, unauthenticated users can't reach PremiumGate (route guard blocks them).
  // These tests verify that handleUpgrade is a no-op when user is null (defensive safety net).

  describe('unauthenticated user (route guard normally prevents this)', () => {
    beforeEach(() => {
      mockUser = null
    })

    it('clicking upgrade is a no-op when not authenticated', async () => {
      mockEntitlementStatus.isPremium = false

      const user = userEvent.setup()

      render(
        <PremiumGate featureLabel="AI Analysis">
          <div>Secret Content</div>
        </PremiumGate>
      )

      const button = screen.getByRole('button', { name: /Subscribe to unlock AI Analysis/ })
      await user.click(button)

      // Route guard prevents unauthenticated users from reaching this state.
      // handleUpgrade returns early when !user — no checkout, no dialog.
      expect(mockStartCheckout).not.toHaveBeenCalled()
    })
  })
})
