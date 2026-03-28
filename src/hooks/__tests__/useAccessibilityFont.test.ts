import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

let mockAccessibilityFont = false

vi.mock('@/lib/settings', () => ({
  getSettings: () => ({
    displayName: 'Student',
    bio: '',
    theme: 'system' as const,
    colorScheme: 'professional' as const,
    accessibilityFont: mockAccessibilityFont,
    contentDensity: 'default' as const,
    reduceMotion: 'system' as const,
  }),
  saveSettings: vi.fn(),
}))

const mockLoadAccessibilityFont = vi.fn().mockResolvedValue(undefined)
const mockUnloadAccessibilityFont = vi.fn()

vi.mock('@/lib/accessibilityFont', () => ({
  loadAccessibilityFont: (...args: unknown[]) => mockLoadAccessibilityFont(...args),
  unloadAccessibilityFont: (...args: unknown[]) => mockUnloadAccessibilityFont(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

// Import after mocks are set up
import { useAccessibilityFont } from '../useAccessibilityFont'
import { saveSettings } from '@/lib/settings'
import { toast } from 'sonner'

describe('useAccessibilityFont', () => {
  beforeEach(() => {
    mockAccessibilityFont = false
    mockLoadAccessibilityFont.mockResolvedValue(undefined)
    mockUnloadAccessibilityFont.mockClear()
    vi.mocked(saveSettings).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- Mount behavior ---

  it('calls unloadAccessibilityFont on mount when setting is false', async () => {
    mockAccessibilityFont = false
    renderHook(() => useAccessibilityFont())

    // Wait for async effect to settle
    await vi.waitFor(() => {
      expect(mockUnloadAccessibilityFont).toHaveBeenCalled()
    })
    expect(mockLoadAccessibilityFont).not.toHaveBeenCalled()
  })

  it('calls loadAccessibilityFont on mount when setting is true', async () => {
    mockAccessibilityFont = true
    renderHook(() => useAccessibilityFont())

    await vi.waitFor(() => {
      expect(mockLoadAccessibilityFont).toHaveBeenCalled()
    })
    expect(mockUnloadAccessibilityFont).not.toHaveBeenCalled()
  })

  // --- Event listeners ---

  it('responds to settingsUpdated event', async () => {
    mockAccessibilityFont = false
    renderHook(() => useAccessibilityFont())

    await vi.waitFor(() => {
      expect(mockUnloadAccessibilityFont).toHaveBeenCalled()
    })

    // Change setting and dispatch event
    mockAccessibilityFont = true
    mockUnloadAccessibilityFont.mockClear()

    act(() => {
      window.dispatchEvent(new Event('settingsUpdated'))
    })

    await vi.waitFor(() => {
      expect(mockLoadAccessibilityFont).toHaveBeenCalled()
    })
  })

  it('responds to storage event', async () => {
    mockAccessibilityFont = false
    renderHook(() => useAccessibilityFont())

    await vi.waitFor(() => {
      expect(mockUnloadAccessibilityFont).toHaveBeenCalled()
    })

    mockAccessibilityFont = true
    mockUnloadAccessibilityFont.mockClear()

    act(() => {
      window.dispatchEvent(new Event('storage'))
    })

    await vi.waitFor(() => {
      expect(mockLoadAccessibilityFont).toHaveBeenCalled()
    })
  })

  it('removes event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useAccessibilityFont())

    const addedEvents = addSpy.mock.calls.map(([event]) => event)
    expect(addedEvents).toContain('settingsUpdated')
    expect(addedEvents).toContain('storage')

    unmount()

    const removedEvents = removeSpy.mock.calls.map(([event]) => event)
    expect(removedEvents).toContain('settingsUpdated')
    expect(removedEvents).toContain('storage')
  })

  // --- Error handling (AC5) ---

  it('reverts setting and shows error toast when font load fails', async () => {
    mockAccessibilityFont = true
    mockLoadAccessibilityFont.mockRejectedValueOnce(new Error('Network error'))

    renderHook(() => useAccessibilityFont())

    await vi.waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith({ accessibilityFont: false })
    })

    expect(toast.error).toHaveBeenCalledWith(
      'Could not load accessibility font. Please try again.',
    )
  })
})
