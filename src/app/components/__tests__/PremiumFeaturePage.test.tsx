import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EntitlementTier } from '@/data/types'

// ---------------------------------------------------------------------------
// Mock useIsPremium
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

// ---------------------------------------------------------------------------
// Mock auth store (UpgradeCTA depends on it)
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

// ---------------------------------------------------------------------------
// Mock checkout + toast (required by UpgradeCTA)
// ---------------------------------------------------------------------------

vi.mock('@/lib/checkout', () => ({
  startCheckout: vi.fn(),
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastError: { saveFailed: vi.fn() },
}))

import { PremiumFeaturePage, PREMIUM_FEATURES } from '@/app/components/PremiumFeaturePage'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PremiumFeaturePage', () => {
  beforeEach(() => {
    mockEntitlementStatus.isPremium = false
    mockEntitlementStatus.loading = false
    mockEntitlementStatus.tier = 'free'
    mockEntitlementStatus.isStale = false
    mockEntitlementStatus.error = null
    mockUser = null
  })

  it('renders children when user is premium', () => {
    mockEntitlementStatus.isPremium = true
    mockEntitlementStatus.tier = 'premium'

    render(
      <PremiumFeaturePage featureName="AI Q&A" featureDescription="AI answers from your notes">
        <div data-testid="premium-content">Premium Page Content</div>
      </PremiumFeaturePage>
    )

    expect(screen.getByTestId('premium-content')).toBeInTheDocument()
    expect(screen.queryByTestId('premium-feature-preview')).not.toBeInTheDocument()
  })

  it('renders feature preview with name and description for free users', () => {
    render(
      <PremiumFeaturePage
        featureName="AI Q&A"
        featureDescription="AI answers from your notes"
        highlights={['Chat-style Q&A', 'Citation links']}
      >
        <div data-testid="premium-content">Premium Page Content</div>
      </PremiumFeaturePage>
    )

    expect(screen.queryByTestId('premium-content')).not.toBeInTheDocument()
    expect(screen.getByTestId('premium-feature-preview')).toBeInTheDocument()
    expect(screen.getByText('AI Q&A')).toBeInTheDocument()
    expect(screen.getByText('AI answers from your notes')).toBeInTheDocument()
  })

  it('renders feature highlights as bullet points', () => {
    render(
      <PremiumFeaturePage
        featureName="AI Q&A"
        featureDescription="AI answers"
        highlights={['Chat-style Q&A', 'Citation links', 'Streaming responses']}
      >
        <div>Content</div>
      </PremiumFeaturePage>
    )

    expect(screen.getByText('Chat-style Q&A')).toBeInTheDocument()
    expect(screen.getByText('Citation links')).toBeInTheDocument()
    expect(screen.getByText('Streaming responses')).toBeInTheDocument()
  })

  it('renders UpgradeCTA with feature name (no nested PremiumGate double-loading)', () => {
    render(
      <PremiumFeaturePage
        featureName="Knowledge Gap Detection"
        featureDescription="AI gap analysis"
      >
        <div>Content</div>
      </PremiumFeaturePage>
    )

    // The UpgradeCTA should show with the feature name
    expect(screen.getByTestId('premium-gate-cta')).toBeInTheDocument()
    // FeaturePreview region + UpgradeCTA region both reference the feature name
    const regions = screen.getAllByRole('region', { name: /Knowledge Gap Detection/ })
    expect(regions.length).toBeGreaterThanOrEqual(1)
    // Only one loading skeleton should appear (no double-loading from nested PremiumGate)
    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })

  it('has accessible region label for the feature preview', () => {
    render(
      <PremiumFeaturePage featureName="AI Q&A" featureDescription="AI answers">
        <div>Content</div>
      </PremiumFeaturePage>
    )

    expect(screen.getByRole('region', { name: /AI Q&A — Premium feature/ })).toBeInTheDocument()
  })

  describe('PREMIUM_FEATURES config', () => {
    it('has entries for all premium features', () => {
      const expectedKeys = [
        'chatQA',
        'aiLearningPath',
        'knowledgeGaps',
        'reviewQueue',
        'interleavedReview',
        'retentionDashboard',
        'flashcards',
      ]

      expect(Object.keys(PREMIUM_FEATURES)).toEqual(expect.arrayContaining(expectedKeys))
      expect(Object.keys(PREMIUM_FEATURES)).toHaveLength(expectedKeys.length)
    })

    it('each feature has required fields', () => {
      for (const [key, feature] of Object.entries(PREMIUM_FEATURES)) {
        expect(feature.featureName, `${key} missing featureName`).toBeTruthy()
        expect(feature.featureDescription, `${key} missing featureDescription`).toBeTruthy()
        expect(feature.highlights, `${key} missing highlights`).toBeInstanceOf(Array)
        expect(feature.highlights.length, `${key} has empty highlights`).toBeGreaterThan(0)
      }
    })

    it('renders chatQA config correctly', () => {
      render(
        <PremiumFeaturePage {...PREMIUM_FEATURES.chatQA}>
          <div>Content</div>
        </PremiumFeaturePage>
      )

      expect(screen.getByText('AI Q&A')).toBeInTheDocument()
      expect(screen.getByText(/Chat-style Q&A interface/)).toBeInTheDocument()
    })
  })
})
