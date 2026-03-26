import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock the useIsPremium hook
// ---------------------------------------------------------------------------

const mockEntitlementStatus = {
  isPremium: false,
  loading: false,
  tier: 'free' as const,
  isStale: false,
  error: null as string | null,
}

vi.mock('@/lib/entitlement/isPremium', () => ({
  useIsPremium: () => ({ ...mockEntitlementStatus }),
}))

vi.mock('@/lib/checkout', () => ({
  startCheckout: vi.fn(),
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastError: { saveFailed: vi.fn() },
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
})
