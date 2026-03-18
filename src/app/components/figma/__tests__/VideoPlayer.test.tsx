import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// jsdom polyfills — must run before any component import
// ---------------------------------------------------------------------------
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// jsdom stubs HTMLMediaElement methods as "not implemented" — provide real mocks
const playMock = vi.fn().mockResolvedValue(undefined)
const pauseMock = vi.fn()
const loadMock = vi.fn()

Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: playMock,
})
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: pauseMock,
})
Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: loadMock,
})

import { VideoPlayer } from '../VideoPlayer'

// ---------------------------------------------------------------------------
// Mocks for child components
// ---------------------------------------------------------------------------

vi.mock('../ChapterProgressBar', () => ({
  ChapterProgressBar: ({ progress, onSeek }: { progress: number; onSeek: (p: number) => void }) => (
    <div data-testid="chapter-progress-bar" data-progress={progress}>
      <input
        data-testid="progress-input"
        type="range"
        min={0}
        max={100}
        value={progress}
        onChange={e => onSeek(Number(e.target.value))}
      />
    </div>
  ),
}))

vi.mock('../VideoShortcutsOverlay', () => ({
  VideoShortcutsOverlay: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="shortcuts-overlay">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  src: 'test-video.mp4',
  title: 'Test Video',
}

function renderPlayer(props: Partial<React.ComponentProps<typeof VideoPlayer>> = {}) {
  return render(<VideoPlayer {...defaultProps} {...props} />)
}

/** Get the video DOM element */
function getVideo(): HTMLVideoElement {
  return document.querySelector('video')!
}

/** Simulate loadedmetadata with a given duration */
function fireLoadedMetadata(duration = 120) {
  const video = getVideo()
  Object.defineProperty(video, 'duration', {
    get: () => duration,
    configurable: true,
  })
  fireEvent.loadedMetadata(video)
}

/** Set up matchMedia to report desktop width */
function setDesktopViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(min-width: 640px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    }),
  })
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  localStorage.clear()
  playMock.mockClear()
  pauseMock.mockClear()
  loadMock.mockClear()

  // PiP feature detection — disabled by default
  Object.defineProperty(document, 'pictureInPictureEnabled', {
    value: false,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(document, 'pictureInPictureElement', {
    value: null,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(document, 'fullscreenElement', {
    value: null,
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ===========================================================================
// TESTS
// ===========================================================================

describe('VideoPlayer', () => {
  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  describe('rendering', () => {
    it('renders without crashing with required props', () => {
      renderPlayer()
      expect(screen.getByTestId('video-player-container')).toBeInTheDocument()
    })

    it('renders with the correct aria-label from title prop', () => {
      renderPlayer({ title: 'Lesson 1 - Intro' })
      expect(screen.getByRole('region', { name: 'Lesson 1 - Intro' })).toBeInTheDocument()
    })

    it('falls back to "Video player" aria-label when no title', () => {
      renderPlayer({ title: undefined })
      expect(screen.getByRole('region', { name: 'Video player' })).toBeInTheDocument()
    })

    it('renders a <video> element with correct src', () => {
      renderPlayer({ src: 'my-video.mp4' })
      const video = getVideo()
      expect(video).toBeInTheDocument()
      expect(video.getAttribute('src')).toBe('my-video.mp4')
    })

    it('renders poster attribute when provided', () => {
      renderPlayer({ poster: 'thumb.jpg' })
      expect(getVideo().getAttribute('poster')).toBe('thumb.jpg')
    })

    it('renders caption tracks when provided', () => {
      renderPlayer({
        captions: [
          { src: 'en.vtt', label: 'English', language: 'en', default: true },
          { src: 'es.vtt', label: 'Spanish', language: 'es' },
        ],
      })
      const tracks = document.querySelectorAll('track')
      expect(tracks).toHaveLength(2)
      expect(tracks[0].getAttribute('srclang')).toBe('en')
      expect(tracks[1].getAttribute('srclang')).toBe('es')
    })

    it('renders play button initially (paused state)', () => {
      renderPlayer()
      expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    })

    it('renders time displays', () => {
      renderPlayer()
      expect(screen.getByTestId('current-time')).toHaveTextContent('0:00')
    })

    it('renders skip forward and skip back buttons', () => {
      renderPlayer()
      expect(screen.getByRole('button', { name: 'Skip back 10 seconds' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Skip forward 10 seconds' })).toBeInTheDocument()
    })

    it('renders fullscreen button', () => {
      renderPlayer()
      expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeInTheDocument()
    })

    it('renders captions button', () => {
      renderPlayer()
      expect(screen.getByRole('button', { name: 'Load captions' })).toBeInTheDocument()
    })

    it('renders speed menu trigger', () => {
      renderPlayer()
      expect(screen.getByTestId('speed-menu-trigger')).toBeInTheDocument()
    })

    it('renders bookmark button when onBookmarkAdd is provided', () => {
      renderPlayer({ onBookmarkAdd: vi.fn() })
      expect(
        screen.getByRole('button', { name: 'Add bookmark at current time' })
      ).toBeInTheDocument()
    })

    it('does NOT render bookmark button when onBookmarkAdd is not provided', () => {
      renderPlayer()
      expect(
        screen.queryByRole('button', { name: 'Add bookmark at current time' })
      ).not.toBeInTheDocument()
    })

    it('renders theater mode button when onTheaterModeToggle is provided', () => {
      renderPlayer({ onTheaterModeToggle: vi.fn() })
      expect(screen.getByRole('button', { name: 'Toggle theater mode' })).toBeInTheDocument()
    })

    it('does NOT render theater mode button when callback is not provided', () => {
      renderPlayer()
      expect(screen.queryByRole('button', { name: 'Toggle theater mode' })).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Play / Pause
  // -------------------------------------------------------------------------
  describe('play/pause', () => {
    it('calls video.play() when play button is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      await user.click(screen.getByRole('button', { name: 'Play' }))
      expect(playMock).toHaveBeenCalled()
    })

    it('calls video.pause() after playing and clicking pause', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      await user.click(screen.getByRole('button', { name: 'Play' }))
      await user.click(screen.getByRole('button', { name: 'Pause' }))
      expect(pauseMock).toHaveBeenCalled()
    })

    it('fires onPlayStateChange(true) on play', async () => {
      const onPlayStateChange = vi.fn()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer({ onPlayStateChange })
      fireLoadedMetadata()

      await user.click(screen.getByRole('button', { name: 'Play' }))
      expect(onPlayStateChange).toHaveBeenCalledWith(true)
    })

    it('fires onPlayStateChange(false) on pause', async () => {
      const onPlayStateChange = vi.fn()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer({ onPlayStateChange })
      fireLoadedMetadata()

      await user.click(screen.getByRole('button', { name: 'Play' }))
      await user.click(screen.getByRole('button', { name: 'Pause' }))
      expect(onPlayStateChange).toHaveBeenCalledWith(false)
    })

    it('announces "Playing" on play', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      await user.click(screen.getByRole('button', { name: 'Play' }))
      expect(screen.getByRole('status')).toHaveTextContent('Playing')
    })

    it('announces "Paused" on pause', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      await user.click(screen.getByRole('button', { name: 'Play' }))
      await user.click(screen.getByRole('button', { name: 'Pause' }))
      expect(screen.getByRole('status')).toHaveTextContent('Paused')
    })
  })

  // -------------------------------------------------------------------------
  // Video ended
  // -------------------------------------------------------------------------
  describe('video ended', () => {
    it('calls onEnded callback when video ends', () => {
      const onEnded = vi.fn()
      renderPlayer({ onEnded })
      fireLoadedMetadata()

      fireEvent.ended(getVideo())
      expect(onEnded).toHaveBeenCalledOnce()
    })

    it('fires onPlayStateChange(false) when video ends', () => {
      const onPlayStateChange = vi.fn()
      renderPlayer({ onPlayStateChange })
      fireLoadedMetadata()

      fireEvent.ended(getVideo())
      expect(onPlayStateChange).toHaveBeenCalledWith(false)
    })

    it('announces "Video ended"', () => {
      renderPlayer()
      fireLoadedMetadata()

      fireEvent.ended(getVideo())
      expect(screen.getByRole('status')).toHaveTextContent('Video ended')
    })
  })

  // -------------------------------------------------------------------------
  // Time update
  // -------------------------------------------------------------------------
  describe('time update', () => {
    it('calls onTimeUpdate with current time', () => {
      const onTimeUpdate = vi.fn()
      renderPlayer({ onTimeUpdate })
      fireLoadedMetadata()

      const video = getVideo()
      Object.defineProperty(video, 'currentTime', {
        value: 45,
        writable: true,
        configurable: true,
      })
      fireEvent.timeUpdate(video)

      expect(onTimeUpdate).toHaveBeenCalledWith(45)
    })
  })

  // -------------------------------------------------------------------------
  // Loaded metadata / initial position
  // -------------------------------------------------------------------------
  describe('loaded metadata', () => {
    it('restores initialPosition on first loadedmetadata', () => {
      renderPlayer({ initialPosition: 30 })
      const video = getVideo()
      Object.defineProperty(video, 'duration', { get: () => 120, configurable: true })
      fireEvent.loadedMetadata(video)
      expect(video.currentTime).toBe(30)
    })

    it('does NOT restore position on second loadedmetadata', () => {
      renderPlayer({ initialPosition: 30 })
      const video = getVideo()
      Object.defineProperty(video, 'duration', { get: () => 120, configurable: true })

      fireEvent.loadedMetadata(video)
      expect(video.currentTime).toBe(30)

      video.currentTime = 60
      fireEvent.loadedMetadata(video)
      expect(video.currentTime).toBe(60)
    })
  })

  // -------------------------------------------------------------------------
  // Mute / Unmute
  // -------------------------------------------------------------------------
  describe('mute/unmute', () => {
    it('toggles mute on volume button click (desktop)', async () => {
      setDesktopViewport()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      const muteBtn = screen.getByTestId('volume-button')
      await user.click(muteBtn)
      expect(screen.getByRole('status')).toHaveTextContent('Muted')

      await user.click(muteBtn)
      expect(screen.getByRole('status')).toHaveTextContent('Unmuted')
    })
  })

  // -------------------------------------------------------------------------
  // Seek (skip forward / backward)
  // -------------------------------------------------------------------------
  describe('seeking', () => {
    it('skip back button seeks -10 seconds', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      const video = getVideo()
      video.currentTime = 30

      await user.click(screen.getByRole('button', { name: 'Skip back 10 seconds' }))
      expect(video.currentTime).toBe(20)
    })

    it('skip forward button seeks +10 seconds', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      const video = getVideo()
      video.currentTime = 30

      await user.click(screen.getByRole('button', { name: 'Skip forward 10 seconds' }))
      expect(video.currentTime).toBe(40)
    })

    it('clamps seek to 0 (no negative time)', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      const video = getVideo()
      video.currentTime = 3

      await user.click(screen.getByRole('button', { name: 'Skip back 10 seconds' }))
      expect(video.currentTime).toBe(0)
    })

    it('clamps seek to duration', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata(60)

      const video = getVideo()
      video.currentTime = 55

      await user.click(screen.getByRole('button', { name: 'Skip forward 10 seconds' }))
      expect(video.currentTime).toBe(60)
    })
  })

  // -------------------------------------------------------------------------
  // Bookmarks
  // -------------------------------------------------------------------------
  describe('bookmarks', () => {
    it('calls onBookmarkAdd with current time', async () => {
      const onBookmarkAdd = vi.fn()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer({ onBookmarkAdd })
      fireLoadedMetadata()

      const video = getVideo()
      Object.defineProperty(video, 'currentTime', {
        value: 45,
        writable: true,
        configurable: true,
      })
      fireEvent.timeUpdate(video)

      await user.click(screen.getByRole('button', { name: 'Add bookmark at current time' }))
      expect(onBookmarkAdd).toHaveBeenCalledWith(45)
    })

    it('shows bookmark confirmation announcement', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer({ onBookmarkAdd: vi.fn() })
      fireLoadedMetadata()

      await user.click(screen.getByRole('button', { name: 'Add bookmark at current time' }))
      expect(screen.getByRole('status')).toHaveTextContent(/Bookmark added at/)
    })
  })

  // -------------------------------------------------------------------------
  // Captions toggle
  // -------------------------------------------------------------------------
  describe('captions', () => {
    it('disables captions button when no captions and no onLoadCaptions', () => {
      renderPlayer({ captions: [] })
      const btn = screen.getByRole('button', { name: 'Load captions' })
      expect(btn).toBeDisabled()
    })

    it('enables captions button when onLoadCaptions is provided (file picker mode)', () => {
      renderPlayer({ captions: [], onLoadCaptions: vi.fn() })
      const btn = screen.getByRole('button', { name: 'Load captions' })
      expect(btn).not.toBeDisabled()
    })

    it('enables captions button when captions are provided', () => {
      renderPlayer({
        captions: [{ src: 'en.vtt', label: 'English', language: 'en' }],
      })
      const btn = screen.getByRole('button', { name: 'Enable captions' })
      expect(btn).not.toBeDisabled()
    })

    it('toggles captions and persists to localStorage', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer({
        captions: [{ src: 'en.vtt', label: 'English', language: 'en' }],
      })
      fireLoadedMetadata()

      await user.click(screen.getByRole('button', { name: 'Enable captions' }))
      expect(localStorage.getItem('video-captions-enabled')).toBe('true')
      expect(screen.getByRole('status')).toHaveTextContent('Captions enabled')

      await user.click(screen.getByRole('button', { name: 'Disable captions' }))
      expect(localStorage.getItem('video-captions-enabled')).toBe('false')
      expect(screen.getByRole('status')).toHaveTextContent('Captions disabled')
    })
  })

  // -------------------------------------------------------------------------
  // Playback speed
  // -------------------------------------------------------------------------
  describe('playback speed', () => {
    it('restores saved speed from localStorage', () => {
      localStorage.setItem('video-playback-speed', '1.5')
      renderPlayer()
      expect(screen.getByTestId('speed-menu-trigger')).toHaveTextContent('1.5x')
    })

    it('defaults to 1x when no saved speed', () => {
      renderPlayer()
      expect(screen.getByTestId('speed-menu-trigger')).toHaveTextContent('1x')
    })
  })

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  describe('error state', () => {
    it('shows error overlay when video errors', () => {
      renderPlayer()
      fireEvent.error(getVideo())
      expect(screen.getByText('An error occurred. Please try again.')).toBeInTheDocument()
    })

    it('renders retry button in error state', () => {
      renderPlayer()
      fireEvent.error(getVideo())
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('retry button reloads the video', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()
      fireEvent.error(getVideo())

      await user.click(screen.getByRole('button', { name: /retry/i }))
      expect(loadMock).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Buffering state
  // -------------------------------------------------------------------------
  describe('buffering', () => {
    it('shows buffering spinner after 200ms debounce', () => {
      renderPlayer()
      fireLoadedMetadata()

      fireEvent.waiting(getVideo())
      expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('clears buffering on canPlay', () => {
      renderPlayer()
      fireLoadedMetadata()

      fireEvent.waiting(getVideo())
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()

      fireEvent.canPlay(getVideo())
      expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------
  describe('keyboard shortcuts', () => {
    it('space toggles play/pause', () => {
      renderPlayer()
      fireLoadedMetadata()

      fireEvent.keyDown(window, { key: ' ' })
      expect(playMock).toHaveBeenCalled()

      fireEvent.keyDown(window, { key: ' ' })
      expect(pauseMock).toHaveBeenCalled()
    })

    it('k toggles play/pause', () => {
      renderPlayer()
      fireLoadedMetadata()

      fireEvent.keyDown(window, { key: 'k' })
      expect(playMock).toHaveBeenCalled()
    })

    it('m toggles mute', () => {
      renderPlayer()
      fireLoadedMetadata()

      fireEvent.keyDown(window, { key: 'm' })
      expect(screen.getByRole('status')).toHaveTextContent('Muted')

      fireEvent.keyDown(window, { key: 'm' })
      expect(screen.getByRole('status')).toHaveTextContent('Unmuted')
    })

    it('ArrowLeft seeks back 5 seconds', () => {
      renderPlayer()
      fireLoadedMetadata()

      const video = getVideo()
      video.currentTime = 30

      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      expect(video.currentTime).toBe(25)
    })

    it('ArrowRight seeks forward 5 seconds', () => {
      renderPlayer()
      fireLoadedMetadata()

      const video = getVideo()
      video.currentTime = 30

      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(video.currentTime).toBe(35)
    })

    it('j seeks back 10 seconds', () => {
      renderPlayer()
      fireLoadedMetadata()

      const video = getVideo()
      video.currentTime = 30

      fireEvent.keyDown(window, { key: 'j' })
      expect(video.currentTime).toBe(20)
    })

    it('l seeks forward 10 seconds', () => {
      renderPlayer()
      fireLoadedMetadata()

      const video = getVideo()
      video.currentTime = 30

      fireEvent.keyDown(window, { key: 'l' })
      expect(video.currentTime).toBe(40)
    })

    it('number keys jump to percentage positions', () => {
      renderPlayer()
      fireLoadedMetadata(100)

      fireEvent.keyDown(window, { key: '5' })
      expect(getVideo().currentTime).toBe(50)

      fireEvent.keyDown(window, { key: '0' })
      expect(getVideo().currentTime).toBe(0)
    })

    it('f toggles fullscreen', () => {
      const requestFullscreen = vi.fn()
      renderPlayer()
      fireLoadedMetadata()

      const container = screen.getByTestId('video-player-container')
      container.requestFullscreen = requestFullscreen

      fireEvent.keyDown(window, { key: 'f' })
      expect(requestFullscreen).toHaveBeenCalled()
    })

    it('b adds bookmark', () => {
      const onBookmarkAdd = vi.fn()
      renderPlayer({ onBookmarkAdd })
      fireLoadedMetadata()

      fireEvent.keyDown(window, { key: 'b' })
      expect(onBookmarkAdd).toHaveBeenCalledWith(0)
    })

    it('c toggles captions', () => {
      renderPlayer({
        captions: [{ src: 'en.vtt', label: 'English', language: 'en' }],
      })
      fireLoadedMetadata()

      fireEvent.keyDown(window, { key: 'c' })
      expect(screen.getByRole('status')).toHaveTextContent('Captions enabled')
    })

    it('t toggles theater mode', () => {
      const onTheaterModeToggle = vi.fn()
      renderPlayer({ onTheaterModeToggle })
      fireLoadedMetadata()

      fireEvent.keyDown(window, { key: 't' })
      expect(onTheaterModeToggle).toHaveBeenCalledOnce()
    })

    it('ignores shortcuts when modifier keys are held', () => {
      renderPlayer()
      fireLoadedMetadata()

      fireEvent.keyDown(window, { key: ' ', ctrlKey: true })
      expect(playMock).not.toHaveBeenCalled()

      fireEvent.keyDown(window, { key: ' ', metaKey: true })
      expect(playMock).not.toHaveBeenCalled()

      fireEvent.keyDown(window, { key: ' ', altKey: true })
      expect(playMock).not.toHaveBeenCalled()
    })

    it('ignores shortcuts when user is typing in an input', () => {
      renderPlayer()
      fireLoadedMetadata()

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      fireEvent.keyDown(window, { key: ' ' })
      expect(playMock).not.toHaveBeenCalled()

      document.body.removeChild(input)
    })
  })

  // -------------------------------------------------------------------------
  // Fullscreen
  // -------------------------------------------------------------------------
  describe('fullscreen', () => {
    it('calls requestFullscreen on container when button clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      const container = screen.getByTestId('video-player-container')
      container.requestFullscreen = vi.fn().mockResolvedValue(undefined)

      await user.click(screen.getByRole('button', { name: 'Enter fullscreen' }))
      expect(container.requestFullscreen).toHaveBeenCalled()
    })

    it('calls document.exitFullscreen when already fullscreen', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      // Simulate entering fullscreen
      const container = screen.getByTestId('video-player-container')
      Object.defineProperty(document, 'fullscreenElement', {
        value: container,
        configurable: true,
      })
      fireEvent(document, new Event('fullscreenchange'))

      document.exitFullscreen = vi.fn().mockResolvedValue(undefined)

      await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }))
      expect(document.exitFullscreen).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Progress bar interaction
  // -------------------------------------------------------------------------
  describe('progress bar', () => {
    it('passes progress to ChapterProgressBar', () => {
      renderPlayer()
      fireLoadedMetadata(100)

      const bar = screen.getByTestId('chapter-progress-bar')
      expect(bar.getAttribute('data-progress')).toBe('0')
    })

    it('seeks when progress bar value changes', () => {
      renderPlayer()
      fireLoadedMetadata(100)

      const input = screen.getByTestId('progress-input')
      fireEvent.change(input, { target: { value: '50' } })

      expect(getVideo().currentTime).toBe(50)
    })
  })

  // -------------------------------------------------------------------------
  // Remaining time toggle
  // -------------------------------------------------------------------------
  describe('remaining time toggle', () => {
    it('shows total duration by default', () => {
      renderPlayer()
      fireLoadedMetadata(120)
      expect(screen.getByLabelText('Toggle remaining time display')).toHaveTextContent('2:00')
    })

    it('toggles to remaining time on click', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata(120)

      await user.click(screen.getByLabelText('Toggle remaining time display'))
      expect(screen.getByLabelText('Toggle remaining time display')).toHaveTextContent('-2:00')
    })
  })

  // -------------------------------------------------------------------------
  // External seek (seekToTime prop)
  // -------------------------------------------------------------------------
  describe('external seek via seekToTime', () => {
    it('seeks to the specified time', () => {
      const onSeekComplete = vi.fn()
      const { rerender } = render(<VideoPlayer src="test.mp4" onSeekComplete={onSeekComplete} />)

      const video = getVideo()
      Object.defineProperty(video, 'duration', { get: () => 120, configurable: true })
      fireEvent.loadedMetadata(video)

      rerender(<VideoPlayer src="test.mp4" seekToTime={45} onSeekComplete={onSeekComplete} />)

      expect(video.currentTime).toBe(45)
      expect(onSeekComplete).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Controls auto-hide
  // -------------------------------------------------------------------------
  describe('controls auto-hide', () => {
    it('hides controls after 3s of mouse inactivity when playing', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      // Start playing
      await user.click(screen.getByRole('button', { name: 'Play' }))

      // Move mouse to show controls
      fireEvent.mouseMove(screen.getByTestId('video-player-container'))

      const overlay = screen.getByTestId('player-controls-overlay')
      expect(overlay).not.toHaveClass('invisible')

      act(() => {
        vi.advanceTimersByTime(3100)
      })

      expect(overlay).toHaveClass('invisible')
    })

    it('keeps controls visible when paused', () => {
      renderPlayer()
      fireLoadedMetadata()

      fireEvent.mouseMove(screen.getByTestId('video-player-container'))

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      const overlay = screen.getByTestId('player-controls-overlay')
      expect(overlay).not.toHaveClass('invisible')
    })
  })

  // -------------------------------------------------------------------------
  // ARIA live region
  // -------------------------------------------------------------------------
  describe('ARIA live region', () => {
    it('has an aria-live polite region', () => {
      renderPlayer()
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('clears announcement after 3 seconds', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderPlayer()
      fireLoadedMetadata()

      await user.click(screen.getByRole('button', { name: 'Play' }))
      expect(screen.getByRole('status')).toHaveTextContent('Playing')

      act(() => {
        vi.advanceTimersByTime(3100)
      })
      expect(screen.getByRole('status')).toHaveTextContent('')
    })
  })

  // -------------------------------------------------------------------------
  // Imperative handle
  // -------------------------------------------------------------------------
  describe('imperative handle (ref)', () => {
    it('exposes getVideoElement via ref', () => {
      const ref = {
        current: null,
      } as React.RefObject<{ getVideoElement: () => HTMLVideoElement | null } | null>
      render(<VideoPlayer ref={ref} src="test.mp4" />)

      expect(ref.current).not.toBeNull()
      expect(ref.current!.getVideoElement()).toBeInstanceOf(HTMLVideoElement)
    })
  })
})
