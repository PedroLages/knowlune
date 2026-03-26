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

const mockStartCheckout = vi.fn()

vi.mock('@/lib/checkout', () => ({
  startCheckout: (...args: unknown[]) => mockStartCheckout(...args),
}))

const mockToastError = { saveFailed: vi.fn() }

vi.mock('@/lib/toastHelpers', () => ({
  toastError: { saveFailed: (...args: unknown[]) => mockToastError.saveFailed(...args) },
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

  it('upgrade button has accessible label', () => {
    mockEntitlementStatus.isPremium = false

    render(
      <PremiumGate featureLabel="AI Analysis">
        <div>Secret Content</div>
      </PremiumGate>
    )

    expect(
      screen.getByRole('button', { name: /Upgrade to Premium to unlock AI Analysis/ })
    ).toBeInTheDocument()
  })

  it('handleUpgrade shows toast when startCheckout rejects', async () => {
    mockEntitlementStatus.isPremium = false
    mockStartCheckout.mockRejectedValueOnce(new Error('Checkout unavailable'))

    const user = userEvent.setup()

    render(
      <PremiumGate featureLabel="AI Analysis">
        <div>Secret Content</div>
      </PremiumGate>
    )

    const button = screen.getByRole('button', { name: /Upgrade to Premium/ })
    await user.click(button)

    // After rejection, loading state should be reset (button no longer shows "Starting checkout...")
    expect(screen.getByRole('button', { name: /Upgrade to Premium/ })).not.toBeDisabled()
  })
})
