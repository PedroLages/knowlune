import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GenerateQuizButton } from '@/app/components/figma/GenerateQuizButton'

const readyTranscript = {
  status: 'ready' as const,
  text: 'Transcript text',
  cues: [],
  fingerprint: 'fingerprint',
  source: 'youtube' as const,
  videoId: 'video-1',
}

describe('GenerateQuizButton', () => {
  it('uses Thinking Level and enables generation for a ready transcript', () => {
    render(
      <GenerateQuizButton
        isGenerating={false}
        aiAvailable
        checkingAvailability={false}
        cachedQuiz={null}
        transcript={readyTranscript}
        onGenerate={vi.fn()}
        onRequestTranscript={vi.fn()}
      />
    )

    expect(screen.getByText('Thinking Level')).toBeInTheDocument()
    expect(screen.getByTestId('generate-quiz-button')).toBeEnabled()
  })

  it('disables generation and provides a direct transcript action when missing', async () => {
    const onRequestTranscript = vi.fn()
    render(
      <GenerateQuizButton
        isGenerating={false}
        aiAvailable
        checkingAvailability={false}
        cachedQuiz={null}
        transcript={{ status: 'missing', reason: 'No transcript is available.' }}
        onGenerate={vi.fn()}
        onRequestTranscript={onRequestTranscript}
      />
    )

    expect(screen.getByTestId('generate-quiz-button')).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Generate Transcript First' }))
    expect(onRequestTranscript).toHaveBeenCalledOnce()
  })

  it('shows transcript progress without enabling quiz generation', () => {
    render(
      <GenerateQuizButton
        isGenerating={false}
        aiAvailable
        checkingAvailability={false}
        cachedQuiz={null}
        transcript={{ status: 'processing', reason: 'Transcript generation is in progress.' }}
        onGenerate={vi.fn()}
        onRequestTranscript={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'View Transcript Progress' })).toBeEnabled()
    expect(screen.getByTestId('generate-quiz-button')).toBeDisabled()
  })
})
