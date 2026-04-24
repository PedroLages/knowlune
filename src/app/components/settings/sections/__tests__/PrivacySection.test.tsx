/**
 * E119-S08: Unit tests for <PrivacySection /> and <ConsentToggles />
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  let currentUser: { id: string } | null = { id: 'user-1' }
  return {
    listForUser: vi.fn(),
    grantConsent: vi.fn(),
    withdrawConsent: vi.fn(),
    toastSuccess: vi.fn(),
    toastErrorSaveFailed: vi.fn(),
    setUser: (u: { id: string } | null) => { currentUser = u },
    getUser: () => currentUser,
  }
})

vi.mock('@/lib/compliance/consentService', () => ({
  listForUser: mocks.listForUser,
  CONSENT_PURPOSES: {
    AI_TUTOR: 'ai_tutor',
    AI_EMBEDDINGS: 'ai_embeddings',
    VOICE_TRANSCRIPTION: 'voice_transcription',
    ANALYTICS_TELEMETRY: 'analytics_telemetry',
    MARKETING_EMAIL: 'marketing_email',
  },
}))

vi.mock('@/lib/compliance/consentEffects', () => ({
  grantConsent: mocks.grantConsent,
  withdrawConsent: mocks.withdrawConsent,
  CONSENT_PURPOSE_META: {
    ai_tutor: {
      label: 'AI Tutor',
      description: 'Send learning content to AI.',
      dataCategories: 'Course content',
      withdrawalCopy: 'In-flight AI requests will be cancelled.',
    },
    ai_embeddings: {
      label: 'AI Embeddings',
      description: 'Generate vector embeddings.',
      dataCategories: 'Notes',
      withdrawalCopy: 'All embedding data will be deleted.',
    },
    voice_transcription: {
      label: 'Voice Transcription',
      description: 'Transcribe audio recordings.',
      dataCategories: 'Voice recordings',
      withdrawalCopy: 'Voice transcription will stop.',
    },
    analytics_telemetry: {
      label: 'Analytics & Telemetry',
      description: 'Collect anonymised usage events.',
      dataCategories: 'Anonymised interaction events',
      withdrawalCopy: 'All analytics data will be deleted.',
    },
    marketing_email: {
      label: 'Marketing Emails',
      description: 'Receive promotional emails.',
      dataCategories: 'Email address',
      withdrawalCopy: 'You will be unsubscribed.',
    },
  },
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: mocks.getUser() }),
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastSuccess: { saved: mocks.toastSuccess },
  toastError: { saveFailed: mocks.toastErrorSaveFailed },
}))

import { PrivacySection } from '../PrivacySection'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOTICE = '2026-04-23.1'

function makeRow(purpose: string, granted = true) {
  return {
    id: `consent-${purpose}`,
    userId: 'user-1',
    purpose,
    grantedAt: granted ? '2026-04-23T10:00:00Z' : null,
    withdrawnAt: null,
    noticeVersion: NOTICE,
    evidence: {},
    createdAt: '2026-04-23T10:00:00Z',
    updatedAt: '2026-04-23T10:00:00Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.setUser({ id: 'user-1' })
  mocks.listForUser.mockResolvedValue([])
  mocks.grantConsent.mockResolvedValue({ success: true })
  mocks.withdrawConsent.mockResolvedValue({ success: true })
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PrivacySection — auth gate', () => {
  it('renders nothing when no user (closed app — route guard prevents access)', () => {
    mocks.setUser(null)
    const { container } = render(<PrivacySection />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PrivacySection — authenticated', () => {
  it('renders the privacy section with all five toggle rows', async () => {
    render(<PrivacySection />)
    await waitFor(() => {
      expect(screen.getByTestId('privacy-section')).toBeTruthy()
    })
    expect(screen.getByTestId('consent-row-ai_tutor')).toBeTruthy()
    expect(screen.getByTestId('consent-row-ai_embeddings')).toBeTruthy()
    expect(screen.getByTestId('consent-row-voice_transcription')).toBeTruthy()
    expect(screen.getByTestId('consent-row-analytics_telemetry')).toBeTruthy()
    expect(screen.getByTestId('consent-row-marketing_email')).toBeTruthy()
  })

  it('all toggles are off by default when no consent rows exist', async () => {
    mocks.listForUser.mockResolvedValue([])
    render(<PrivacySection />)

    await waitFor(() => {
      expect(screen.getByTestId('consent-toggles')).toBeTruthy()
    })

    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(5)
    switches.forEach(sw => {
      expect(sw).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('renders granted toggle as checked', async () => {
    mocks.listForUser.mockResolvedValue([makeRow('ai_tutor', true)])

    render(<PrivacySection />)
    await waitFor(() => {
      const toggle = screen.getByTestId('consent-switch-ai_tutor')
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })
  })

  it('all switches have non-empty aria-labels', async () => {
    render(<PrivacySection />)
    await waitFor(() => {
      expect(screen.getByTestId('consent-toggles')).toBeTruthy()
    })

    const switches = screen.getAllByRole('switch')
    switches.forEach(sw => {
      expect(sw.getAttribute('aria-label')).toBeTruthy()
    })
  })
})

describe('ConsentToggles — grant flow', () => {
  it('clicking an off toggle calls grantConsent', async () => {
    mocks.listForUser.mockResolvedValue([])
    const user = userEvent.setup()

    render(<PrivacySection />)
    await waitFor(() => {
      expect(screen.getByTestId('consent-switch-ai_tutor')).toBeTruthy()
    })

    await user.click(screen.getByTestId('consent-switch-ai_tutor'))

    expect(mocks.grantConsent).toHaveBeenCalledWith('user-1', 'ai_tutor')
  })
})

describe('ConsentToggles — withdraw flow', () => {
  it('clicking a granted toggle opens the confirmation dialog', async () => {
    mocks.listForUser.mockResolvedValue([makeRow('ai_tutor', true)])
    const user = userEvent.setup()

    render(<PrivacySection />)
    await waitFor(() => {
      expect(screen.getByTestId('consent-switch-ai_tutor')).toHaveAttribute('aria-checked', 'true')
    })

    await user.click(screen.getByTestId('consent-switch-ai_tutor'))

    await waitFor(() => {
      expect(screen.getByTestId('withdraw-confirm-dialog')).toBeTruthy()
    })
    expect(screen.getByText(/Withdraw consent for AI Tutor/i)).toBeTruthy()
  })

  it('confirming the dialog calls withdrawConsent', async () => {
    mocks.listForUser.mockResolvedValue([makeRow('ai_tutor', true)])
    const user = userEvent.setup()

    render(<PrivacySection />)
    await waitFor(() => {
      expect(screen.getByTestId('consent-switch-ai_tutor')).toHaveAttribute('aria-checked', 'true')
    })

    await user.click(screen.getByTestId('consent-switch-ai_tutor'))
    await waitFor(() => {
      expect(screen.getByTestId('withdraw-confirm-dialog')).toBeTruthy()
    })
    await user.click(screen.getByTestId('withdraw-confirm'))

    expect(mocks.withdrawConsent).toHaveBeenCalledWith('user-1', 'ai_tutor')
  })

  it('cancelling the dialog does not call withdrawConsent', async () => {
    mocks.listForUser.mockResolvedValue([makeRow('ai_tutor', true)])
    const user = userEvent.setup()

    render(<PrivacySection />)
    await waitFor(() => {
      expect(screen.getByTestId('consent-switch-ai_tutor')).toHaveAttribute('aria-checked', 'true')
    })

    await user.click(screen.getByTestId('consent-switch-ai_tutor'))
    await waitFor(() => {
      expect(screen.getByTestId('withdraw-cancel')).toBeTruthy()
    })
    await user.click(screen.getByTestId('withdraw-cancel'))

    expect(mocks.withdrawConsent).not.toHaveBeenCalled()
  })
})
