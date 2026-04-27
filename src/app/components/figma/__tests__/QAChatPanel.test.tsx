import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { QAChatPanel } from '../QAChatPanel'
import { useNoteQAAvailability } from '@/app/hooks/useNoteQAAvailability'

const mockCount = vi.hoisted(() => vi.fn())

vi.mock('@/app/hooks/useNoteQAAvailability', () => ({
  useNoteQAAvailability: vi.fn(),
}))

vi.mock('@/app/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/stores/useQAChatStore', () => ({
  useQAChatStore: () => ({
    messages: [],
    isGenerating: false,
    error: null,
    addQuestion: vi.fn(),
    addAnswer: vi.fn(),
    updateAnswer: vi.fn(),
    setGenerating: vi.fn(),
    setError: vi.fn(),
  }),
}))

vi.mock('@/lib/noteQA', () => ({
  retrieveRelevantNotes: vi.fn(),
  generateQAAnswer: vi.fn(),
}))

vi.mock('@/ai/llm/factory', () => ({
  assertAIFeatureConsent: vi.fn().mockResolvedValue({
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
  }),
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
  fireEvent.click(screen.getByTitle('Ask AI about your notes'))
}

describe('QAChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCount.mockResolvedValue(1)
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
})
