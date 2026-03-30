/**
 * MiniPlayer — Unit tests for E91-S04
 *
 * Tests:
 * - Renders when isVisible=true, hidden when false
 * - Play/pause button toggles label based on isMainPlaying
 * - Close button calls onClose
 * - Play/pause button calls onPlayPause
 * - Has correct ARIA attributes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MiniPlayer } from '../MiniPlayer'

// Stub requestAnimationFrame for animation triggers
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    cb(0)
    return 0
  })
})

const defaultProps = {
  videoSrc: 'blob:http://localhost/test-video',
  currentTime: 42,
  isMainPlaying: false,
  isVisible: true,
  onClose: vi.fn(),
  onPlayPause: vi.fn(),
}

describe('MiniPlayer', () => {
  it('renders when visible', async () => {
    render(<MiniPlayer {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByTestId('mini-player')).toBeInTheDocument()
    })
  })

  it('does not render when not visible', async () => {
    render(<MiniPlayer {...defaultProps} isVisible={false} />)
    // After animation timeout, should not be in DOM
    await waitFor(() => {
      expect(screen.queryByTestId('mini-player')).not.toBeInTheDocument()
    })
  })

  it('shows Play label when paused', async () => {
    render(<MiniPlayer {...defaultProps} isMainPlaying={false} />)
    await waitFor(() => {
      expect(screen.getByLabelText('Play')).toBeInTheDocument()
    })
  })

  it('shows Pause label when playing', async () => {
    render(<MiniPlayer {...defaultProps} isMainPlaying={true} />)
    await waitFor(() => {
      expect(screen.getByLabelText('Pause')).toBeInTheDocument()
    })
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<MiniPlayer {...defaultProps} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByTestId('mini-player-close')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('mini-player-close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onPlayPause when play/pause button clicked', async () => {
    const onPlayPause = vi.fn()
    render(<MiniPlayer {...defaultProps} onPlayPause={onPlayPause} />)
    await waitFor(() => {
      expect(screen.getByTestId('mini-player-playpause')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('mini-player-playpause'))
    expect(onPlayPause).toHaveBeenCalledOnce()
  })

  it('has accessible region landmark', async () => {
    render(<MiniPlayer {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Mini video player' })).toBeInTheDocument()
    })
  })
})
