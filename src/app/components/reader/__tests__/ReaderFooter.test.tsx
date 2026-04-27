/**
 * ReaderFooter unit tests — theme derivation from shared readerThemeConfig
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReaderFooter } from '../ReaderFooter'
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
  progress: 0.5,
  theme: 'white' as ReaderTheme,
  visible: true,
}

describe('ReaderFooter', () => {
  describe('Theme application', () => {
    it('applies white page tone overlay and text classes', () => {
      render(<ReaderFooter {...defaultProps} theme="white" />)

      const footer = screen.getByTestId('reader-footer')
      expect(footer).toHaveClass('bg-[#ffffff]/60', 'text-[#1c1d2b]')
    })

    it('applies dark page tone classes', () => {
      render(<ReaderFooter {...defaultProps} theme="dark" />)

      const footer = screen.getByTestId('reader-footer')
      expect(footer).toHaveClass('bg-[#383a56]/60', 'text-[#f7f7fb]')
    })

    it('applies sepia theme classes', () => {
      render(<ReaderFooter {...defaultProps} theme="sepia" />)

      const footer = screen.getByTestId('reader-footer')
      expect(footer).toHaveClass('bg-[#f4ecd8]/60', 'text-[#2d241e]')
    })
  })
})
