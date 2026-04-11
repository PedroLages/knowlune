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
  theme: 'light' as ReaderTheme,
  onPlayPause: vi.fn(),
  onStop: vi.fn(),
  onRateChange: vi.fn(),
}

describe('TtsControlBar', () => {
  describe('Theme application', () => {
    it('applies light/professional bar and text classes', () => {
      render(<TtsControlBar {...defaultProps} theme="light" />)

      const bar = screen.getByTestId('tts-control-bar')
      expect(bar).toHaveClass('bg-[#faf5ee]/98', 'text-[#1c1d2b]')
    })

    it('applies dark theme classes', () => {
      render(<TtsControlBar {...defaultProps} theme="dark" />)

      const bar = screen.getByTestId('tts-control-bar')
      expect(bar).toHaveClass('bg-[#1a1b26]/98', 'text-[#e8e9f0]')
    })

    it('applies sepia theme classes', () => {
      render(<TtsControlBar {...defaultProps} theme="sepia" />)

      const bar = screen.getByTestId('tts-control-bar')
      expect(bar).toHaveClass('bg-[#f4ecd8]/98', 'text-[#3a2a1a]')
    })
  })
})
