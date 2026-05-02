/**
 * TtsControlBar unit tests — theme derivation from shared readerThemeConfig
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TtsControlBar } from '../TtsControlBar'
import type { ReaderTheme } from '@/stores/useReaderStore'

vi.mock('../readerThemeConfig', async () => {
  const actual =
    await vi.importActual<typeof import('../readerThemeConfig')>('../readerThemeConfig')
  return {
    ...actual,
    useAppColorScheme: () => 'professional',
  }
})

const defaultProps = {
  isPlaying: false,
  currentChunk: 1,
  totalChunks: 10,
  rate: 1,
  voiceURI: null,
  voices: [
    {
      voiceURI: 'voice-alex',
      name: 'Alex',
      lang: 'en-US',
      localService: true,
      default: true,
    },
  ],
  theme: 'white' as ReaderTheme,
  onPlayPause: vi.fn(),
  onStop: vi.fn(),
  onRateChange: vi.fn(),
  onVoiceChange: vi.fn(),
}

describe('TtsControlBar', () => {
  describe('Theme application', () => {
    it('uses bottom chrome stacking and white page tone bar classes', () => {
      render(<TtsControlBar {...defaultProps} theme="white" />)

      const bar = screen.getByTestId('tts-control-bar')
      expect(bar).toHaveClass('bottom-0', 'z-[120]')
      expect(bar).toHaveClass('bg-[#ffffff]/98', 'text-[#1c1d2b]')
    })

    it('applies dark page tone classes', () => {
      render(<TtsControlBar {...defaultProps} theme="dark" />)

      const bar = screen.getByTestId('tts-control-bar')
      expect(bar).toHaveClass('bg-[#383a56]/98', 'text-[#f7f7fb]')
    })

    it('applies sepia theme classes', () => {
      render(<TtsControlBar {...defaultProps} theme="sepia" />)

      const bar = screen.getByTestId('tts-control-bar')
      expect(bar).toHaveClass('bg-[#f4ecd8]/98', 'text-[#2d241e]')
    })

    it('applies gray and black page tone classes', () => {
      const { rerender } = render(<TtsControlBar {...defaultProps} theme="gray" />)
      expect(screen.getByTestId('tts-control-bar')).toHaveClass(
        'bg-[#e5e5e5]/98',
        'text-[#1f2937]'
      )

      rerender(<TtsControlBar {...defaultProps} theme="black" />)
      expect(screen.getByTestId('tts-control-bar')).toHaveClass(
        'bg-[#000000]/98',
        'text-[#f8fafc]'
      )
    })
  })

  it('shows the browser voice selector with pointer affordance', () => {
    render(<TtsControlBar {...defaultProps} />)

    const voice = screen.getByTestId('tts-voice-select')
    expect(voice).toBeInTheDocument()
    expect(voice).toHaveClass('cursor-pointer')
    expect(screen.getByLabelText('Reading voice')).toHaveTextContent('System voice')

    expect(screen.getByTestId('tts-speed-select')).toHaveClass('cursor-pointer')
  })

  it('shows the selected voice name when a voice is chosen', () => {
    render(<TtsControlBar {...defaultProps} voiceURI="voice-alex" />)

    expect(screen.getByLabelText('Reading voice')).toHaveTextContent('Alex')
  })
})
