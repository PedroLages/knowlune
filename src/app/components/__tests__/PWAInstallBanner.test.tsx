/**
 * Tests for PWAInstallBanner component.
 *
 * Validates:
 * - Banner renders when `beforeinstallprompt` event fires
 * - Banner is hidden when dismissed
 * - Dismissal persists in localStorage
 * - Banner does not show in standalone mode
 * - Clicking install triggers the deferred prompt
 * - iOS instruction card shows on iPhone Safari after 10s delay
 * - iOS card does not show on Android
 * - iOS card does not show in standalone mode
 * - iOS card dismissal persists in localStorage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PWAInstallBanner } from '../PWAInstallBanner'

// Keys used by the component to persist dismissal state
const DISMISSED_KEY = 'pwa-install-dismissed'
const IOS_DISMISSED_KEY = 'pwa-ios-install-instructions-dismissed'

/**
 * Helper to fire a synthetic `beforeinstallprompt` event on the window.
 * Returns a mock prompt() function so tests can assert it was called.
 */
function fireBeforeInstallPrompt() {
  const promptMock = vi.fn().mockResolvedValue({ outcome: 'accepted' })
  const event = new Event('beforeinstallprompt') as Event & {
    preventDefault: () => void
    prompt: () => Promise<{ outcome: string }>
  }
  Object.defineProperty(event, 'prompt', { value: promptMock, writable: false })
  // The component should call preventDefault() to capture the event
  const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
  window.dispatchEvent(event)
  return { promptMock, preventDefaultSpy }
}

/**
 * Helper to mock navigator.userAgent for iOS Safari detection
 */
function mockUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
    writable: true,
  })
}

function restoreUserAgent() {
  Object.defineProperty(navigator, 'userAgent', {
    value: window.navigator.userAgent,
    configurable: true,
    writable: true,
  })
}

const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

describe('PWAInstallBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    restoreUserAgent()
  })

  it('does not render before beforeinstallprompt fires', () => {
    render(<PWAInstallBanner />)

    // No install button or banner text should be visible
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument()
  })

  it('renders the install banner when beforeinstallprompt event fires', () => {
    render(<PWAInstallBanner />)

    act(() => {
      fireBeforeInstallPrompt()
    })

    // Banner should now be visible with an install action
    expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument()
  })

  it('calls preventDefault on the beforeinstallprompt event to defer the prompt', () => {
    render(<PWAInstallBanner />)

    let preventDefaultSpy: ReturnType<typeof vi.spyOn> | undefined
    act(() => {
      ;({ preventDefaultSpy } = fireBeforeInstallPrompt())
    })

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('hides the banner when the dismiss button is clicked', async () => {
    const user = userEvent.setup()
    render(<PWAInstallBanner />)

    act(() => {
      fireBeforeInstallPrompt()
    })

    // Find and click dismiss/close button
    const dismissButton = screen.getByRole('button', { name: /dismiss|close|later/i })
    await user.click(dismissButton)

    // Banner should no longer be visible
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument()
  })

  it('persists dismissal in localStorage', async () => {
    const user = userEvent.setup()
    render(<PWAInstallBanner />)

    act(() => {
      fireBeforeInstallPrompt()
    })

    const dismissButton = screen.getByRole('button', { name: /dismiss|close|later/i })
    await user.click(dismissButton)

    expect(localStorage.getItem(DISMISSED_KEY)).toBeTruthy()
  })

  it('does not show the banner if previously dismissed (localStorage)', () => {
    localStorage.setItem(DISMISSED_KEY, 'true')

    render(<PWAInstallBanner />)

    act(() => {
      fireBeforeInstallPrompt()
    })

    // Banner should remain hidden because dismissal was persisted
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument()
  })

  it('does not show the banner when running in standalone mode', () => {
    // Mock matchMedia to return standalone display mode
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })

    render(<PWAInstallBanner />)

    act(() => {
      fireBeforeInstallPrompt()
    })

    // Should not show in standalone mode — the app is already installed
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument()

    // Restore original matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    })
  })

  it('triggers the deferred prompt when install button is clicked', async () => {
    const user = userEvent.setup()
    render(<PWAInstallBanner />)

    let promptMock: ReturnType<typeof vi.fn> | undefined
    act(() => {
      ;({ promptMock } = fireBeforeInstallPrompt())
    })

    const installButton = screen.getByRole('button', { name: /install/i })
    await user.click(installButton)

    expect(promptMock).toHaveBeenCalledOnce()
  })

  it('hides the banner after the user accepts the install prompt', async () => {
    const user = userEvent.setup()
    render(<PWAInstallBanner />)

    act(() => {
      fireBeforeInstallPrompt()
    })

    const installButton = screen.getByRole('button', { name: /install/i })
    await user.click(installButton)

    // After accepting the prompt, the banner should be hidden
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument()
  })

  it('cleans up event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<PWAInstallBanner />)
    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
  })

  describe('iOS install instructions card', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows iOS card on iPhone Safari after 10s delay', () => {
      mockUserAgent(IOS_SAFARI_UA)

      render(<PWAInstallBanner />)

      // Should not show immediately
      expect(screen.queryByText(/add to home screen/i)).not.toBeInTheDocument()

      // Advance timer by 10 seconds
      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      expect(screen.getByText(/add to home screen/i)).toBeInTheDocument()
    })

    it('does not show iOS card on Android Chrome', () => {
      mockUserAgent(ANDROID_CHROME_UA)

      render(<PWAInstallBanner />)

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      expect(screen.queryByText(/add to home screen/i)).not.toBeInTheDocument()
    })

    it('does not show iOS card in standalone mode', () => {
      mockUserAgent(IOS_SAFARI_UA)

      const originalMatchMedia = window.matchMedia
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query === '(display-mode: standalone)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }),
      })

      render(<PWAInstallBanner />)

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      expect(screen.queryByText(/add to home screen/i)).not.toBeInTheDocument()

      Object.defineProperty(window, 'matchMedia', { writable: true, value: originalMatchMedia })
    })

    it('dismissing iOS card writes to localStorage and hides the card', () => {
      mockUserAgent(IOS_SAFARI_UA)

      render(<PWAInstallBanner />)

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      act(() => {
        fireEvent.click(dismissButton)
      })

      expect(localStorage.getItem(IOS_DISMISSED_KEY)).toBe('true')
      expect(screen.queryByText(/add to home screen/i)).not.toBeInTheDocument()
    })

    it('does not show iOS card if previously dismissed', () => {
      mockUserAgent(IOS_SAFARI_UA)
      localStorage.setItem(IOS_DISMISSED_KEY, 'true')

      render(<PWAInstallBanner />)

      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      expect(screen.queryByText(/add to home screen/i)).not.toBeInTheDocument()
    })
  })
})
