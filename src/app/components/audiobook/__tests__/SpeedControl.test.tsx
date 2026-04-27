import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpeedControl } from '@/app/components/audiobook/SpeedControl'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'
import { useBookStore } from '@/stores/useBookStore'

describe('SpeedControl', () => {
  beforeEach(() => {
    useAudioPlayerStore.setState({
      playbackRate: 1.0,
      currentBookId: null,
      currentChapterIndex: 0,
      currentTime: 0,
      isPlaying: false,
    })
    vi.spyOn(useBookStore.getState(), 'updateBookPlaybackSpeed').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies a new speed when an option button is clicked and closes the popover', async () => {
    const user = userEvent.setup()
    render(<SpeedControl bookId="book-a" />)

    await user.click(screen.getByTestId('speed-button'))
    expect(await screen.findByTestId('speed-option-1.5')).toBeInTheDocument()

    await user.click(screen.getByTestId('speed-option-1.5'))

    await waitFor(() => {
      expect(screen.queryByTestId('speed-option-1.5')).not.toBeInTheDocument()
    })
    expect(useAudioPlayerStore.getState().playbackRate).toBe(1.5)
    expect(screen.getByTestId('speed-button')).toHaveTextContent('1.5×')
    expect(useBookStore.getState().updateBookPlaybackSpeed).toHaveBeenCalledWith('book-a', 1.5)
  })

  it('closes the popover when re-selecting the current speed', async () => {
    const user = userEvent.setup()
    render(<SpeedControl bookId="book-b" />)

    await user.click(screen.getByTestId('speed-button'))
    await user.click(screen.getByTestId('speed-option-1'))

    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: 'Playback speed' })).not.toBeInTheDocument()
    })
    expect(useAudioPlayerStore.getState().playbackRate).toBe(1.0)
  })

  it('selects speed with Enter on a focused option', async () => {
    const user = userEvent.setup()
    render(<SpeedControl bookId="book-c" />)

    await user.click(screen.getByTestId('speed-button'))
    const option = screen.getByTestId('speed-option-2')
    option.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(useAudioPlayerStore.getState().playbackRate).toBe(2)
    })
    expect(useBookStore.getState().updateBookPlaybackSpeed).toHaveBeenCalledWith('book-c', 2)
  })
})
