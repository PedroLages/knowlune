import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReaderSettingsPanel } from '../ReaderSettingsPanel'
import { useReaderStore } from '@/stores/useReaderStore'

vi.mock('@/lib/settings', () => ({
  getSettings: vi.fn(() => ({ colorScheme: 'professional' })),
  saveSettings: vi.fn(),
  saveSettingsToSupabase: vi.fn(),
}))

describe('ReaderSettingsPanel', () => {
  beforeAll(() => {
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false
    }
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = () => {}
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => {}
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {}
    }
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    useReaderStore.getState().resetSettings()
    vi.restoreAllMocks()
  })

  it('does not surface app Color Style; Page Tone lists five swatches', () => {
    render(<ReaderSettingsPanel open onClose={vi.fn()} />)

    expect(screen.queryByText('Color Style')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reader-color-scheme-professional')).not.toBeInTheDocument()

    expect(screen.getByText('Page Tone')).toBeInTheDocument()
    expect(screen.getByTestId('theme-white')).toBeInTheDocument()
    expect(screen.getByTestId('theme-sepia')).toBeInTheDocument()
    expect(screen.getByTestId('theme-gray')).toBeInTheDocument()
    expect(screen.getByTestId('theme-dark')).toBeInTheDocument()
    expect(screen.getByTestId('theme-black')).toBeInTheDocument()

    expect(screen.getByText('White')).toBeInTheDocument()
    expect(screen.getByText('Sepia')).toBeInTheDocument()
    expect(screen.getByText('Gray')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('Black')).toBeInTheDocument()
  })

  it('selecting Gray or Black updates reader Page Tone', async () => {
    const user = userEvent.setup()
    render(<ReaderSettingsPanel open onClose={vi.fn()} />)

    await user.click(screen.getByTestId('theme-gray'))
    expect(useReaderStore.getState().theme).toBe('gray')

    await user.click(screen.getByTestId('theme-black'))
    expect(useReaderStore.getState().theme).toBe('black')
  })

  it('lets the reader pick a typeface and line height from the sheet', async () => {
    const user = userEvent.setup()
    render(<ReaderSettingsPanel open onClose={vi.fn()} />)

    await user.click(screen.getByTestId('font-family-select'))
    await user.click(
      screen.getByRole('option', { name: /Atkinson Hyperlegible/i })
    )

    expect(useReaderStore.getState().fontFamily).toBe('atkinson')

    await user.click(screen.getByTestId('line-height-select'))
    await user.click(screen.getByRole('option', { name: /Relaxed/i }))

    expect(useReaderStore.getState().lineHeight).toBe(1.8)
  })
})
