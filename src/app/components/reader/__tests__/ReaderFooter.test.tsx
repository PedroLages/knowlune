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
  theme: 'light' as ReaderTheme,
  visible: true,
}

describe('ReaderFooter', () => {
  describe('Theme application', () => {
    it('applies light/professional overlay and text classes', () => {
      render(<ReaderFooter {...defaultProps} theme="light" />)

      const footer = screen.getByTestId('reader-footer')
      expect(footer).toHaveClass('bg-[#faf5ee]/60', 'text-[#1c1d2b]')
    })

    it('applies dark theme classes', () => {
      render(<ReaderFooter {...defaultProps} theme="dark" />)

      const footer = screen.getByTestId('reader-footer')
      expect(footer).toHaveClass('bg-[#1a1b26]/60', 'text-[#e8e9f0]')
    })

    it('applies sepia theme classes', () => {
      render(<ReaderFooter {...defaultProps} theme="sepia" />)

      const footer = screen.getByTestId('reader-footer')
      expect(footer).toHaveClass('bg-[#f4ecd8]/60', 'text-[#3a2a1a]')
    })
  })
})
