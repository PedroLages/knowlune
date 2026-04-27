import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { ChatQA } from '../ChatQA'
import { useChatQA } from '@/ai/hooks/useChatQA'
import { useNoteQAAvailability } from '@/app/hooks/useNoteQAAvailability'
import { useLiveQuery } from 'dexie-react-hooks'

vi.mock('@/ai/hooks/useChatQA', () => ({
  useChatQA: vi.fn(),
}))

vi.mock('@/app/hooks/useNoteQAAvailability', () => ({
  useNoteQAAvailability: vi.fn(),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    notes: {
      count: vi.fn(),
    },
  },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <ChatQA />
    </MemoryRouter>
  )
}

describe('ChatQA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useChatQA).mockReturnValue({
      messages: [],
      isGenerating: false,
      sendMessage: vi.fn(),
      clearMessages: vi.fn(),
      error: null,
    })
    vi.mocked(useLiveQuery).mockReturnValue(1)
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

  it('enables Q&A when noteQA availability passes', () => {
    renderPage()

    expect(screen.queryByText(/key required/i)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ask a question about your notes...')).not.toBeDisabled()
  })

  it('shows a neutral checking state while AI settings load', () => {
    vi.mocked(useNoteQAAvailability).mockReturnValue({
      status: 'checking',
      availability: null,
    })

    renderPage()

    expect(screen.getByText('Checking AI settings...')).toBeInTheDocument()
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

    renderPage()

    expect(screen.getByText('Anthropic key required')).toBeInTheDocument()
    expect(screen.getByText(/Add a key for Anthropic/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Configure Q&A in Settings to ask questions')).toBeDisabled()
  })

  it('keeps no-notes separate from AI availability', () => {
    vi.mocked(useLiveQuery).mockReturnValue(0)

    renderPage()

    expect(screen.getByText('No Notes Available')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Create notes first to use Q&A')).toBeDisabled()
  })
})
