/**
 * Tests for PWAInstallBanner component.
 *
 * Validates:
 * - Banner renders when `beforeinstallprompt` event fires
 * - Banner is hidden when dismissed
 * - Dismissal persists in localStorage
 * - Banner does not show in standalone mode
 * - Clicking install triggers the deferred prompt
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PWAInstallBanner } from '../PWAInstallBanner'

// Key used by the component to persist dismissal state
const DISMISSED_KEY = 'pwa-install-dismissed'

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

describe('PWAInstallBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
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

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeinstallprompt',
      expect.any(Function)
    )
  })
})
