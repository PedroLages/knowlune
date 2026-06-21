import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { QAChatPanel } from '../QAChatPanel'
import { useNoteQAAvailability } from '@/app/hooks/useNoteQAAvailability'
import { assertAIFeatureConsent } from '@/ai/llm/factory'
import { retrieveRelevantNotes, generateQAAnswer } from '@/lib/noteQA'
import { ProviderReconsentError } from '@/ai/lib/ProviderReconsentError'
import { CONSENT_PURPOSES } from '@/lib/compliance/consentService'
import { useQAChatStore } from '@/stores/useQAChatStore'
import { grantConsent } from '@/lib/compliance/consentEffects'

const mockCount = vi.hoisted(() => vi.fn())

vi.mock('@/app/hooks/useNoteQAAvailability', () => ({
  useNoteQAAvailability: vi.fn(),
}))

vi.mock('@/app/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user?: { id: string } }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/compliance/consentEffects', () => ({
  grantConsent: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/compliance/noticeAck', () => ({
  writeNoticeAck: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/compliance/noticeVersion', () => ({
  CURRENT_NOTICE_VERSION: '2026-04-23.1',
}))

vi.mock('@/lib/compliance/consentService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/compliance/consentService')>(
    '@/lib/compliance/consentService'
  )
  return {
    ...actual,
    listForUser: vi.fn().mockResolvedValue([]),
  }
})

vi.mock('@/lib/noteQA', () => ({
  retrieveRelevantNotes: vi.fn(),
  generateQAAnswer: vi.fn(),
  getNoteDisplayName: vi.fn(() => ({ name: 'Test Note', isFallback: false })),
}))

vi.mock('@/ai/llm/factory', () => ({
  assertAIFeatureConsent: vi.fn(),
}))

vi.mock('@/lib/aiEventTracking', () => ({
  trackAIUsage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/db', () => ({
  db: {
    notes: {
      count: () => mockCount(),
    },
  },
}))

function renderPanel() {
  render(
    <MemoryRouter>
      <QAChatPanel />
    </MemoryRouter>
  )
  fireEvent.click(screen.getByTestId('qa-panel-trigger'))
}

describe('QAChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn()
    }
    mockCount.mockResolvedValue(1)
    useQAChatStore.getState().clearHistory()
    vi.mocked(grantConsent).mockResolvedValue({ success: true })
    vi.mocked(assertAIFeatureConsent).mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
    })
    vi.mocked(useNoteQAAvailability).mockReturnValue({
      status: 'available',
      availability: {
        available: true,
        provider: 'gemini',
        providerName: 'Google Gemini',
        model: 'gemini-3-flash-preview',
      },
    })
  })

  it('enables the reader Q&A input when noteQA availability passes and notes exist', async () => {
    renderPanel()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask about your notes...')).not.toBeDisabled()
    })
    expect(screen.queryByText('AI features unavailable')).not.toBeInTheDocument()
  })

  it('shows a neutral checking state without the unavailable warning', () => {
    vi.mocked(useNoteQAAvailability).mockReturnValue({
      status: 'checking',
      availability: null,
    })

    renderPanel()

    expect(screen.getByText('Checking AI settings...')).toBeInTheDocument()
    expect(screen.queryByText('AI features unavailable')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Checking AI settings...')).toBeDisabled()
  })

  it('shows a provider-specific missing key message', () => {
    vi.mocked(useNoteQAAvailability).mockReturnValue({
      status: 'unavailable',
      availability: {
        available: false,
        reason: 'missing-provider-key',
        provider: 'anthropic',
        providerName: 'Anthropic',
        model: 'claude-haiku-4-5',
      },
    })

    renderPanel()

    expect(screen.getByText('Anthropic key required')).toBeInTheDocument()
    expect(screen.getByText(/Add a key for Anthropic/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Configure Q&A in Settings')).toBeDisabled()
  })

  it('keeps no-notes separate from AI availability', async () => {
    mockCount.mockResolvedValue(0)

    renderPanel()

    await waitFor(() => {
      expect(screen.getByText('No notes yet')).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText('No notes available')).toBeDisabled()
  })

  it('shows provider re-consent modal when provider consent is stale, then grants evidence on Accept', async () => {
    vi.mocked(assertAIFeatureConsent)
      .mockRejectedValueOnce(new ProviderReconsentError(CONSENT_PURPOSES.AI_TUTOR, 'gemini'))
      .mockResolvedValue({
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
      })

    vi.mocked(retrieveRelevantNotes).mockResolvedValue([
      {
        note: {
          id: 'n1',
          courseId: 'course-1',
          videoId: 'video-1',
          content: '# Test',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          tags: [],
          timestamp: 0,
        },
        similarity: 0.9,
      },
    ])
    vi.mocked(generateQAAnswer).mockImplementation(async function* () {
      yield 'Done.'
    })

    renderPanel()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask about your notes...')).not.toBeDisabled()
    })

    const input = screen.getByPlaceholderText('Ask about your notes...')
    fireEvent.change(input, { target: { value: 'Test question?' } })
    fireEvent.click(screen.getByTestId('qa-panel-send'))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('AI Provider Update — New Consent Required')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /accept — allow data to be sent/i }))

    await waitFor(() => {
      expect(grantConsent).toHaveBeenCalledWith('user-1', CONSENT_PURPOSES.AI_TUTOR, {
        provider_id: 'gemini',
      })
    })
  })

  it('renders keyboard hint with Enter and Shift shortcuts when panel is open', async () => {
    renderPanel()

    await waitFor(() => {
      expect(screen.getByTestId('qa-panel-keyboard-hint')).toBeInTheDocument()
    })

    const hint = screen.getByTestId('qa-panel-keyboard-hint')
    expect(hint).toHaveTextContent('Enter')
    expect(hint).toHaveTextContent('Shift')
  })

  it('renders kbd elements for both keyboard shortcuts in the hint', async () => {
    renderPanel()

    await waitFor(() => {
      expect(screen.getByTestId('qa-panel-keyboard-hint')).toBeInTheDocument()
    })

    const hint = screen.getByTestId('qa-panel-keyboard-hint')
    const kbdElements = hint.querySelectorAll('kbd')
    expect(kbdElements).toHaveLength(2)
    expect(kbdElements[0]).toHaveTextContent('Enter')
    expect(kbdElements[1]).toHaveTextContent('Shift + Enter')
  })

  it('shows input and keyboard hint together when AI is available', async () => {
    renderPanel()

    await waitFor(() => {
      expect(screen.getByTestId('qa-panel-input')).not.toBeDisabled()
    })

    expect(screen.getByTestId('qa-panel-input')).toBeInTheDocument()
    expect(screen.getByTestId('qa-panel-keyboard-hint')).toBeInTheDocument()
  })
})
