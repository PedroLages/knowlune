import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TranscriptPanel } from '@/app/components/youtube/TranscriptPanel'

vi.mock('@/lib/scroll', () => ({
  scrollIntoViewReducedMotion: vi.fn(),
}))

describe('TranscriptPanel rendering', () => {
  it('renders a singular segment as a readable timestamp and text row', () => {
    render(
      <TranscriptPanel
        cues={[{ startTime: 5, endTime: 10, text: 'The filesystem hierarchy starts here.' }]}
        currentTime={0}
        onSeek={vi.fn()}
        loadingState="ready"
      />
    )

    expect(screen.getByText('1 segment')).toBeVisible()
    expect(screen.getByRole('list', { name: 'Transcript segments' })).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: '0:05 — The filesystem hierarchy starts here.',
      })
    ).toBeVisible()
  })
})
